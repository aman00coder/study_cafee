import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    profilePhoto:{
        type: String,
    },
    firstName: {
        type: String,
        required: [true, "First name is required"],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, "Last name is required"],
        trim: true
    },
    designation:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Designation",
        required: [true, "Designation is required"]
    },
    city:{
        type: String,
        required: [true, "City is required"],
        trim: true
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please fill a valid email address"]
    },
    phone: {
        type: String,
        required: [true, "Phone number is required"],
        unique: true,
        trim: true
    },
    role: {
        type: String,
        enum: ["admin", "user"],
        default: "user"
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters"]
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    otp: {
        type: Number,
    },
    otpExpires: {
        type: Date,
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password; // Never send password in responses
            delete ret.__v; // Remove version key
            return ret;
        }
    }
});

const User = mongoose.model("User", userSchema);
export default User;