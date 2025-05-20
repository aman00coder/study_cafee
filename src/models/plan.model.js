import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    billingOptions: {
        monthly: {
            type: Number,
            required: true
        },
        yearly: {
            type: Number,
            required: true
        }
    }, 
    categories: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category' 
    }],
    taxType: {
        type: String,
        enum: ["inclusive", "exclusive"],
        default: "inclusive"
      },
      taxPercentage: {
        type: Number,
        default: 0 // e.g., 18 for 18%
      },      
    isActive: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

const Plan = mongoose.model("Plan", planSchema);
export default Plan;