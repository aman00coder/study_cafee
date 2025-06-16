import PlanPurchase from "../../models/planPurchase.model.js";
import Plan from "../../models/plan.model.js";
import PaymentOrder from "../../models/paymentOrder.model.js";
import Coupon from "../../models/coupon.model.js";
import razorpay from "../../services/razorpay.js";
import crypto from "crypto";
import { createInvoiceFromPaymentOrder} from "../plans/invoice.controller.js"

const routes = {};



routes.createOrder = async (req, res) => {
  try {
    const { planId, selectedCycle, couponCode } = req.body;
    const userId = req.user?._id;

    if (!planId || !selectedCycle || !userId)
      return res.status(400).json({ message: "Missing required fields" });

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const existing = await PlanPurchase.findOne({
      user: userId,
      plan: planId,
      endDate: { $gte: new Date() } // Still active
    });

    if (existing) {
      return res.status(400).json({ message: "You already have an active subscription for this plan." });
    }

    let basePrice = plan.billingOptions[selectedCycle];
    let discount = 0;
    let appliedCoupon = null;
    let taxAmount = 0;
    let finalAmount = 0;

    // ✅ Apply coupon
// ✅ Apply coupon
if (couponCode) {
  const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });

  if (!coupon)
    return res.status(400).json({ message: "Invalid coupon code" });

  if (coupon.expiryDate < new Date())
    return res.status(400).json({ message: "Coupon has expired" });

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    return res.status(400).json({ message: "Coupon usage limit exceeded" });

  // Calculate discount with rounding
  if (coupon.discountType === 'flat') {
    discount = Math.round(coupon.discountValue * 100) / 100; // Round to 2 decimal places
  } else if (coupon.discountType === 'percentage') {
    discount = Math.round((basePrice * coupon.discountValue) / 100 * 100) / 100;
  }

  discount = Math.min(discount, basePrice); // Prevent negative pricing
  appliedCoupon = coupon;
}

    // ✅ Handle tax based on tax type
const discountedPrice = Math.round((basePrice - discount) * 100) / 100;

if (plan.taxType === "exclusive" && plan.taxPercentage > 0) {
  taxAmount = Math.round((discountedPrice * plan.taxPercentage) / 100 * 100) / 100;
  finalAmount = discountedPrice + taxAmount;
} else if (plan.taxType === "inclusive" && plan.taxPercentage > 0) {
  taxAmount = Math.round((discountedPrice * plan.taxPercentage) / (100 + plan.taxPercentage) * 100) / 100;
  finalAmount = discountedPrice;
} else {
  finalAmount = discountedPrice;
}

const finalAmountInPaise = Math.round(finalAmount * 100); // Final rounding to paise

    // ✅ Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: finalAmountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    });

    // ✅ Save order in DB
    const paymentOrder = new PaymentOrder({
      user: userId,
  plan: planId,
  selectedCycle,
  selectedPrice: basePrice,
  amount: finalAmountInPaise,
  razorpayOrderId: razorpayOrder.id,
  status: "created",
  appliedCoupon: appliedCoupon ? appliedCoupon.code : null,
  planSnapshot: {
    name: plan.name,
    features: plan.features,
    billingOptions: plan.billingOptions,
    taxType: plan.taxType,
    taxPercentage: plan.taxPercentage,
  }

    });

    await paymentOrder.save();

    res.status(200).json({
      message: "Order created",
      order: razorpayOrder,
      planName: plan.name,
      basePrice, // added
      finalAmount, // added (before paise conversion)
      amount: finalAmountInPaise,
      originalPrice: basePrice,
      discount,
      taxAmount,
      taxPercentage: plan.taxPercentage, // added
      isTaxInclusive: plan.taxType === "inclusive", // added
      couponApplied: appliedCoupon ? appliedCoupon.code : null,
      taxType: plan.taxType
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

    // const existing = await PlanPurchase.findOne({
    //   user: userId,
    //   plan: paymentOrder.plan,
    //   endDate: { $gte: new Date() } // active plan
    // });
    
    // if (existing) {
    //   return res.status(400).json({ message: "Plan already active for this user" });
    // }

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
  planSnapshot: paymentOrder.planSnapshot

    });

    await newPurchase.save();

    // Apply coupon if exists
    if (paymentOrder.appliedCoupon) {
      await Coupon.findOneAndUpdate(
        { code: paymentOrder.appliedCoupon },
        { $inc: { usedCount: 1 } }
      );
    }

    // Create invoice after successful payment and plan purchase
    const invoice = await createInvoiceFromPaymentOrder(paymentOrder._id);

    res.status(201).json({
      message: "Payment verified and plan purchased",
      data: {
        purchase: newPurchase,
        invoice: {
          id: invoice._id,
          number: invoice.invoiceNumber,
          pdfUrl: invoice.invoiceUrl
        }
      },
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


//For User to see their purchases
routes.userPurchases = async (req, res) => {
  try {
    const purchases = await PlanPurchase.find({ user: req.user._id })
    .populate("user", "firstName lastName email")
      .populate({
        path: "plan",
        select: "name categories",
        populate: {
          path: "categories",
          select: "name", // only fetch category name
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "User purchases fetched", purchases });
  } catch (err) {
    console.error("User Purchases Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export default routes;