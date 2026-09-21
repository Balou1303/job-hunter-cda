const axios = require('axios');
const logger = require('../logger');

// Codes ROME (Repertoire Operationnel des Metiers et des Emplois, France Travail) vises par la
// recherche. Contrairement a France Travail et WTTJ, cette API n'expose pas de recherche par
// mot-cle libre : elle se filtre uniquement par code ROME.
// M1805 = Etudes et developpement informatique, M1806 = Conseil et maitrise d'ouvrage en SI.
const ROME_CODES_DEVELOPPEUR = 'M1805,M1806';

// Centre de recherche et rayon, definis via .env (memes variables que pour WTTJ, afin de
// rester coherent entre les sources).
const SEARCH_LATITUDE = Number(process.env.SEARCH_LATITUDE);
const SEARCH_LONGITUDE = Number(process.env.SEARCH_LONGITUDE);
const SEARCH_RADIUS_KM = Number(process.env.SEARCH_RADIUS_KM);

// Extrait le nom de ville a partir d'une adresse postale complete, par exemple
// "142 RUE NATIONALE 59800 LILLE" -> "LILLE". L'API ne fournit pas de champ ville separe,
// seulement l'adresse entiere associee au SIRET de l'etablissement.
function extraireVille(adresse) {
    const correspondance = (adresse || '').match(/\d{5}\s+(.+)$/);
    return correspondance ? correspondance[1].trim() : adresse;
}

async function searchOffers() {
    if (!process.env.LBA_API_KEY) {
        logger.error('Erreur Search La Bonne Alternance : LBA_API_KEY absente du .env');
        return [];
    }

    try {
        const response = await axios.get(
            'https://api.apprentissage.beta.gouv.fr/api/job/v1/search',
            {
                params: {
                    romes: ROME_CODES_DEVELOPPEUR,
                    latitude: SEARCH_LATITUDE,
                    longitude: SEARCH_LONGITUDE,
                    radius: SEARCH_RADIUS_KM
                },
                headers: { Authorization: 'Bearer ' + process.env.LBA_API_KEY }
            }
        );

        const rawJobs = response.data.jobs || [];

        // Traduction vers le format standard commun a toutes les sources. Cette API est dediee a
        // l'alternance : chaque offre retournee est deja un contrat d'apprentissage ou de
        // professionnalisation, donc contractType est toujours 'ALTERNANCE' ici, sans besoin de
        // logique de tri comme pour France Travail ou WTTJ.
        const offers = rawJobs.map(rawJob => ({
            id: rawJob.identifier.id || rawJob.identifier.partner_job_id,
            title: rawJob.offer.title,
            company: rawJob.workplace?.name || rawJob.workplace?.brand || rawJob.workplace?.legal_name || 'Inconnu',
            location: extraireVille(rawJob.workplace?.location?.address),
            contractType: 'ALTERNANCE',
            contractLabel: (rawJob.contract?.type || []).join(', ') || 'Non renseigné',
            link: rawJob.apply?.url,
            description: rawJob.offer.description
        }));

        // Une offre associee a plusieurs des codes ROME demandes (romes=M1805,M1806) revient une
        // fois par code : on deduplique sur l'id avant de la transmettre au reste du programme.
        const offersUniquesParId = [...new Map(offers.map(offre => [offre.id, offre])).values()];
        return offersUniquesParId;
    } catch (error) {
        const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        logger.error('Erreur Search La Bonne Alternance : ' + msg);
        return [];
    }
}

module.exports = { searchOffers };
