import PlanPurchase from "../../models/planPurchase.model.js";
import Plan from "../../models/plan.model.js";
import PaymentOrder from "../../models/paymentOrder.model.js";
import razorpay from "../../services/razorpay.js";
import crypto from "crypto";

const routes = {};



routes.createOrder = async (req, res) => {
  try {
    const { planId, selectedCycle } = req.body;
    const userId = req.user?._id;

    if (!planId || !selectedCycle || !userId)
      return res.status(400).json({ message: "Missing required fields" });

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const amount = Math.round(plan.billingOptions[selectedCycle] * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    const paymentOrder = new PaymentOrder({
      user: userId,
      plan: planId,
      selectedCycle,
      selectedPrice: plan.billingOptions[selectedCycle],
      amount,
      razorpayOrderId: razorpayOrder.id,
      status: "created",
    });

    await paymentOrder.save();

    res.status(200).json({
      message: "Order created",
      order: razorpayOrder,
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
    const { order_id, payment_id, signature } = req.body;
    const userId = req.user?._id;

    if (!userId || !order_id || !payment_id || !signature)
      return res.status(400).json({ message: "Missing required fields" });

    const paymentOrder = await PaymentOrder.findOne({ razorpayOrderId: order_id });
    if (!paymentOrder)
      return res.status(404).json({ message: "Payment order not found" });

    if (!verifySignature(order_id, payment_id, signature)) {
      paymentOrder.status = "failed";
      await paymentOrder.save();
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Update payment status to paid
    paymentOrder.razorpayPaymentId = payment_id;
    paymentOrder.razorpaySignature = signature;
    paymentOrder.status = "paid";
    await paymentOrder.save();

    // Set subscription period
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (paymentOrder.selectedCycle === "monthly") endDate.setMonth(endDate.getMonth() + 1);
    else endDate.setFullYear(endDate.getFullYear() + 1);

    // Save plan purchase
    const newPurchase = new PlanPurchase({
      user: userId,
      plan: paymentOrder.plan,
      selectedCycle: paymentOrder.selectedCycle,
      selectedPrice: paymentOrder.selectedPrice,
      startDate,
      endDate,
    });

    await newPurchase.save();

    res.status(201).json({
      message: "Payment verified and plan purchased",
      data: newPurchase,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
};



export default routes;