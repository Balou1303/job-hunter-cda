const offerController = require('../controllers/offerControllers');
const express = require('express');

const router = express.Router();
router.get('/', offerController.getAllOffers);

module.exports = router;