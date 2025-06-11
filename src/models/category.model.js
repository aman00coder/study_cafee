import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    default: ""
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category", // self-reference
    default: null
  },
  eventDate: {
    type: Date,
    default: null
  },
  repeatFrequency: {
    type: String,
    enum: ["quarterly", "half-yearly", "yearly", "none"],
    default: "none"
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const Category = mongoose.model("Category", categorySchema);
export default Category;