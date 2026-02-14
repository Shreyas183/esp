const Stripe = require("stripe");
const prisma = require("../utils/prisma");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/*
|--------------------------------------------------------------------------
| CREATE CHECKOUT SESSION
|--------------------------------------------------------------------------
*/

exports.createCheckoutSession = async (req, res) => {
  try {
    const { tournamentId } = req.body;

    // 🔐 Role check
    if (!req.user || req.user.role !== "PLAYER") {
      return res.status(403).json({
        message: "Only players can register for tournaments",
      });
    }

    // 🔍 Find tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return res.status(404).json({
        message: "Tournament not found",
      });
    }

    if (tournament.status !== "REGISTRATION") {
      return res.status(400).json({
        message: "Tournament is not in registration status",
      });
    }

    // 🔍 Check duplicate registration
    const existingRegistration = await prisma.registration.findUnique({
      where: {
        userId_tournamentId: {
          userId: req.user.id,
          tournamentId,
        },
      },
    });

    if (existingRegistration) {
      return res.status(400).json({
        message: "Already registered",
      });
    }

    // 🔍 Capacity check BEFORE payment
    const registrationCount = await prisma.registration.count({
      where: { tournamentId },
    });

    if (registrationCount >= tournament.maxParticipants) {
      return res.status(400).json({
        message: "Tournament is full",
      });
    }

    // 💳 Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: tournament.title,
            },
            unit_amount: tournament.entryFee * 100, // smallest unit
          },
          quantity: 1,
        },
      ],
      metadata: {
        tournamentId,
        userId: req.user.id,
      },
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
    });

    return res.json({ url: session.url });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
|--------------------------------------------------------------------------
| STRIPE WEBHOOK
|--------------------------------------------------------------------------
*/

exports.handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { tournamentId, userId } = session.metadata;

    try {
      // 🔁 Idempotency check
      const existingPayment = await prisma.payment.findUnique({
        where: { stripeSessionId: session.id },
      });

      if (existingPayment) {
        return res.json({ received: true });
      }

      // 🔍 Re-validate user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.role !== "PLAYER") {
        return res.json({ received: true });
      }

      // 🔍 Re-validate tournament
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
      });

      if (!tournament || tournament.status !== "REGISTRATION") {
        return res.json({ received: true });
      }

      // 🔍 Capacity re-check
      const registrationCount = await prisma.registration.count({
        where: { tournamentId },
      });

      if (registrationCount >= tournament.maxParticipants) {
        return res.json({ received: true });
      }

      // 💥 Atomic transaction (VERY IMPORTANT)
      await prisma.$transaction([
        prisma.payment.create({
          data: {
            stripeSessionId: session.id,
            paymentIntentId: session.payment_intent,
            amount: session.amount_total / 100,
            currency: session.currency,
            status: "SUCCESS",
            userId,
            tournamentId,
          },
        }),
        prisma.registration.create({
          data: {
            tournamentId,
            userId,
          },
        }),
      ]);

    } catch (error) {
      console.error("Webhook processing error:", error);
    }
  }

  return res.json({ received: true });
};

exports.getTournamentRevenue = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔍 Find tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return res.status(404).json({
        message: "Tournament not found",
      });
    }

    // 🔐 Authorization check
    if (
      req.user.role !== "ADMIN" &&
      tournament.organizerId !== req.user.id
    ) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    // 💰 Get payments
    const payments = await prisma.payment.findMany({
      where: {
        tournamentId: id,
        status: "SUCCESS",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 📊 Calculate total revenue
    const totalRevenue = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    res.json({
      message: "Revenue fetched successfully",
      totalRevenue,
      totalPayments: payments.length,
      payments,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

exports.getOrganizerDashboard = async (req, res) => {
  try {
    // 🔐 Only organizer or admin allowed
    if (req.user.role !== "ORGANIZER" && req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    // 📌 Get tournaments created by organizer
    const tournaments = await prisma.tournament.findMany({
      where: {
        organizerId: req.user.id,
      },
      select: {
        id: true,
      },
    });

    const tournamentIds = tournaments.map(t => t.id);

    // 💰 Get successful payments for those tournaments
    const payments = await prisma.payment.findMany({
      where: {
        tournamentId: { in: tournamentIds },
        status: "SUCCESS",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    // 📊 Calculations
    const totalRevenue = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    const totalTournaments = tournaments.length;
    const totalPayments = payments.length;

    // Unique players count
    const uniquePlayers = new Set(
      payments.map(p => p.userId)
    );

    const totalPlayers = uniquePlayers.size;

    res.json({
      message: "Organizer dashboard fetched successfully",
      totalRevenue,
      totalTournaments,
      totalPayments,
      totalPlayers,
      recentPayments: payments.slice(0, 5),
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

exports.getPlayerPaymentHistory = async (req, res) => {
  try {
    // 🔐 Only players
    if (req.user.role !== "PLAYER") {
      return res.status(403).json({
        message: "Only players can access payment history",
      });
    }

    // 💳 Fetch payments made by this player
    const payments = await prisma.payment.findMany({
      where: {
        userId: req.user.id,
        status: "SUCCESS",
      },
      include: {
        tournament: {
          select: {
            id: true,
            title: true,
            game: true,
            entryFee: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 📊 Calculate total spent
    const totalSpent = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    res.json({
      message: "Payment history fetched successfully",
      totalSpent,
      totalPayments: payments.length,
      payments,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};
