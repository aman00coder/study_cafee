import mongoose from "mongoose";

const paymentOrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  selectedCycle: { type: String, enum: ["monthly", "yearly"], required: true },
  selectedPrice: { type: Number, required: true },
  amount: { type: Number, required: true },
  razorpayOrderId: { type: String, required: true },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
}, { timestamps: true });

const PaymentOrder = mongoose.model("PaymentOrder", paymentOrderSchema);
export default PaymentOrder;
