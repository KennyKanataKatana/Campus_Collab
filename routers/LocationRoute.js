const express = require('express');
const router = express.Router();

const controller = require('../controllers/LocationController.js');

router.get('/', controller.readAllLocations)

module.exports = router;
