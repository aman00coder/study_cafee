import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  paymentOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentOrder", required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  selectedCycle: { type: String, enum: ["monthly", "yearly"], required: true },
  basePrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  taxType: { type: String, enum: ["inclusive", "exclusive"] },
  taxPercentage: { type: Number },
  coupon: { type: String, default: null },
  invoiceUrl: { type: String }, // Cloudinary file URL
  publicId: { type: String },   // Cloudinary public ID
}, { timestamps: true });

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
