import User from '../../models/user.model.js';
import bcrypt from 'bcrypt';
import { sendOTP } from '../../services/nodemailer.js';
import jwt from 'jsonwebtoken';

const routes = {};

// Generate OTP (now inside this file)
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
};

const pendingUsers = new Map();

routes.registerUser = async (req, res) => {
    const { username, firstName, lastName, email, phone, password } = req.body;
    if (!username || !firstName || !lastName || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
        return res.status(409).json({ success: false, message: "Email or Phone already exists" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save temporarily
    pendingUsers.set(email, {
        userData: { username, firstName, lastName, email, phone, password: hashedPassword },
        otp,
        otpExpires
    });

    await sendOTP(email, otp);

    return res.status(200).json({ success: true, message: "OTP sent. Please verify to complete registration." });
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

export default routes;