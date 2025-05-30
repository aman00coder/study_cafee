import User from "../../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Banner from "../../models/banner.model.js";
import Category from "../../models/category.model.js";
import Poster from "../../models/posters.model.js";
import Plan from "../../models/plan.model.js";
import BrandingPoster from "../../models/brandingPosters.model.js";
import Designation from "../../models/designation.model.js";
import Testimonial from "../../models/testimonails.model.js";
import PaymentOrder from "../../models/paymentOrder.model.js";
import PlanPurchase from "../../models/planPurchase.model.js";
import CompanyProfile from "../../models/companyProfile.js"
import Service from "../../models/services.model.js";
import { uploadToCloudinary } from "../../services/cloudinary.js";
import fs from "fs/promises";
import { sendOTP } from "../../services/nodemailer.js";
import cloudinary from "cloudinary";

const routes = {};

routes.registerAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      role: "admin",
    });

    await newUser.save();

    res.status(201).json({ message: "Admin created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and Password are required" });
    }

    const existingAdmin = await User.findOne({ email });
    if (!existingAdmin)
      return res.status(401).json({ message: "Invalid mail" });

    const matchPass = await bcrypt.compare(password, existingAdmin.password);
    if (!matchPass)
      return res.status(401).json({ message: "Invalid Password" });

    const payload = {
      _id: existingAdmin._id,
      email: existingAdmin.email,
      role: existingAdmin.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    return res.status(200).json({
      message: "Login Success",
      token,
      user: {
        _id: existingAdmin._id,
        email: existingAdmin.email,
        role: existingAdmin.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

//Forget-Password
routes.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    // Reuse existing OTP fields
    user.otp = otp;
    user.otpExpires = otpExpiry;
    await user.save();

    // Send OTP via email (use your existing nodemailer function)
    await sendOTP(email, otp);

    res.status(200).json({
      message: "OTP sent to email",
      expiresIn: "15 minutes",
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Find user with matching OTP (within expiry time)
    const user = await User.findOne({
      email,
      otp,
      otpExpires: { $gt: Date.now() }, // Check OTP hasn't expired
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid/expired OTP" });
    }

    // Update password and clear OTP fields
    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

routes.getAllCompanies = async (req, res) => {
  try {
      const companies = await CompanyProfile.find()
          .populate('userId', 'firstName lastName email') // Assuming you want some user details
          .sort({ createdAt: -1 }); // Newest first
      
      res.status(200).json(companies);
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching companies" });
  }
}

routes.getAllUser = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .lean();

    const planPurchases = await PlanPurchase.find({ isActive: true })
      .populate("plan", "name")
      .populate("user", "_id")
      .lean();

    const planMap = {};
    for (const purchase of planPurchases) {
      if (purchase?.user?._id) {
        planMap[purchase.user._id.toString()] = purchase;
      }
    }

    const enrichedUsers = users.map(user => {
      const userId = user._id.toString();
      const planInfo = planMap[userId];
      return {
        ...user,
        plan: planInfo ? {
          name: planInfo.plan?.name,
          selectedCycle: planInfo.selectedCycle,
          selectedPrice: planInfo.selectedPrice,
          startDate: planInfo.startDate,
          endDate: planInfo.endDate,
          isActive: planInfo.isActive
        } : null
      };
    });

    res.status(200).json({ users: enrichedUsers });

  } catch (error) {
    console.error("Error in getAllUser:", error);
    res.status(500).json({ message: "Error fetching users with plan details", error: error.message });
  }
};


routes.createDesignation = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) return res.status(400).json({ message: "Name is required" });

    const verifyDublicate = await Designation.findOne({ name });
    if (verifyDublicate)
      return res
        .status(400)
        .json({ message: "Same name designation already exists" });

    const newDesignation = new Designation({
      name,
      description,
    });

    await newDesignation.save();

    return res
      .status(201)
      .json({
        message: "Designation created successfully",
        designation: newDesignation,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.deleteDesignation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id)
      return res.status(400).json({ message: "Designation ID is required" });

    const deletedDesignation = await Designation.findByIdAndDelete(id);
    if (!deletedDesignation)
      return res.status(404).json({ message: "Designation not found" });

    return res
      .status(200)
      .json({
        message: "Designation deleted successfully",
        deletedDesignation,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.createBanner = async (req, res) => {
  try {
    const { title, description, isActive } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }
    if (req.files.length > 3) {
      return res
        .status(400)
        .json({ message: "Maximum 3 images allowed per banner set" });
    }

    const verifyDublicate = await Banner.findOne({ title });
    if (verifyDublicate)
      return res
        .status(400)
        .json({ message: "Same title named banner already exists" });

    const imageUrls = await Promise.all(
      req.files.slice(0, 3).map(async (file) => {
        const result = await uploadToCloudinary(file.path, "Banner");
        fs.unlinkSync(file.path);
        return result.secure_url;
      })
    );

    let active = isActive === "true" || isActive === true;

    const totalBanners = await Banner.countDocuments();

    // If it's the first banner, automatically make it active
    if (totalBanners === 0) {
      active = true;
    } else if (active) {
      // If requested to be active, deactivate others
      await Banner.updateMany({ isActive: true }, { $set: { isActive: false } });
    }

    const newBanner = new Banner({
      image: imageUrls,
      title,
      description,
      isActive: active,
    });

    await newBanner.save();

    res.status(201).json({
      message: "Banner set created successfully",
      banner: newBanner,
    });
  } catch (error) {
    console.error("Error creating banner:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

routes.allBanner = async (req, res) => {
  try {
    const banners = await Banner.find();
    res.status(200).json(banners);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.handleBannerStatus = async (req, res) => {
  try {
    const { bannerId } = req.params;

    if (!bannerId) {
      return res
        .status(400)
        .json({ message: "Invalid request: bannerId is required" });
    }

    const banner = await Banner.findById(bannerId);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    // Check if this is the only active banner
    const activeBanners = await Banner.find({ isActive: true });
    const isOnlyActiveBanner =
      activeBanners.length === 1 &&
      activeBanners[0]._id.toString() === bannerId;

    // Toggle logic
    if (banner.isActive) {
      // Trying to deactivate
      if (isOnlyActiveBanner) {
        return res.status(400).json({
          message:
            "At least one banner must remain active. Please activate another banner before deactivating this one.",
        });
      }
      banner.isActive = false;
    } else {
      // Trying to activate - deactivate all others first
      await Banner.updateMany(
        { _id: { $ne: bannerId }, isActive: true },
        { $set: { isActive: false } }
      );
      banner.isActive = true;
    }

    await banner.save();
    return res.status(200).json({
      message: `Banner ${
        banner.isActive ? "activated" : "deactivated"
      } successfully`,
      banner,
    });
  } catch (error) {
    console.error("Error handling banner status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Update Banner (title, description, isActive)
routes.updateBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const { title, description, deletedImages } = req.body; // Add deletedImages

    // 1. Find banner
    const banner = await Banner.findById(bannerId);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    // 2. Handle deleted images (if any)
    if (deletedImages) {
      const deletedUrls = JSON.parse(deletedImages);

      // Delete from Cloudinary
      await Promise.all(
        deletedUrls.map(async (url) => {
          const publicId = url.split("/").pop().split(".")[0];
          await cloudinary.v2.uploader.destroy(`Study-Cafe/${publicId}`);
        })
      );

      // Remove from banner's image array
      banner.image = banner.image.filter((img) => !deletedUrls.includes(img));
    }

    // 3. Handle new uploads (if any)
    if (req.files?.length > 0) {
      // Check 3-image limit AFTER deletions + new uploads
      const totalAfterUpdate = banner.image.length + req.files.length;
      if (totalAfterUpdate > 3) {
        return res.status(400).json({
          message:
            "Max 3 images allowed. Delete more images or reduce uploads.",
        });
      }

      // Upload new images
      const newImages = await Promise.all(
        req.files.map(async (file) => {
          const result = await uploadToCloudinary(file.path);
          fs.unlinkSync(file.path);
          return result.secure_url;
        })
      );
      banner.image.push(...newImages);
    }

    // 4. Update other fields
    if (title) banner.title = title;
    if (description) banner.description = description;

    await banner.save();
    res.status(200).json({
      message: "Banner updated with 3-image limit enforced",
      banner,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

routes.deleteBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;

    // Check how many banners exist
    const totalBanners = await Banner.countDocuments();
    if (totalBanners <= 1) {
      return res.status(400).json({
        message: "At least one banner set must remain. Cannot delete the last one.",
      });
    }

    // 1. Find the banner to be deleted
    const banner = await Banner.findById(bannerId);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    const wasActive = banner.isActive;

    // 2. Delete all associated images from Cloudinary
    const deletionResults = await Promise.all(
      banner.image.map(async (imageUrl) => {
        try {
          const urlParts = imageUrl.split("/");
          const uploadIndex = urlParts.indexOf("upload") + 1;
          if (uploadIndex === 0) {
            return {
              success: false,
              url: imageUrl,
              error: "Invalid URL format",
            };
          }

          const pathAfterUpload = urlParts.slice(uploadIndex).join("/");
          const pathWithoutVersion = pathAfterUpload.replace(/^v\d+\//, "");
          const publicId = pathWithoutVersion.split(".")[0];

          const result = await cloudinary.v2.uploader.destroy(publicId, {
            invalidate: true,
          });

          if (result.result !== "ok") {
            return { success: false, url: imageUrl, error: result.result };
          }

          return { success: true, url: imageUrl, publicId };
        } catch (error) {
          return { success: false, url: imageUrl, error: error.message };
        }
      })
    );

    // 3. Delete the banner from MongoDB
    await Banner.findByIdAndDelete(bannerId);

    // 4. If the deleted banner was active, activate another one (if any)
    const remainingBanners = await Banner.find();
    if (wasActive && remainingBanners.length > 0) {
      await Banner.findByIdAndUpdate(remainingBanners[0]._id, {
        isActive: true,
      });
    }

    res.status(200).json({
      message: "Banner deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting banner:", error);
    res.status(500).json({
      message: "Server error during banner deletion",
      error: error.message,
    });
  }
};


// Create a new category
routes.createCategory = async (req, res) => {
  try {
    const { name, description, parentCategory } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Check for duplicate category name
    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Category with this name already exists" });
    }

    let parent = null;
    if (parentCategory) {
      parent = await Category.findById(parentCategory);
      if (!parent) {
        return res.status(400).json({ message: "Invalid parent category" });
      }
    }

    const newCategory = new Category({
      name: name.trim(),
      description,
      parentCategory: parentCategory || null,
    });

    await newCategory.save();

    res
      .status(201)
      .json({
        message: "Category created successfully",
        category: newCategory,
      });
  } catch (error) {
    console.error("Error creating category:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Category (name, description, isActive)
routes.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, parentCategory } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    if (name) {
      // Check if new name is already taken by another category
      const duplicate = await Category.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });
      if (duplicate) {
        return res
          .status(409)
          .json({ message: "Another category with this name already exists." });
      }
      category.name = name.trim();
    }

    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    if (parentCategory !== undefined) {
      if (parentCategory) {
        const parent = await Category.findById(parentCategory);
        if (!parent) {
          return res.status(400).json({ message: "Invalid parent category" });
        }
        if (parent._id.equals(id)) {
          return res
            .status(400)
            .json({ message: "Category cannot be its own parent" });
        }
        category.parentCategory = parentCategory;
      } else {
        category.parentCategory = null;
      }
    }

    await category.save();

    res
      .status(200)
      .json({ message: "Category updated successfully", category });
  } catch (error) {
    console.error("Error updating category:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

routes.categoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id).populate("parentCategory");
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const subcategories = await Category.find({ parentCategory: id });

    res.status(200).json({
      success: true,
      category,
      subcategories,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res.status(400).json({ message: "Category ID is required" });

    const deletedCategory = await Category.findByIdAndDelete(id);
    if (!deletedCategory)
      return res.status(404).json({ message: "Category not found" });

    res
      .status(200)
      .json({ message: "Category deleted successfully", deletedCategory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.addPosters = async (req, res) => {
  try {
    const { title, description, category, eventDate } = req.body;

    if (!title || !category || !eventDate) {
      return res
        .status(400)
        .json({ message: "Title, description, eventDate, and category are required" });
    }

    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      return res.status(404).json({ message: "Invalid category ID" });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Poster image is required",
      });
    }

    let posterImage = null;
    try {
      const uploadPoster = await uploadToCloudinary(req.file.path, "Posters");
      posterImage = uploadPoster.secure_url;
      fs.unlinkSync(req.file.path);
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to upload profile photo" });
    }

    const newPoster = new Poster({
      image: posterImage,
      title,
      description,
      eventDate,
      category,
    });

    await newPoster.save();
    res
      .status(201)
      .json({ message: "Poster created successfully", poster: newPoster });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.allPosters = async (req, res) => {
  try {
    const posters = await Poster.find()
      .sort({ createdAt: -1 }) // Sort by date descending: newest to oldest
      .populate("category", "name"); // Optional: include category details if needed

    res.status(200).json(posters);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.deletePoster = async (req, res) => {
  try {
    const { posterId } = req.params;

    if (!posterId) {
      return res.status(400).json({ message: "Poster ID is required" });
    }

    const poster = await Poster.findById(posterId);
    if (!poster) {
      return res.status(404).json({ message: "Poster not found" });
    }

    // Extract public_id from the Cloudinary URL
    const imageUrl = poster.image;
    const publicIdMatch = imageUrl.match(
      /\/([^\/]+)\.(jpg|jpeg|png|webp|gif|bmp)$/i
    );

    if (!publicIdMatch || !publicIdMatch[1]) {
      return res
        .status(500)
        .json({
          message: "Could not extract Cloudinary public_id from image URL",
        });
    }

    // Your folder name used during upload
    const folderName = "Study-Cafe/Posters";
    const publicId = `${folderName}/${publicIdMatch[1]}`;

    // Delete image from Cloudinary
    try {
      await cloudinary.v2.uploader.destroy(publicId);
    } catch (cloudErr) {
      console.error("Failed to delete image from Cloudinary:", cloudErr);
      return res
        .status(500)
        .json({ message: "Failed to delete image from Cloudinary" });
    }

    // Delete the poster from MongoDB
    await Poster.findByIdAndDelete(posterId);

    res.status(200).json({ message: "Poster deleted successfully" });
  } catch (error) {
    console.error("Error deleting poster:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Branding Posters
routes.postersForBranding = async (req, res) => {
  try {
    const { title, description, isActive } = req.body;

    if (!title) return res.status(400).json({ message: "Title is required" });

    // Check if images are uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }
    if (req.files.length > 3) {
      return res
        .status(400)
        .json({ message: "Maximum 3 images allowed per banner set" });
    }

    const verifyDublicate = await BrandingPoster.findOne({ title });
    if (verifyDublicate)
      return res
        .status(400)
        .json({ message: "Same title named branding already exists" });

    // Upload all images to Cloudinary
    const imageUrls = await Promise.all(
      req.files.slice(0, 3).map(async (file) => {
        // Ensures only 3 even if frontend sends more
        const result = await uploadToCloudinary(file.path, "Branding-Posters");
        fs.unlinkSync(file.path); // Delete temp file
        return result.secure_url;
      })
    );

    if (isActive === "true" || isActive === true) {
      await BrandingPoster.updateMany(
        { isActive: true },
        { $set: { isActive: false } }
      );
    }

    // Create and save new banner set
    const newBranding = new BrandingPoster({
      image: imageUrls,
      title,
      description,
      isActive: isActive === "true" || isActive === true,
    });

    await newBranding.save();

    res.status(201).json({
      message: "Branding set created successfully",
      banner: newBranding,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.handleBrandingStatus = async (req, res) => {
  try {
    const { posterId } = req.params;

    if (!posterId) {
      return res
        .status(400)
        .json({ message: "Invalid request: posterId is required" });
    }

    const poster = await BrandingPoster.findById(posterId);
    if (!poster) {
      return res.status(404).json({ message: "Poster not found" });
    }

    // Check if this is the only active poster
    const activePosters = await BrandingPoster.find({ isActive: true });
    const isOnlyActivePoster =
      activePosters.length === 1 &&
      activePosters[0]._id.toString() === posterId;

    // Toggle logic
    if (poster.isActive) {
      // Trying to deactivate
      if (isOnlyActivePoster) {
        return res.status(400).json({
          message:
            "At least one branding poster must remain active. Please activate another before deactivating this one.",
        });
      }
      poster.isActive = false;
    } else {
      // Trying to activate - deactivate all others first
      await BrandingPoster.updateMany(
        { _id: { $ne: posterId }, isActive: true },
        { $set: { isActive: false } }
      );
      poster.isActive = true;
    }

    await poster.save();
    return res.status(200).json({
      message: `Branding Poster ${
        poster.isActive ? "activated" : "deactivated"
      } successfully`,
      poster,
    });
  } catch (error) {
    console.error("Error handling branding poster status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.allBrandingPosters = async (req, res) => {
  try {
    const posters = await BrandingPoster.find().sort({ createdAt: -1 }); // Sort by date descending: newest to oldest

    if (posters.length === 0)
      return res.status(404).json({ message: "No branding posters found" });

    res.status(200).json(posters);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.deleteBrandingPoster = async (req, res) => {
  try {
    const { posterId } = req.params;

    // Validate
    if (!posterId) {
      return res.status(400).json({ message: "Poster ID is required" });
    }

    // Count total posters
    const totalPosters = await BrandingPoster.countDocuments();
    if (totalPosters <= 1) {
      return res.status(400).json({
        message: "At least one branding poster must remain. Cannot delete the last one.",
      });
    }

    const poster = await BrandingPoster.findById(posterId);
    if (!poster) {
      return res.status(404).json({ message: "Poster not found" });
    }

    const wasActive = poster.isActive;

    // Delete all associated images from Cloudinary
    const deletionResults = await Promise.all(
      poster.image.map(async (imageUrl) => {
        try {
          const urlParts = imageUrl.split("/");
          const uploadIndex = urlParts.indexOf("upload") + 1;
          if (uploadIndex === 0) {
            return {
              success: false,
              url: imageUrl,
              error: "Invalid URL format",
            };
          }

          const pathAfterUpload = urlParts.slice(uploadIndex).join("/");
          const pathWithoutVersion = pathAfterUpload.replace(/^v\d+\//, "");
          const publicId = pathWithoutVersion.split(".")[0];

          const result = await cloudinary.v2.uploader.destroy(publicId, {
            invalidate: true,
          });

          if (result.result !== "ok") {
            return { success: false, url: imageUrl, error: result.result };
          }

          return { success: true, url: imageUrl, publicId };
        } catch (error) {
          return { success: false, url: imageUrl, error: error.message };
        }
      })
    );

    // Delete the poster
    await BrandingPoster.findByIdAndDelete(posterId);

    // If the deleted poster was active, activate another one
    if (wasActive) {
      const remainingPosters = await BrandingPoster.find().sort({ createdAt: -1 });
      if (remainingPosters.length > 0) {
        await BrandingPoster.findByIdAndUpdate(remainingPosters[0]._id, {
          isActive: true,
        });
      }
    }

    res.status(200).json({
      message: "Branding Poster deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting branding poster:", error);
    res.status(500).json({
      message: "Server error during poster deletion",
      error: error.message,
    });
  }
};

routes.createPlan = async (req, res) => {
  try {
    const { name, billingOptions, categories, taxType, taxPercentage } = req.body;

    if (
      !name ||
      !billingOptions?.monthly ||
      !billingOptions?.yearly ||
      !categories ||
      categories.length === 0
    ) {
      return res.status(400).json({ message: "All required fields are missing" });
    }

    // Validate taxPercentage if taxType is provided
    if (taxType && taxType === "exclusive" && (taxPercentage === undefined || taxPercentage === null)) {
      return res.status(400).json({ message: "Tax percentage is required for exclusive tax type" });
    }

    const newPlan = new Plan({
      name,
      billingOptions,
      categories,
      taxType: taxType || "inclusive", // default to inclusive
      taxPercentage: taxPercentage !== undefined ? Number(taxPercentage) : 0
    });

    await newPlan.save();

    res.status(201).json({
      message: "Plan created successfully",
      plan: newPlan
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};



routes.allPlans = async (req, res) => {
  try {
    const plans = await Plan.find().sort({ createdAt: -1 }).populate("categories", "name"); // Sort by date descending: newest to oldest

    if (plans.length === 0)
      return res.status(404).json({ message: "No plans found" });

    res.status(200).json(plans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.planById = async (req, res) => {
  try {
    const { planId } = req.params;

    if (!planId)
      return res.status(400).json({ message: "Plan ID is required" });

    const plan = await Plan.findById(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    res.status(200).json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { name, billingOptions, categories, isActive, taxType, taxPercentage } = req.body;

    if (!planId) {
      return res.status(400).json({ message: "Plan ID is required" });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    // Update fields
    if (name !== undefined) plan.name = name;
    if (billingOptions?.monthly !== undefined) plan.billingOptions.monthly = billingOptions.monthly;
    if (billingOptions?.yearly !== undefined) plan.billingOptions.yearly = billingOptions.yearly;
    if (categories !== undefined) plan.categories = categories;
    if (isActive !== undefined) plan.isActive = isActive;
    
    // Update tax fields with validation
    if (taxType !== undefined) {
      plan.taxType = taxType;
      // If changing to exclusive and no percentage provided, keep current or default to 0
      if (taxType === "exclusive" && taxPercentage === undefined) {
        plan.taxPercentage = plan.taxPercentage || 0;
      }
    }
    if (taxPercentage !== undefined) {
      // Validate that percentage is a number
      const percentage = Number(taxPercentage);
      if (isNaN(percentage)) {
        return res.status(400).json({ message: "Tax percentage must be a number" });
      }
      plan.taxPercentage = percentage;
    }

    const updatedPlan = await plan.save();

    res.status(200).json({
      message: "Plan updated successfully",
      plan: updatedPlan,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    if (!planId)
      return res.status(400).json({ message: "Plan ID is required" });

    const deletedPlan = await Plan.findByIdAndDelete(planId);
    if (!deletedPlan)
      return res.status(404).json({ message: "Plan not found" });

    res.status(200).json({ message: "Plan deleted successfully", deletedPlan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

routes.allTestimonial = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const testimonials = await Testimonial.find()
      .sort({ rating: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "createdBy",
        select: "profilePhoto firstName lastName designation email",
        populate: {
          path: "designation",
          select: "name"
        }
      });

    const total = await Testimonial.countDocuments();

    res.status(200).json({
      success: true,
      count: testimonials.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: testimonials,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//View all payment 
routes.allPayment = async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

    const payments = await PaymentOrder.find()
      .populate("user", "firstName lastName email")
      .populate("plan", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "Payments fetched", payments });
  } catch (err) {
    console.error("Admin Payments Error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

//View all Purchase
routes.allPurchase = async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });

    const purchases = await PlanPurchase.find()
      .populate("user", "firstName lastName email")
      .populate("plan", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "Purchases fetched", purchases });
  } catch (err) {
    console.error("Admin Purchases Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

routes.purchaseById = async (req, res) => {
  try {
    const { purchaseId } = req.params;

    if (!purchaseId)
      return res.status(400).json({ message: "Purchase ID is required" });

    const purchase = await PlanPurchase.findById(purchaseId)
      .populate("user", "firstName lastName email")
      .populate("plan", "name");

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    res.status(200).json({ message: "Purchase fetched", purchase });
  } catch (err) {
    console.error("Admin Purchase Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

routes.addServices = async (req, res) => {
  try {
    const { title, description, position } = req.body;

    const serviceCount = await Service.countDocuments();
    if (serviceCount >= 3) {
      return res.status(400).json({ message: "Only 3 services are allowed. Please delete an existing one to add a new service." });
    }

    // Check for existing service with same position
    const existing = await Service.findOne({ position });
    if (existing) {
      return res.status(400).json({ message: `A service with position "${position}" already exists.` });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    // Upload all files to Cloudinary
    const imageUrls = [];
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.path, "services");
      imageUrls.push(result.secure_url);

      // Delete local file after upload
      await fs.unlink(file.path);
    }

    // Create and save the service
    const newService = new Service({
      title,
      description,
      position,
      imageSet: imageUrls,
    });

    await newService.save();

    return res.status(201).json({ message: "Service added successfully", service: newService });
  } catch (error) {
    console.error("Error adding services:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

routes.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, position, imagesToRemove } = req.body;

    // Find the existing service
    const existingService = await Service.findById(id);
    if (!existingService) {
      return res.status(404).json({ message: "Service not found" });
    }

    // Check if position is being changed to one that's already taken
    if (position && position !== existingService.position) {
      const positionTaken = await Service.findOne({ position });
      if (positionTaken) {
        return res.status(400).json({
          message: `Position "${position}" is already taken by another service`
        });
      }
    }

    // Check if title is being changed to one that's already taken
    if (title && title !== existingService.title) {
      const titleTaken = await Service.findOne({ title });
      if (titleTaken) {
        return res.status(400).json({
          message: `Title "${title}" is already taken by another service`
        });
      }
    }

    // Properly parse imagesToRemove (can be a string or array)
    let parsedImagesToRemove = [];
    if (imagesToRemove) {
      if (typeof imagesToRemove === "string") {
        try {
          parsedImagesToRemove = JSON.parse(imagesToRemove);
        } catch (err) {
          parsedImagesToRemove = imagesToRemove.split(',').map(s => s.trim());
        }
      } else if (Array.isArray(imagesToRemove)) {
        parsedImagesToRemove = imagesToRemove;
      }
    }

    // Image removal logic
    let updatedImageSet = [...existingService.imageSet];
    if (parsedImagesToRemove.length > 0) {
      console.log("Images to remove (parsed):", parsedImagesToRemove);

      if (updatedImageSet.length - parsedImagesToRemove.length < 3) {
        return res.status(400).json({
          message: "A service must have at least 3 images. Upload new images before removing these."
        });
      }

      for (const imageUrl of parsedImagesToRemove) {
        try {
          const publicId = imageUrl.split('/').pop().split('.')[0];
          const fullPublicId = `Study-Cafe/services/${publicId}`;
          await cloudinary.v2.uploader.destroy(fullPublicId);
        } catch (error) {
          console.error("Error deleting image from Cloudinary:", error);
        }
      }

      updatedImageSet = updatedImageSet.filter(img => !parsedImagesToRemove.includes(img));
      console.log("Updated imageSet after removal:", updatedImageSet);
    }

    // Upload new images if present
    if (req.files && req.files.length > 0) {
      const newImageUrls = [];
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.path, "services");
          newImageUrls.push(result.secure_url);
          await fs.unlink(file.path); // Remove local file
        } catch (error) {
          console.error("Error uploading new image:", error);

          // Clean up uploaded images if error occurs
          for (const url of newImageUrls) {
            try {
              const publicId = url.split('/').pop().split('.')[0];
              await cloudinary.v2.uploader.destroy(`Study-Cafe/services/${publicId}`);
            } catch (cleanupError) {
              console.error("Error cleaning up failed upload:", cleanupError);
            }
          }

          return res.status(500).json({ message: "Error uploading new images" });
        }
      }

      updatedImageSet = [...updatedImageSet, ...newImageUrls];
      console.log("Final imageSet after upload:", updatedImageSet);
    }

    // Final image set check
    if (updatedImageSet.length < 3) {
      return res.status(400).json({
        message: "A service must have at least 3 images"
      });
    }

    // Update service fields
    existingService.title = title || existingService.title;
    existingService.description = description || existingService.description;
    existingService.position = position || existingService.position;
    existingService.imageSet = updatedImageSet;

    await existingService.save();

    return res.status(200).json({
      message: "Service updated successfully",
      service: existingService
    });

  } catch (error) {
    console.error("Error updating service:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


routes.getAllService = async (req, res) => {
  try {
    const services = await Service.find().sort({ position: 1 }); // Sorted by position (optional)

    return res.status(200).json({
      message: "Services fetched successfully",
      services,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

routes.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    return res.status(200).json({
      message: "Service fetched successfully",
      service,
    });
  } catch (error) {
    console.error("Error fetching service by ID:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

routes.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find the service to be deleted
    const serviceToDelete = await Service.findById(id);
    if (!serviceToDelete) {
      return res.status(404).json({ message: "Service not found" });
    }

    // 2. Delete all images from Cloudinary
    const deleteImagePromises = serviceToDelete.imageSet.map(async (imageUrl) => {
      try {
        // Extract public_id from URL (last part without extension)
        const publicId = imageUrl.split('/').pop().split('.')[0];
        const fullPublicId = `Study-Cafe/services/${publicId}`;
        await cloudinary.v2.uploader.destroy(fullPublicId);
      } catch (error) {
        console.error(`Error deleting image ${imageUrl} from Cloudinary:`, error);
        // Continue even if one image fails to delete
      }
    });

    // Wait for all image deletions to complete
    await Promise.all(deleteImagePromises);

    // 3. Delete the service document from MongoDB
    await Service.findByIdAndDelete(id);

    return res.status(200).json({ 
      message: "Service deleted successfully",
      deletedService: {
        id: serviceToDelete._id,
        title: serviceToDelete.title,
        position: serviceToDelete.position
      }
    });

  } catch (error) {
    console.error("Error deleting service:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export default routes;
