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
    tableColumns: {
    type: [String],
    default: [] // Only for parent categories
  },
  tableData: {
    type: Map,
    of: String,
    default: {} // Only for subcategories
  },
  eventDate: {
    type: Date,
    default: null
  },
  repeatFrequency: {
    type: String,
    enum: ["monthly","quarterly", "half-yearly", "yearly", "none", "30thPlus15Days"],
    default: "none"
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const Category = mongoose.model("Category", categorySchema);
export default Category;