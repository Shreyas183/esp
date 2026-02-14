const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

const {
  createTournament,
  getAllTournaments,
  getTournamentById,
  getTournamentRegistrations,
  updateTournamentStatus,
  getMyTournaments
} = require("../controllers/tournament.controller");

// Public route - get all tournaments
router.get("/",authMiddleware, getAllTournaments);
router.get("/:id/registrations", authMiddleware, getTournamentRegistrations);
router.get(
  "/my",
  authMiddleware,
  roleMiddleware("ORGANIZER", "ADMIN"),
  getMyTournaments
);
router.get("/:id", getTournamentById);

router.patch(
  "/:id/status",
  authMiddleware,
  updateTournamentStatus
);


// Protected route - create tournament
router.post(
  "/create",
  authMiddleware,
  roleMiddleware("ORGANIZER", "ADMIN"),
  createTournament
);

module.exports = router;
