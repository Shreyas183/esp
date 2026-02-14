const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes"); // 👈 add this

const app = express();

app.use(cors());
app.use(express.json());

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes); // 👈 add this

app.get("/", (req, res) => {
  res.json({ message: "API Running 🚀" });
});

const tournamentRoutes = require("./routes/tournament.routes");
app.use("/api/tournament", tournamentRoutes);

const registrationRoutes = require("./routes/registration.routes");
app.use("/api/registration", registrationRoutes);

const paymentRoutes = require("./routes/payment.routes");
app.use("/api/payment", paymentRoutes);


module.exports = app;
