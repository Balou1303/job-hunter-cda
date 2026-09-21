require('dotenv').config();
const logger = require('./logger');
const ftService = require('./services/franceTravail');
const wttjService = require('./services/wttj');
const lbaService = require('./services/laBonneAlternance');
const jobModel = require('./models/jobModel');
const geo = require('./geo');

async function main() {
    try {
        logger.info("--- DÉMARRAGE DE L'AUTOMATISATION ---");

        // Récupération France Travail
        const token = await ftService.getAccessToken();
        const offersFT = await ftService.searchOffers(token, {
            motsCles: 'développeur',
            commune: process.env.FT_COMMUNE_CODE,
            distance: process.env.SEARCH_RADIUS_KM
        });
        
        // Récupération Welcome to the Jungle
        const offersWTTJ = await wttjService.searchOffers();

        // Récupération La Bonne Alternance (source officielle des contrats en apprentissage)
        const offersLBA = await lbaService.searchOffers();

        // Les trois sources renvoient deja des offres au meme format standard (id, title, company,
        // location, link, description), donc on peut simplement mettre les listes bout a bout.
        const allOffers = [...offersFT, ...offersWTTJ, ...offersLBA];
        logger.info(`${allOffers.length} offres brutes trouvées au total (FT + WTTJ + LBA).`);

        // Deux pistes sont recherchees en parallele : une alternance pour preparer le titre CDA,
        // ou un CDI de developpeur. Chaque source a deja traduit le contrat annonce vers
        // 'ALTERNANCE', 'CDI' ou 'AUTRE' a partir de ses champs structures.
        //
        // Ce tri remplace l'ancien filtre par mots-cles, qui retenait toute offre contenant le mot
        // « alternance » et laissait donc passer les postes classiques exigeant « une premiere
        // experience en alternance ». Les CDD, missions d'interim et stages sont ecartes ici.
        const PISTES_RECHERCHEES = ['ALTERNANCE', 'CDI'];
        const filteredOffers = allOffers.filter(jobOffer => PISTES_RECHERCHEES.includes(jobOffer.contractType));

        const compteurParContrat = filteredOffers.reduce((compteur, jobOffer) => {
            compteur[jobOffer.contractType] = (compteur[jobOffer.contractType] || 0) + 1;
            return compteur;
        }, {});

        logger.info(`${filteredOffers.length} offres retenues sur les deux pistes : ` +
                    `${compteurParContrat.ALTERNANCE || 0} en alternance, ${compteurParContrat.CDI || 0} en CDI.`);

        // Second tri, geographique. Les deux sources debordent de leur rayon de recherche :
        // le lieu declare par l'offre est parfois le siege de l'entreprise et non le lieu de travail.
        // Ecarter ces offres ici plutot qu'a l'analyse economise autant de requetes vers l'IA.
        const offresAccessibles = filteredOffers.filter(geo.estGeographiquementAccessible);

        // Les offres ecartees sont listees dans le journal : un rejet silencieux masquerait une
        // commune absente de la liste, donc une opportunite perdue sans trace.
        const offresEcartees = filteredOffers.filter(jobOffer => !geo.estGeographiquementAccessible(jobOffer));
        if (offresEcartees.length > 0) {
            const lieuxEcartes = [...new Set(offresEcartees.map(jobOffer => jobOffer.location))].sort();
            logger.info(`${offresEcartees.length} offres écartées hors métropole lilloise : ${lieuxEcartes.join(', ')}.`);
        }

        logger.info(`${offresAccessibles.length} offres accessibles dans le rayon geographique cible.`);

        // Sauvegarde en base de donnees (uniquement si on a trouve au moins une offre)
        if (offresAccessibles.length > 0) {
            const savedCount = await jobModel.saveOffers(offresAccessibles);
            logger.info(`${savedCount} offres sécurisées en base de données.`);
        }

        logger.info('--- FIN DU TRAITEMENT ---');
        process.exit(0); // quitte proprement le script
    } catch (error) {
        logger.error('Erreur Critique lors de l\'exécution : ' + error.message);
        process.exit(1); // quitte avec une erreur
    }
}

main();
