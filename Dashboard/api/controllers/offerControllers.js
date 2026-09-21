const offerModel = require('../model/offerModel');

const getAllOffers = async (req, res) => {
    try {
        const offers = await offerModel.getAllOffers();
        res.status(200).json(offers);
    } catch (error) {
        console.error('une erreur est survenue lors de la récupération des offres d\'emploi :', error);
        res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des offres d\'emploi.' });
    }

}

module.exports = {
    getAllOffers
}
