import PlanPurchase from "../../models/planPurchase.model.js";
import Plan from "../../models/plan.model.js";
import razorpay from "../../services/razorpay.js";
import crypto from "crypto";

const routes = {};



routes.createOrder = async (req, res) => {
  try {
    const { planId, selectedCycle } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const amount = plan.billingOptions[selectedCycle] * 100;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.status(200).json({
      message: "Order created",
      order,
      planName: plan.name,
      amount,
    });
  } catch (err) {
    console.error("Create Razorpay Order Error:", err);
    res.status(500).json({ message: "Error creating order" });
  }
};

function verifySignature(order_id, payment_id, signature) {
  const generated = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${order_id}|${payment_id}`)
    .digest("hex");

  return generated === signature;
}

routes.purchasePlan = async (req, res) => {
  try {
    const { order_id, payment_id, signature, planId, selectedCycle } = req.body;
    const userId = req.user?._id;

    if (!userId || !order_id || !payment_id || !signature || !planId || !selectedCycle) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verify signature
    if (!verifySignature(order_id, payment_id, signature)) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Fetch the plan
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const selectedPrice = plan.billingOptions[selectedCycle];
    if (!selectedPrice) {
      return res.status(400).json({ message: "Price not available for selected cycle" });
    }

    // Calculate start and end dates
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (selectedCycle === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create PlanPurchase record
    const newPurchase = new PlanPurchase({
      user: userId,
      plan: planId,
      selectedCycle,
      selectedPrice,
      startDate,
      endDate,
    });

    await newPurchase.save();

    res.status(201).json({
      message: "Plan purchased and payment verified successfully",
      data: newPurchase,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
};



export default routes;