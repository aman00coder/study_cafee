import User from '../../models/user.model.js';
import Banner from '../../models/banner.model.js';
import Category from '../../models/category.model.js';
import Poster from '../../models/posters.model.js';
import Designation from '../../models/designation.model.js';
import Testimonial from '../../models/testimonails.model.js';
import PlanPurchase from '../../models/planPurchase.model.js'
import BrandingPoster from '../../models/brandingPosters.model.js';
import CompanyProfile from '../../models/companyProfile.js';
import bcrypt from 'bcrypt';
import { sendOTP } from '../../services/nodemailer.js';
import jwt from 'jsonwebtoken';
import { uploadToCloudinary } from '../../services/cloudinary.js';
import cloudinary from 'cloudinary';
import fs from 'fs';

const routes = {};

// Generate OTP (now inside this file)
// const generateOTP = () => {
//     return Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
// };

const pendingUsers = new Map();

routes.registerUser = async (req, res) => {
    try {
        const { firstName, lastName, designation, email, phone, password } = req.body;
    
    if (!firstName || !lastName || !designation || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
        return res.status(409).json({ success: false, message: "Email or Phone already exists" });
    }

    console.log("File", req.file)
    let profilePhotoUrl = null;
    if (req.file) {
        try {
            const uploadPhoto = await uploadToCloudinary(req.file.path, "Profile-photos")
            profilePhotoUrl = uploadPhoto.secure_url;
            fs.unlinkSync(req.file.path); 
    
            console.log("Profile", profilePhotoUrl)
        } catch (error) {
            return res.status(500).json({ success: false, message: "Failed to upload profile photo" });
        }
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    const hashedPassword = await bcrypt.hash(password, 10);


    // Save temporarily
    pendingUsers.set(email, {
        userData: { firstName, lastName, designation, email, phone, password: hashedPassword, profilePhoto: profilePhotoUrl },
        otp,
        otpExpires
    });

    await sendOTP(email, otp);

    return res.status(200).json({ success: true, message: "OTP sent. Please verify to complete registration." });
    } 
    catch (error) {
        console.error('Registration Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to register user', error: error.message });
    }
};


// Send OTP (separate endpoint)
// routes.sendOTP = async (req, res) => {
//     try {
//         const { email } = req.body;

//         if (!email) {
//             return res.status(400).json({ 
//                 success: false,
//                 message: 'Email is required' 
//             });
//         }

//         const user = await User.findOne({ email });
//         if (!user) {
//             return res.status(404).json({ 
//                 success: false,
//                 message: "User not found" 
//             });
//         }

//         if (user.isVerified) {
//             return res.status(400).json({ 
//                 success: false,
//                 message: "User already verified" 
//             });
//         }

//         const otp = generateOTP(); // Using local function
//         const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

//         user.otp = otp;
//         user.otpExpires = otpExpires;
//         await user.save();

//         await sendOTP(email, otp);

//         res.status(200).json({ 
//             success: true,
//             message: 'OTP sent successfully',
//             data: { email }
//         });
//     } catch (error) {
//         console.error('OTP Sending Error:', error);
//         res.status(500).json({ 
//             success: false,
//             message: 'Failed to send OTP',
//             error: error.message 
//         });
//     }
// }


// Verify OTP (unchanged)
routes.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const pending = pendingUsers.get(email);
        if (!pending) return res.status(404).json({ message: "No pending registration found." });
    
        if (Number(otp) !== pending.otp || pending.otpExpires < Date.now()) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }
    
        const newUser = new User(pending.userData);
        newUser.isVerified = true;
        await newUser.save();
    
        pendingUsers.delete(email); // Clean up after success
    
        return res.status(201).json({ message: "User registered and verified successfully" });
    } 
    catch (error) {
        console.error('OTP Verification Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify OTP', error: error.message });
    }
};


// Login (unchanged)
routes.loginUser = async (req, res) => {
    try {
        const { email, phone, password } = req.body;

        if ((!email && !phone) || !password) {
            return res.status(400).json({ message: "Email/Phone and Password required" });
        }

        const user = await User.findOne({ $or: [{ email }, { phone }] });
        if (!user) return res.status(401).json({ message: "Invalid credentials" });
        if (!user.isVerified) return res.status(403).json({ message: "Verify email first" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        const profile = await CompanyProfile.findOne({ userId: user._id });

        const isFilled = profile?.isFilled || false;

        const token = jwt.sign(
            { _id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                _id: user._id,
                email: user.email,
                role: user.role,
                isFilled
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
}

routes.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const otp = Math.floor(100000 + Math.random() * 900000);
        const otpExpires = Date.now() + 10 * 60 * 1000;

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        await sendOTP(user.email, otp); // Reuse your nodemailer function

        return res.status(200).json({ message: "OTP sent to your email." });
    } catch (error) {
        console.error("Forgot Password OTP Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

routes.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword)
            return res.status(400).json({ message: "All fields are required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.otp !== Number(otp) || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        return res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

routes.allDesignation = async (req, res) => {
    try {
        const designation = await Designation.find({});
        if (!designation) return res.status(404).json({ message: "No designations found" });

        return res.status(200).json({ message: "Designations fetched successfully", designation });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

routes.addCompany = async (req, res) => {
    try {
      const {
        name,
        companyName,
        companyAddress,
        companyPhoneNumber,
        companyEmail,
        companyWebsite
      } = req.body;
  
      const userId = req.user?._id || req.body.userId; // depending on your auth logic
  
      if (!userId || !name || !companyName || !companyAddress || !companyPhoneNumber || !companyEmail || !companyWebsite || !req.file) {
        return res.status(400).json({ message: "All fields including logo are required." });
      }
  
      // Upload logo to Cloudinary
      const uploadResult = await uploadToCloudinary(req.file.path, 'Company-Logos');
  
      // Clean up local file
      fs.unlinkSync(req.file.path);
  
      // Create company profile
      const newCompanyProfile = new CompanyProfile({
        userId,
        name,
        companyName,
        companyAddress,
        companyPhoneNumber,
        companyEmail,
        companyWebsite,
        companyLogo: uploadResult.secure_url,
        isFilled: true
      });
  
      const savedProfile = await newCompanyProfile.save();
  
      res.status(201).json({
        message: "Company profile created successfully.",
        data: savedProfile
      });
  
    } catch (error) {
      console.error("Error in addCompany:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };

  routes.getCompanyById = async (req, res) => {
    try {
        const company = await CompanyProfile.findById(req.params.id)
            .populate('userId', 'firstName lastName email');
        
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }
        
        res.status(200).json(company);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching company" });
    }
}

routes.getCompanyByUserId = async (req, res) => {
    try {
        const company = await CompanyProfile.findOne({ userId: req.user._id })
            .populate('userId', 'firstName lastName email');
        
        if (!company) {
            return res.status(404).json({ message: "Company not found for this user" });
        }
        
        res.status(200).json(company);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching company" });
    }
}

routes.updateUserProfile = async (req, res) => {
    try {
        const userId = req.user._id; // assuming user is authenticated
    const { firstName, lastName, phone } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Handle profile photo update
    if (req.file) {
      const profilePhoto = req.file;

      // ✅ Delete existing photo from Cloudinary if exists
      if (user.profilePhoto) {
        const urlParts = user.profilePhoto.split("/");
        const fileName = urlParts[urlParts.length - 1].split(".")[0];
        const folder = urlParts[urlParts.length - 2];
        const publicId = `${folder}/${fileName}`;

        await cloudinary.v2.uploader.destroy(publicId);
      }

      // ✅ Upload new profile photo
      const uploaded = await uploadToCloudinary(profilePhoto.path);
      fs.unlinkSync(profilePhoto.path); // delete local file

      user.profilePhoto = uploaded.secure_url;
    }

    // ✅ Update other fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;

    await user.save();

    res.status(200).json({ message: "Profile updated successfully", user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}
    
routes.getUserProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        // Fetch user data
        const user = await User.findById(userId).select('-password')
        .populate("designation","name"); // Exclude password
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        // Fetch user's testimonials (sorted by latest first)
        const testimonials = await Testimonial.find({ createdBy: userId })
            .sort({ createdAt: -1 }) // Newest first
            .select('subject rating description createdAt'); // Only include necessary fields

        return res.status(200).json({ 
            success: true,
            message: "User profile fetched successfully",
            data: {
                user,
                testimonials: testimonials.length ? testimonials : null, // Return null if no reviews
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false,
            message: "Internal Server Error" 
        });
    }
};

routes.getBannerSet = async (req, res) => {
    try {
        const bannerSet = await Banner.findOne({ isActive: true });
        if (!bannerSet) return res.status(404).json({ message: "No active banner set found" });

        return res.status(200).json({ message: "Banner set fetched successfully", bannerSet });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

routes.getAllCategory = async (req, res) => {
    try {
      // Step 1: Fetch all categories
      const categories = await Category.find({}).lean(); // Use .lean() for better performance
  
      if (!categories.length) {
        return res.status(404).json({ message: "No categories found" });
      }
  
      // Step 2: Create a map of categories by ID
      const categoryMap = {};
      categories.forEach(cat => {
        cat.subcategories = []; // prepare field to hold nested subcategories
        categoryMap[cat._id.toString()] = cat;
      });
  
      // Step 3: Organize into nested structure
      const nestedCategories = [];
  
      categories.forEach(cat => {
        if (cat.parentCategory) {
          const parentId = cat.parentCategory.toString();
          if (categoryMap[parentId]) {
            categoryMap[parentId].subcategories.push(cat);
          }
        } else {
          // Top-level (parent) category
          nestedCategories.push(cat);
        }
      });
  
      res.status(200).json({
        message: "Categories fetched successfully",
        categories: nestedCategories
      });
  
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Internal Server error" });
    }
  };
  

routes.postersByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const categoryExists = await Category.findById(categoryId);
        if (!categoryExists) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        const posters = await Poster.find({ 
            category: categoryId,
            isActive: true
        }).populate('category', 'name');

        if (posters.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No posters found for this category',
                posters: []
            });
        }

        res.status(200).json({
            message: 'Posters retrieved successfully',
            count: posters.length,
            posters
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

routes.postersById = async (req, res) => {
    try {
        const { posterId } = req.params;

        console.log("Poster ID:", posterId)
        const poster = await Poster.findById(posterId).populate('category', 'name');
        if (!poster) return res.status(404).json({ message: "Poster not found" });

        return res.status(200).json({ message: "Poster fetched successfully", poster });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

routes.getBrandingSet = async (req, res) => {
    try {
        const brandingSet = await BrandingPoster.findOne({ isActive: true });
        if (!brandingSet) return res.status(404).json({ message: "No active branding set found" });

        return res.status(200).json({ message: "Branding set fetched successfully", brandingSet });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

routes.allPlans = async (req, res) => {
    try {
        const plans = await Plan.find({});
        if (!plans) return res.status(404).json({ message: "No plans found" });

        return res.status(200).json({ message: "Plans fetched successfully", plans });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

routes.addTestimonoal = async (req, res) => {
    try {
        const userId = req.user._id;
        const { subject, rating, description} = req.body;

        if (!subject || !rating || !description) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ 
                success: false,
                message: "Rating must be between 1 and 5" 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if the user has already submitted a testimonial
        const existingTestimonial = await Testimonial.findOne({ createdBy: userId });
        if (existingTestimonial) {
            return res.status(400).json({
                success: false,
                message: "You have already submitted a testimonial"
            });
        }

        const testimonial = new Testimonial({
            createdBy: userId,
            subject,
            rating,
            description,
        });

        await testimonial.save();

        res.status(201).json({
            message: "Testimonial submitted successfully",
            testimonial,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

routes.getTestimonialById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate if id is a valid MongoDB ObjectId
        if (!id ) {
            return res.status(400).json({ message: "Invalid testimonial ID" });
        }

        const testimonial = await Testimonial.findById(id)
        .populate({
        path: "createdBy",
        select: "profilePhoto firstName lastName designation email",
        populate: {
          path: "designation",
          select: "name"
        }}) // optional populate

        if (!testimonial) {
            return res.status(404).json({ message: "Testimonial not found" });
        }

        res.status(200).json(testimonial);
    } catch (error) {
        console.error("Error fetching testimonial by ID:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

routes.getTestimonialByUserId = async (req,res) =>{
    try {

        const userId = req.params.id;
        
        const testimonial = await Testimonial.find({ createdBy: userId })
        .populate({
        path: "createdBy",
        select: "profilePhoto firstName lastName designation email",
        populate: {
          path: "designation",
          select: "name"
        }})

        if (!testimonial) {
            return res.status(404).json({ message: "Testimonial not found" });
        }

        res.status(200).json(testimonial);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

routes.updateTestimonial = async (req, res) => {
    try {
        const { testimonialId } = req.params;
        const { subject, rating, description } = req.body;
        const userId = req.user._id;

        const testimonial = await Testimonial.findById(testimonialId);
        if (!testimonial) return res.status(404).json({ message: "Testimonial not found" });

        if (testimonial.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ 
                success: false,
                message: "Unauthorized: You can only update your own testimonials" 
            });
        }

        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({ 
                success: false,
                message: "Rating must be between 1 and 5" 
            });
        }

        if (subject) testimonial.subject = subject;
        if (rating) testimonial.rating = rating;
        if (description) testimonial.description = description;

        await testimonial.save();

        return res.status(200).json({ message: "Testimonial updated successfully", testimonial });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

routes.deleteTestimonial = async (req, res) => {
    try {
        const { testimonialId } = req.params;
        const userId = req.user._id;

        // Fetch the testimonial first
        const testimonial = await Testimonial.findById(testimonialId);

        if (!testimonial) {
            return res.status(404).json({ message: "Testimonial not found" });
        }

        // Check if the current user is the creator
        if (testimonial.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You can only delete your own testimonials"
            });
        }

        // Proceed to delete
        await Testimonial.findByIdAndDelete(testimonialId);

        return res.status(200).json({ message: "Testimonial deleted successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


routes.downloadPoster = async (req, res) => {
  try {
    const userId = req.user._id;
    const { posterId } = req.params;

    const today = new Date();

    // Step 1: Check for active plan
    const activePlan = await PlanPurchase.findOne({
      user: userId,
      startDate: { $lte: today },
      endDate: { $gte: today },
    }).populate('plan');

    if (!activePlan || !activePlan.plan) {
      return res.status(200).json({ allowed: false });
    }

    // Step 2: Get categories from plan
    const allowedCategoryIds = activePlan.plan.categories.map(id => id.toString());

    // Step 3: Include sub-categories under allowed categories
    const subCategories = await Category.find({ parentCategory: { $in: allowedCategoryIds } });
    const allCategoryIds = [
      ...allowedCategoryIds,
      ...subCategories.map(sub => sub._id.toString()),
    ];

    // Step 4: Get poster and check if category is allowed
    const poster = await Poster.findById(posterId);
    if (!poster || !poster.category || !allCategoryIds.includes(poster.category.toString())) {
      return res.status(200).json({ allowed: false });
    }

    // ✅ Poster is allowed
    return res.status(200).json({ allowed: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

     
export default routes;