import Admin from '../../models/user.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Banner from '../../models/banner.model.js';
import cloudinaru from 'cloudinary';
import {uploadToCloudinary} from '../../services/cloudinary.js';
import fs from 'fs';


const routes = {}

routes.registerAdmin = async (req, res) => {
    try {
        const { username, firstName, lastName, email, phone, password } = req.body;

        // Check if the user already exists
        const existingUser = await Admin.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const newUser = new Admin({
            username,
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

    const existingAdmin = await Admin.findOne({ email });
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


routes.createBanner = async (req, res) => {
  try {
    const { title, description, isActive } = req.body;

    // Check if images are uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }

    // Upload all images to Cloudinary
    const uploadPromises = req.files.map(async (file) => {
      const result = await uploadToCloudinary(file.path);
      fs.unlinkSync(file.path); // Remove local file
      return result.secure_url;
    });

    const uploadedImageUrls = await Promise.all(uploadPromises);

    // If this set is to be active, deactivate others
    if (isActive === 'true' || isActive === true) {
      await Banner.updateMany({ isActive: true }, { $set: { isActive: false } });
    }

    // Create and save new banner set
    const newBanner = new Banner({
      image: uploadedImageUrls,
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
        const banners = await Banner.find({});
        res.status(200).json(banners);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}

routes.handleBannerStatus = async (req, res) => {
    try {
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}

export default routes;