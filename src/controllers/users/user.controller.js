import User from '../../models/user.model.js';
import bcrypt from 'bcrypt';
import { sendOTP } from '../../services/nodemailer.js';
import jwt from 'jsonwebtoken';

const routes = {}

routes.registerUser = async (req, res) => {
    try {
        const { username, firstName, lastName, email, phone, password } = req.body;

        if(!username || !firstName || !lastName || !email || !phone || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if the user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }],
          });
          if (existingUser)
            return res.status(401).json({ message: "Email or Phone already exist" });

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        // Create a new user
        const newUser = new User({
            username,
            firstName,
            lastName,
            email,
            phone,
            password: hashedPassword,
            otp,
            otpExpires,
        });

        await newUser.save();
    await sendOTP(email, otp);


        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}

routes.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.isVerified) return res.status(400).json({ message: "Already verified" });

        if (user.otp !== Number(otp) || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.status(200).json({ message: "Verification successful" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}


routes.loginUser = async (req, res) => {
    try {
        const { email, phone, password } = req.body;

        if ((!email && !phone) || !password) {
            return res.status(400).json({ message: "Email or Phone and Password are required" });
        }

        // Find user by email or phone
        const existingUser = await User.findOne({
            $or: [
                { email: email?.toLowerCase() },{ phone }
            ]
        });

        if (!existingUser) {
            return res.status(401).json({ message: "User not found" });
        }

        // Check if user is verified
        if (!existingUser.isVerified) {
            return res.status(403).json({ message: "User not verified" });
        }

        // Match password
        const isMatch = await bcrypt.compare(password, existingUser.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid password" });
        }

        // Generate token
        const payload = {
            _id: existingUser._id,
            email: existingUser.email,
            role: existingUser.role,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        });

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                _id: existingUser._id,
                username: existingUser.username,
                firstName: existingUser.firstName,
                lastName: existingUser.lastName,
                email: existingUser.email,
                phone: existingUser.phone,
                role: existingUser.role,
            },
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
}

export default routes;