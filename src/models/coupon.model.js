import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['flat', 'percentage'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  usageLimit: {
    type: Number, // total allowed uses for the coupon
    default: null
  },
  usedCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
