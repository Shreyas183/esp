const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const { createCheckoutSession } = require("../controllers/payment.controller");

router.post("/create-session", authMiddleware, createCheckoutSession);

module.exports = router;
