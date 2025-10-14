import mongoose from 'mongoose';

const crickDummyMailSchema = new mongoose.Schema({
    email:{
        type:String,
        required:true,
        unique:true
    }
})

const CrickDummyMail = mongoose.model('CrickDummyMail', crickDummyMailSchema);

export default CrickDummyMail;