const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { registerForTournament } = require("../controllers/registration.controller");

router.post("/join", authMiddleware, registerForTournament);

module.exports = router;
