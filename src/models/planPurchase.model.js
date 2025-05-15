import mongoose from "mongoose";

const planPurchaseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    selectedCycle: {
        type: String,
        enum: ['monthly', 'yearly'],
        required: true,
      },
      selectedPrice: {
        type: Number,
        required: true,
      },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const PlanPurchase = mongoose.model("PlanPurchase", planPurchaseSchema);
export default PlanPurchase;