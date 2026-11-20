const express = require("express");
const router = express.Router();

const controller = require("../controllers/ReportsController.js");
const jwtMiddleware = require("../middlewares/jwtMiddleware.js");
const reportPasskeyMiddleware = require("../middlewares/reportPasskeyMiddleware.js");
const muteMiddleware = require("../middlewares/muteMiddleware.js");

router.get("/users", controller.readReportableUsers);

router.get(
    "/my-received-reports",
    jwtMiddleware.verifyToken,
    controller.readMyReceivedReports
);

router.get(
    "/",
    reportPasskeyMiddleware.verifyReportPasskey,
    controller.readAllReports
);

router.get(
    "/reporter/:reporter_id",
    reportPasskeyMiddleware.verifyReportPasskey,
    controller.readReportsByReporterId
);

router.get(
    "/reported/:reported_user_id",
    reportPasskeyMiddleware.verifyReportPasskey,
    controller.readReportsByReportedUserId
);

router.get(
    "/muted-users",
    reportPasskeyMiddleware.verifyReportPasskey,
    controller.readMutedUsers
);

router.patch(
    "/mute/:reported_user_id",
    reportPasskeyMiddleware.verifyReportPasskey,
    controller.muteReportedUser
);

router.patch(
    "/unmute/:user_id",
    reportPasskeyMiddleware.verifyReportPasskey,
    controller.unmuteUser
);

router.post(
    "/",
    jwtMiddleware.verifyToken,
    muteMiddleware.checkIfMuted,
    controller.createReport
);

module.exports = router;