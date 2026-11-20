const express =
    require("express");

const router =
    express.Router();

const controller =
    require(
        "../controllers/AcceptController.js"
    );

const jwtMiddleware =
    require(
        "../middlewares/jwtMiddleware"
    );


router.get(
    "/",
    controller.getAllAcceptances
);


router.get(
    "/user/:user_id",
    controller.getAllAcceptancesByUserId
);


router.get(
    "/:post_id/participants",
    controller.readParticipantsByPostId
);


router.get(
    "/:post_id",
    controller.readAcceptancesByPostId
);


router.post(
    "/:post_id",
    jwtMiddleware.verifyToken,
    controller.acceptPost
);


router.delete(
    "/:post_id",
    jwtMiddleware.verifyToken,
    controller.cancelAccept
);


module.exports = router;