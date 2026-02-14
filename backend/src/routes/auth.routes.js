const express = require("express");
const router = express.Router();
const { register } = require("../controllers/auth.controller");
const { login } = require("../controllers/auth.controller");


router.post("/register", register);
router.post("/login", login);

module.exports = router;
