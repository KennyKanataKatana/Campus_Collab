const express = require('express');

const router = express.Router();
const controller = require('../controllers/CheckInController');
const jwtMiddleware = require('../middlewares/jwtMiddleware');

router.use(jwtMiddleware.verifyToken);

router.get('/me', controller.readMyCheckIns);
router.get('/eligible', controller.readEligibleHangouts);
router.post('/:post_id', controller.createCheckIn);
router.delete('/:post_id', controller.deleteCheckIn);

module.exports = router;
