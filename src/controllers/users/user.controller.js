import User from '../../models/user.model.js';
import Banner from '../../models/banner.model.js';
import Category from '../../models/category.model.js';
import Poster from '../../models/posters.model.js';
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
        const { firstName, lastName, email, phone, password } = req.body;
    
    if (!firstName || !lastName || !email || !phone || !password) {
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
        userData: { firstName, lastName, email, phone, password: hashedPassword, profilePhoto: profilePhotoUrl },
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
                role: user.role
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

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        return res.status(200).json({ message: "User profile fetched successfully", user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

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
        const categories = await Category.find({});
        if (!categories) return res.status(404).json({ message: "No categories found" });

        return res.status(200).json({ message: "Categories fetched successfully", categories });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server error" });
    }
}

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
    
export default routes;