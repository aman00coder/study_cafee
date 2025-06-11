import Coupon from "../../models/coupon.model.js";

const routes = {};

routes.createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      expiryDate,
      discountValue,
      usageLimit,
      usedCount,
    } = req.body;

    if (!code || !discountType || !expiryDate || !discountValue) {
      return res.status(400).json({ message: "Missing some fields" });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      expiryDate,
      discountValue,
      usageLimit,
      usedCount,
    });

    await newCoupon.save();
    res
      .status(201)
      .json({ message: "Coupon created successfully", coupon: newCoupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.allCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });

    if (coupons.length === 0)
      return res.status(404).json({ message: "No coupons found" });

    res.status(200).json(coupons);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

//Validate coupon code when user fill for discount
routes.validateCoupon = async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const coupon = await Coupon.findOne({ code, isActive: true });

    if (!coupon)
      return res.status(404).json({ message: "Invalid coupon code" });

    if (coupon.expiryDate < new Date()) {
      return res.status(400).json({ message: "Coupon has expired" });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ message: "Coupon usage limit exceeded" });
    }

    return res.status(200).json({
      message: "Coupon is valid",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });
  } catch (error) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

routes.updateCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const {
      code,
      discountValue,
      expiryDate,
      discountType,
      usageLimit,
      isActive,
    } = req.body;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // Update only the provided fields
    if (code) coupon.code = code.toUpperCase();
    if (discountValue !== undefined) coupon.discountValue = discountValue;
    if (expiryDate) coupon.expiryDate = new Date(expiryDate);
    if (discountType) coupon.discountType = discountType;
    if (usageLimit !== undefined) coupon.usageLimit = usageLimit;
    if (isActive !== undefined) coupon.isActive = isActive;

    await coupon.save();

    return res
      .status(200)
      .json({ message: "Coupon updated successfully", coupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.getCouponById = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    return res.status(200).json(coupon);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findByIdAndDelete(couponId);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    return res.status(200).json({ message: "Coupon deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export default routes;
