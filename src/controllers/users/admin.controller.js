import User from '../../models/user.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Banner from '../../models/banner.model.js';
import Category from '../../models/category.model.js';
import Poster from '../../models/posters.model.js';
import Plan from '../../models/plan.model.js';
import {uploadToCloudinary} from '../../services/cloudinary.js';
import fs from 'fs';
import { sendOTP } from '../../services/nodemailer.js';
import cloudinary from 'cloudinary';


const routes = {}

routes.registerAdmin = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password } = req.body;

        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
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
            role:"admin"
        });

        await newUser.save();

        res.status(201).json({ message: 'Admin created successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}

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
        res.status(500).json({ message: 'Server error' });
    }
} 


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
        console.log("error",error)
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
      otpExpires: { $gt: Date.now() } // Check OTP hasn't expired
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
  
routes.createBanner = async (req, res) => {
  try {
    const { title, description, isActive } = req.body;

    // Check if images are uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }
    if (req.files.length > 3) {
        return res.status(400).json({ message: 'Maximum 3 images allowed per banner set' });
      }

    const verifyDublicate = await Banner.findOne({title});
    if (verifyDublicate) 
        return res.status(400).json({ message: 'Same title named banner already exists' });

    // Upload all images to Cloudinary
    const imageUrls = await Promise.all(
        req.files.slice(0, 3).map(async (file) => { // Ensures only 3 even if frontend sends more
          const result = await uploadToCloudinary(file.path, "Banner");
          fs.unlinkSync(file.path); // Delete temp file
          return result.secure_url;
        })
      );

    // If this set is to be active, deactive others
    if (isActive === 'true' || isActive === true) {
      await Banner.updateMany({ isActive: true }, { $set: { isActive: false } });
    }

    // Create and save new banner set
    const newBanner = new Banner({
      image: imageUrls,
      title,
      description,
      isActive: isActive === 'true' || isActive === true,
    });

    await newBanner.save();

    res.status(201).json({
      message: 'Banner set created successfully',
      banner: newBanner,
    });
  } catch (error) {
    console.error('Error creating banner:',  error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

routes.allBanner = async (req, res) => {
    try {
        const banners = await Banner.find();
        res.status(200).json(banners);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}

routes.handleBannerStatus = async (req, res) => {
    try {
      const { bannerId } = req.params;
      const { action } = req.body; // action can be 'active' or 'deactive'
  
      if (!bannerId || !['active', 'deactive'].includes(action)) {
        return res.status(400).json({ message: "Invalid request: Provide bannerId and valid action (active/deactive)" });
      }
  
      const banner = await Banner.findById(bannerId);
      if (!banner) {
        return res.status(404).json({ message: "Banner not found" });
      }
  
      if (action === "active") {
        // Deactive all other banners
        await Banner.updateMany(
          { _id: { $ne: bannerId }, isActive: true },
          { $set: { isActive: false } }
        );
  
        // active the selected banner
        banner.isActive = true;
        await banner.save();
  
        return res.status(200).json({ message: "Banner actived successfully", banner });
      }
  
      if (action === "deactive") {
        const activeBanners = await Banner.find({ isActive: true });
  
        // Prevent deactivation if it's the only active banner
        if (activeBanners.length === 1 && activeBanners[0]._id.toString() === bannerId) {
          return res.status(400).json({
            message: "At least one banner must remain active. Please active another banner before deactivating this one.",
          });
        }
  
        banner.isActive = false;
        await banner.save();
  
        return res.status(200).json({ message: "Banner deactived successfully", banner });
      }
  
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
      if (!banner) return res.status(404).json({ message: 'Banner not found' });
  
      // 2. Handle deleted images (if any)
      if (deletedImages) {
        const deletedUrls = JSON.parse(deletedImages);
        
        // Delete from Cloudinary
        await Promise.all(
          deletedUrls.map(async (url) => {
            const publicId = url.split('/').pop().split('.')[0];
            await cloudinary.v2.uploader.destroy(`Study-Cafe/${publicId}`);
          })
        );
  
        // Remove from banner's image array
        banner.image = banner.image.filter(img => !deletedUrls.includes(img));
      }
  
      // 3. Handle new uploads (if any)
      if (req.files?.length > 0) {
        // Check 3-image limit AFTER deletions + new uploads
        const totalAfterUpdate = banner.image.length + req.files.length;
        if (totalAfterUpdate > 3) {
          return res.status(400).json({
            message: 'Max 3 images allowed. Delete more images or reduce uploads.'
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
        message: 'Banner updated with 3-image limit enforced',
        banner 
      });
  
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  };

routes.deleteBanner = async (req, res) => {
    try {
        const { bannerId } = req.params;
        if (!bannerId) return res.status(400).json({ message: "Banner ID is required" });

        const deletedBanner = await Banner.findByIdAndDelete(bannerId);
        if (!deletedBanner) return res.status(404).json({ message: "Banner not found" });

        res.status(200).json({ message: "Banner deleted successfully", deletedBanner });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}

// Create a new category
routes.createCategory = async (req, res) => {
    try {
      const { name, description } = req.body;
  
      if (!name) {
        return res.status(400).json({ message: "Category name is required" });
      }
  
      // Check for duplicate category name
      const existing = await Category.findOne({ name: name.trim() });
      if (existing) {
        return res.status(400).json({ message: "Category with this name already exists" });
      }
  
      const newCategory = new Category({
        name: name.trim(),
        description
      });
  
      await newCategory.save();
  
      res.status(201).json({ message: "Category created successfully", category: newCategory });
    } catch (error) {
      console.error("Error creating category:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  };
  
// Update Category (name, description, isActive)
routes.updateCategory = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;
  
      const category = await Category.findById(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found." });
      }
  
      if (name) {
        // Check if new name is already taken by another category
        const duplicate = await Category.findOne({ name: name.trim(), _id: { $ne: id } });
        if (duplicate) {
          return res.status(409).json({ message: "Another category with this name already exists." });
        }
        category.name = name.trim();
      }
  
      if (description !== undefined) category.description = description;
      if (isActive !== undefined) category.isActive = isActive;
  
      await category.save();
  
      res.status(200).json({ message: "Category updated successfully", category });
    } catch (error) {
      console.error("Error updating category:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  };

routes.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ message: "Category ID is required" });

        const deletedCategory = await Category.findByIdAndDelete(id);
        if (!deletedCategory) return res.status(404).json({ message: "Category not found" });

        res.status(200).json({ message: "Category deleted successfully", deletedCategory });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}

routes.addPosters = async (req, res) => {
    try {
        const { title, description, category } = req.body;
        
        if (!title || !category) {
            return res.status(400).json({ message: 'Title, description, and category are required' });
        }

        if (!req.file) {
          return res.status(400).json({ 
              success: false,
              message: 'Poster image is required' 
          });
      }
      
        let posterImage = null;
            try {
                const uploadPoster = await uploadToCloudinary(req.file.path, "Posters")
                posterImage = uploadPoster.secure_url;
                fs.unlinkSync(req.file.path)
            } catch (error) {
                return res.status(500).json({ success: false, message: "Failed to upload profile photo" });
            }

        const newPoster = new Poster({
            image: posterImage,
            title,
            description,
            category
        });

        await newPoster.save();
        res.status(201).json({ message: 'Poster created successfully', poster: newPoster });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}

routes.createPlan = async (req, res) => {
  try {
    const { name, description, price, duration, features } = req.body;

    if (!name || !price || !duration || !Array.isArray(features) || features.length === 0) {
      return res.status(400).json({ message: "Missing some fields or features is empty" });
    }

    const newPlan = new Plan({
      name,
      description,
      price,
      duration,
      features,
    });

    const savedPlan = await newPlan.save();
    res.status(201).json({ message: "Plan created successfully", plan: savedPlan });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}


export default routes;