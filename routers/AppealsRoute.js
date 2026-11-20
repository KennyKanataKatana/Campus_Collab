const express = require("express");
const router = express.Router();

const controller = require("../controllers/AppealController.js");
const jwtMiddleware = require("../middlewares/jwtMiddleware.js");
const reportPasskeyMiddleware = require("../middlewares/reportPasskeyMiddleware.js");

router.get(
    "/",
    reportPasskeyMiddleware.verifyReportPasskey,
    controller.readAllAppeals
);

router.post(
    "/",
    jwtMiddleware.verifyToken,
    controller.createAppeal
);

module.exports = router;