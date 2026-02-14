const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { createCheckoutSession } = require("../controllers/payment.controller");

router.post("/create-session", authMiddleware, createCheckoutSession);
const { getTournamentRevenue } = require("../controllers/payment.controller");

router.get(
  "/tournament/:id",
  authMiddleware,
  getTournamentRevenue
);

const { getOrganizerDashboard } = require("../controllers/payment.controller");

router.get(
  "/dashboard",
  authMiddleware,
  getOrganizerDashboard
);

const { getPlayerPaymentHistory } = require("../controllers/payment.controller");

router.get(
  "/my-history",
  authMiddleware,
  getPlayerPaymentHistory
);


module.exports = router;
