const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");

// Protected route
router.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: "Profile fetched successfully",
    user: req.user,
  });
});

module.exports = router;
