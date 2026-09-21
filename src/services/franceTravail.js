const axios = require('axios');
const qs = require('qs');
const logger = require('../logger'); // import du logger centralisé

async function getAccessToken() {
    try {
        const data = qs.stringify({
            grant_type: 'client_credentials',
            client_id: process.env.FT_CLIENT_ID,
            client_secret: process.env.FT_CLIENT_SECRET,
            scope: process.env.FT_SCOPE
        });

        const response = await axios.post(
            'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire',
            data,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        return response.data.access_token;
    } catch (error) {
        logger.error('Erreur Token FT : ' + (error.response?.data?.error_description || error.message));
        throw error;
    }
}

// Traduit le type de contrat renvoye par France Travail vers les trois valeurs utilisees
// dans le reste du programme : 'ALTERNANCE', 'CDI' ou 'AUTRE'.
//
// L'API expose un booleen `alternance` et un champ `natureContrat` explicite. Ces deux champs
// decrivent le contrat reellement propose, contrairement au texte de l'offre : une description
// mentionnant « une premiere experience en alternance » designe un poste classique, pas une alternance.
function normaliserTypeContrat(offre) {
    const nature = (offre.natureContrat || '').toLowerCase();

    if (offre.alternance === true || nature.includes('apprentissage') || nature.includes('professionnalisation')) {
        return 'ALTERNANCE';
    }

    if (offre.typeContrat === 'CDI') {
        return 'CDI';
    }

    // CDD, mission d'interim, profession liberale, franchise : hors des deux pistes recherchees.
    return 'AUTRE';
}

async function searchOffers(token, searchParams) {
    try {
        const response = await axios.get(
            'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search',
            {
                params: {
                    // On cherche seulement "développeur" ici : l'API France Travail traite "développeur alternance"
                    // comme une phrase quasi exacte, ce qui est trop restrictif et peut renvoyer 0 resultat certains jours.
                    // Le tri "alternance / apprenti / professionnalisation" est deja fait plus loin dans le programme
                    // (fichier index.js), donc il n'est pas necessaire de le refaire ici.
                    motsCles: 'développeur',
                    commune: searchParams.commune || '59350',
                    distance: searchParams.distance || 20,
                    sort: 1, // tri par date de publication décroissante
                    publieeDepuis: 14, // on ne veut que les offres des 14 derniers jours
                    range: '0-49'
                },
                headers: { Authorization: 'Bearer ' + token }
            }
        );

        const rawOffers = response.data.resultats || [];

        // On mappe (traduit) les données spécifiques de FT vers le format Standard !
        return rawOffers.map(offre => {
            // L'URL canonique France Travail est preferee a celle du partenaire.
            // Les liens partenaires pointent vers des ATS tiers (Beetween, Taleez, etc.) construits
            // comme des applications a fragment : ils sont purges des que le poste est pourvu et
            // renvoient alors une page 404 sans explication. L'URL France Travail reste valide tant
            // que l'offre est publiee, et affiche un message clair une fois l'offre retiree.
            const link = `https://candidat.francetravail.fr/offres/recherche/detail/${offre.id}`;
            return {
                id: offre.id,
                title: offre.intitule,
                company: offre.entreprise?.nom || 'Inconnu',
                location: offre.lieuTravail?.libelle,
                contractType: normaliserTypeContrat(offre),
                contractLabel: offre.typeContratLibelle || offre.natureContrat || 'Non renseigné',
                link: link,
                description: offre.description
            };
        });
    } catch (error) {
        const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        logger.error('Erreur Search FT : ' + msg);
        throw error;
    }
}

module.exports = { getAccessToken, searchOffers };
