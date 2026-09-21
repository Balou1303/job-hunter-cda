const axios = require('axios');
const logger = require('../logger');

// Identifiants publics du moteur de recherche Algolia utilise par le site Welcome to the Jungle.
// Ces valeurs ne sont pas secretes : elles sont visibles par n'importe quel visiteur du site,
// dans le fichier charge par le navigateur a l'adresse https://www.welcometothejungle.com/api/env
// Attention : WTTJ peut les changer a tout moment. Si le scraper recommence a echouer,
// il faut retourner sur cette page et relever les nouvelles valeurs.
const ALGOLIA_APPLICATION_ID = 'CSEKHVMS53';
const ALGOLIA_SEARCH_API_KEY = '4bd8f6215d0cc52b26430765769e65a0';
const ALGOLIA_JOB_OFFERS_INDEX_NAME = 'wk_cms_jobs_production';

// Zone de recherche geographique, definie via .env (SEARCH_LATITUDE, SEARCH_LONGITUDE,
// SEARCH_RADIUS_KM). Sans ces valeurs, WTTJ renvoie des offres de toute la France, inexploitables
// pour une recherche ciblee sur une metropole donnee.
const SEARCH_CENTER_LATITUDE_LONGITUDE = `${process.env.SEARCH_LATITUDE},${process.env.SEARCH_LONGITUDE}`;
const SEARCH_RADIUS_IN_METERS = Number(process.env.SEARCH_RADIUS_KM) * 1000;

// Cette cle Algolia est restreinte par "referer" : Algolia refuse la requete (erreur 403)
// si elle ne recoit pas un en-tete Referer/Origin qui ressemble a une vraie visite du site WTTJ.
// On simule donc ces en-tetes pour que la requete soit acceptee comme si elle venait du navigateur.
const REQUEST_HEADERS = {
    'x-algolia-application-id': ALGOLIA_APPLICATION_ID,
    'x-algolia-api-key': ALGOLIA_SEARCH_API_KEY,
    'Content-Type': 'application/json',
    'Referer': 'https://www.welcometothejungle.com/',
    'Origin': 'https://www.welcometothejungle.com'
};

// Traduit la facette "contract_type" de WTTJ vers les trois valeurs utilisees dans le reste
// du programme : 'ALTERNANCE', 'CDI' ou 'AUTRE'.
//
// FULL_TIME designe un poste permanent a temps plein, soit un CDI dans le contexte francais.
function normaliserTypeContrat(contractType) {
    if (contractType === 'APPRENTICESHIP') {
        return 'ALTERNANCE';
    }

    if (contractType === 'FULL_TIME') {
        return 'CDI';
    }

    return 'AUTRE';
}

async function searchOffers() {
    try {
        const searchUrl = `https://${ALGOLIA_APPLICATION_ID}-dsn.algolia.net/1/indexes/*/queries`;

        // Trois criteres sont combines ici :
        // - facetFilters   : alternance et CDI, les deux pistes recherchees
        // - aroundLatLng   : point de reference de la recherche geographique
        // - aroundRadius   : rayon maximal autour de ce point, en metres
        //
        // Les deux valeurs placees dans le meme tableau interne forment un OU logique : une offre
        // est retenue si elle est APPRENTICESHIP ou FULL_TIME. Les stages (INTERNSHIP) restent exclus.
        const searchParams = [
            'query=développeur',
            'hitsPerPage=50',
            'facetFilters=[["contract_type:APPRENTICESHIP","contract_type:FULL_TIME"]]',
            `aroundLatLng=${SEARCH_CENTER_LATITUDE_LONGITUDE}`,
            `aroundRadius=${SEARCH_RADIUS_IN_METERS}`
        ].join('&');

        const searchPayload = {
            requests: [
                {
                    indexName: ALGOLIA_JOB_OFFERS_INDEX_NAME,
                    params: searchParams
                }
            ]
        };

        const response = await axios.post(searchUrl, searchPayload, { headers: REQUEST_HEADERS });

        const rawJobOffers = response.data.results[0].hits || [];

        // Traduction vers le format standard commun a toutes nos sources (France Travail, WTTJ, ...)
        // afin que le reste du programme (filtre, sauvegarde en base) n'ait pas besoin de connaitre
        // le format propre a chaque site.
        return rawJobOffers.map(rawOffer => {
            const jobUrl = `https://www.welcometothejungle.com/fr/companies/${rawOffer.organization?.slug}/jobs/${rawOffer.slug}`;

            // Le champ "contract_type_names.fr" contient le libelle en francais du type de contrat,
            // par exemple « Alternance ». Il est conserve tel quel a titre indicatif, tandis que
            // "contract_type" fournit la valeur machine servant au tri.
            const contractTypeLabel = rawOffer.contract_type_names?.fr || 'Non renseigné';

            return {
                id: rawOffer.objectID,
                title: rawOffer.name,
                company: rawOffer.organization?.name || 'Inconnu',
                location: rawOffer.offices?.[0]?.city || 'Non renseigné',
                contractType: normaliserTypeContrat(rawOffer.contract_type),
                contractLabel: contractTypeLabel,
                link: jobUrl,
                description: rawOffer.profile || ''
            };
        });

    } catch (error) {
        logger.error('Erreur Search WTTJ : ' + error.message);
        return [];
    }
}

module.exports = { searchOffers };
