import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
    name: {
        type: String,
        enum: ["Silver", "Golden", "Platinum"], 
        required: true,
    },
    description: {
        type: String,
    },
    price: {
        type: Number,
        required: true,
    },
    duration: {
        type: Number,
        required: true,
    },
    features: {
        type: [String], // List of features included in the plan
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

const Plan = mongoose.model("Plan", planSchema);
export default Plan;