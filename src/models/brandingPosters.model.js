import mongoose from "mongoose";

const brandingPosterSchema = new mongoose.Schema({
    image: {
        type: [String],
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

const BrandingPoster = mongoose.model("BrandingPoster", brandingPosterSchema);
export default BrandingPoster;