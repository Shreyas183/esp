const prisma = require("../utils/prisma");

exports.registerForTournament = async (req, res) => {
  try {
    if (req.user.role !== "PLAYER") {
      return res.status(403).json({
        message: "Only players can register for tournaments"
      });
    }
    const { tournamentId } = req.body;

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    


    // 1️⃣ Check if tournament exists
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    // 2️⃣ Check tournament status
    if (tournament.status !== "REGISTRATION") {
      return res.status(400).json({
        message: "Registration is not open for this tournament",
      });
    }

    // 3️⃣ Prevent organizer from joining own tournament
    if (tournament.organizerId === req.user.id) {
      return res.status(400).json({
        message: "Organizer cannot register in own tournament",
      });
    }

    // 4️⃣ Check if already registered
    const existing = await prisma.registration.findUnique({
      where: {
        userId_tournamentId: {
          userId: req.user.id,
          tournamentId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ message: "Already registered" });
    }

    // 5️⃣ Capacity control
    const registrationCount = await prisma.registration.count({
      where: { tournamentId },
    });

    if (registrationCount >= tournament.maxParticipants) {
      return res.status(400).json({
        message: "Tournament is full",
      });
    }

    // 6️⃣ Create registration
    const registration = await prisma.registration.create({
      data: {
        userId: req.user.id,
        tournamentId,
      },
    });

    res.status(201).json({
      message: "Registered successfully",
      registration,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
