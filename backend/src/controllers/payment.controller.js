const prisma = require("../utils/prisma");
const stripe = require("../utils/stripe");

exports.createCheckoutSession = async (req, res) => {
  try {
    const { tournamentId } = req.body;

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

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
            unit_amount: tournament.entryFee * 100,
          },
          quantity: 1,
        },
      ],
      success_url: "http://localhost:5173/success",
      cancel_url: "http://localhost:5173/cancel",
      metadata: {
        tournamentId: tournament.id,
        userId: req.user.id,
      },
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Payment session failed" });
  }
};
