const prisma = require("../utils/prisma");

exports.createTournament = async (req, res) => {
  try {
    const { title, description, game, entryFee, prizePool, maxParticipants } = req.body;

    // 🔍 Check if tournament already exists for this organizer
    const existingTournament = await prisma.tournament.findFirst({
      where: {
        title,
        organizerId: req.user.id,
      },
    });

    if (existingTournament) {
      return res.status(400).json({
        message: "Tournament with this title already exists",
      });
    }

    // ✅ Create tournament
    const tournament = await prisma.tournament.create({
      data: {
        title,
        description,
        game,
        entryFee,
        prizePool,
        maxParticipants: maxParticipants || 100, // fallback
        organizerId: req.user.id,
      },
    });

    res.status(201).json({
      message: "Tournament created successfully",
      tournament,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllTournaments = async (req, res) => {
  try {
    let tournaments;

    // If logged-in user is PLAYER → show only REGISTRATION tournaments
    if (req.user && req.user.role === "PLAYER") {
      tournaments = await prisma.tournament.findMany({
        where: {
          status: "REGISTRATION"
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } else {
      // ORGANIZER or ADMIN
      tournaments = await prisma.tournament.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    res.json({
      message: "Tournaments fetched successfully",
      tournaments,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    res.json({
      message: "Tournament fetched successfully",
      tournament,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTournamentRegistrations = async (req, res) => {
  try {
    const { id } = req.params;

    // Check tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    // Check ownership (Organizer or Admin)
    if (
      req.user.role !== "ADMIN" &&
      tournament.organizerId !== req.user.id
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json({
      message: "Registrations fetched successfully",
      registrations: tournament.registrations
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateTournamentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["DRAFT", "REGISTRATION", "LIVE", "COMPLETED"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    // Only organizer or admin can update
    if (
      req.user.role !== "ADMIN" &&
      tournament.organizerId !== req.user.id
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await prisma.tournament.update({
      where: { id },
      data: { status }
    });

    res.json({
      message: "Tournament status updated successfully",
      tournament: updated
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


exports.getMyTournaments = async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        organizerId: req.user.id
      },
      include: {
        registrations: true
      }
    });

    res.status(200).json({
      message: "Your tournaments fetched successfully",
      tournaments
    });

  } catch (error) {
    res.status(500).json({
      message: "Something went wrong"
    });
  }
};

