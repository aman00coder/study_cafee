import mongoose from 'mongoose'

const companyProfileSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    companyName: {
        type: String,
        required: true,
        trim: true
    },
    companyLogo: {
        type: String,
        required: true
    },
    companyAddress: {
        type: String,
        required: true
    },
    companyWebsite: {
        type: String,
        required: true
    },
    companyGST:{
        type: String
    },
    isFilled: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

const CompanyProfile = mongoose.model('CompanyProfile', companyProfileSchema)
export default CompanyProfile