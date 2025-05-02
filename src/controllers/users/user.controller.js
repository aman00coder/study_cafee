import User from '../../models/user.model.js';
import bcrypt from 'bcrypt';
import { sendOTP } from '../../services/nodemailer.js';
import jwt from 'jsonwebtoken';
import { generateOTP } from '../../utils/helpers.js';

const routes = {};

// Register User
routes.registerUser = async (req, res) => {
    try {
        const { username, firstName, lastName, email, phone, password } = req.body;

        // Validate required fields
        if (!username || !firstName || !lastName || !email || !phone || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'All fields are required' 
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }],
        });
        
        if (existingUser) {
            return res.status(409).json({ 
                success: false,
                message: "Email or Phone already exists" 
            });
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
            username,
            firstName,
            lastName,
            email,
            phone,
            password: hashedPassword,
        });

        await newUser.save();

        res.status(201).json({ 
            success: true,
            message: 'User registered successfully. Please verify your email.',
            data: {
                userId: newUser._id,
                email: newUser.email
            }
        });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error during registration',
            error: error.message 
        });
    }
}

// Send OTP
routes.sendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false,
                message: 'Email is required' 
            });
        }

        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        if (user.isVerified) {
            return res.status(400).json({ 
                success: false,
                message: "User is already verified" 
            });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        await sendOTP(email, otp);

        res.status(200).json({ 
            success: true,
            message: 'OTP sent successfully',
            data: {
                email: user.email,
                otpExpires: otpExpires
            }
        });
    } catch (error) {
        console.error('OTP Sending Error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to send OTP',
            error: error.message 
        });
    }
}

// Verify OTP
routes.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ 
                success: false,
                message: 'Email and OTP are required' 
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        if (user.isVerified) {
            return res.status(400).json({ 
                success: false,
                message: "User is already verified" 
            });
        }

        if (user.otp !== Number(otp) || user.otpExpires < Date.now()) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid or expired OTP" 
            });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.status(200).json({ 
            success: true,
            message: "Email verification successful",
            data: {
                email: user.email,
                isVerified: true
            }
        });
    } catch (error) {
        console.error('OTP Verification Error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error during OTP verification",
            error: error.message 
        });
    }
}

// Login User
routes.loginUser = async (req, res) => {
    try {
        const { email, phone, password } = req.body;

        if ((!email && !phone) || !password) {
            return res.status(400).json({ 
                success: false,
                message: "Email/Phone and Password are required" 
            });
        }

        // Find user by email or phone
        const user = await User.findOne({
            $or: [
                { email: email?.toLowerCase() },
                { phone }
            ]
        });

        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid credentials" 
            });
        }

        // Check if user is verified
        if (!user.isVerified) {
            return res.status(403).json({ 
                success: false,
                message: "Please verify your email first" 
            });
        }

        // Match password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid credentials" 
            });
        }

        // Generate JWT token
        const payload = {
            _id: user._id,
            email: user.email,
            role: user.role,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        });

        // Omit sensitive data from response
        const userData = {
            _id: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isVerified: user.isVerified
        };

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token,
                user: userData
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error during login",
            error: error.message 
        });
    }
}

export default routes;