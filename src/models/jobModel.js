const pool = require('./database');
const logger = require('../logger');

async function saveOffers(offres) {
    let count = 0;
    for (const offre of offres) {
        try {
            // ON DUPLICATE KEY UPDATE title = VALUES(title) : si l'offre existe déjà, on met à jour le titre
            const sql = `
                INSERT INTO job_offers (source_id, title, company, location, contract_type, link, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE title = VALUES(title), link = VALUES(link), contract_type = VALUES(contract_type)
            `;

            // L'objet "offre" est maintenant standardisé, le modèle n'a plus besoin de deviner la structure !
            const params = [
                offre.id || null,
                offre.title || null,
                offre.company || 'Inconnu',
                offre.location || null,
                offre.contractType || 'AUTRE',
                offre.link || null,
                offre.description || null
            ];

            await pool.execute(sql, params);
            count++; // incrémente le compteur (count = count + 1)
        } catch (error) {
            logger.error(`Erreur d'insertion offre ${offre.id}: ${error.message}`);
        }
    }
    return count;
}

module.exports = { saveOffers };
