import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    subject:{
        type: String,
        required: true,
        trim: true,
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
},{timestamps: true});

const Testimonial = mongoose.model("Testimonial", testimonialSchema);
export default Testimonial;