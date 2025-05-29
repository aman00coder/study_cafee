import mongoose from 'mongoose'

const ServiceSchema = new mongoose.Schema({
    title:{
        type:String,
        required: [true, "Service title is required"],
        trim: true,
        unique: true
    },
    description: {
        type: String,
        required: [true, "Service description is required"],
        trim: true
    },
    imageSet:{
        type: [String],
        required: [true, "Service images are required"],
        validate: {
            validator: function(v) {
                return v && v.length > 2;
            },
            message: "At least three image is required"
        }
    },
    position:{
        type: String,
        enum: ["top", "bottom", "center"],
        required: [true, "Service position is required"]
    }
})

const Service = mongoose.model('Service', ServiceSchema);
export default Service;