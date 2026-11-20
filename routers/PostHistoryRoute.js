const express = require("express");
const router = express.Router();

const controller = require("../controllers/PostHistoryController.js");
const jwtMiddleware = require("../middlewares/jwtMiddleware.js");

router.get("/", jwtMiddleware.verifyToken, controller.readPostHistoryByUser);
router.delete("/:history_id", jwtMiddleware.verifyToken, controller.deletePostHistory);

module.exports = router;