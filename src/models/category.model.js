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
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const Category = mongoose.model("Category", categorySchema);
export default Category;