import mognoose from 'mongoose';

const categorySchema = new mognoose.Schema({
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });