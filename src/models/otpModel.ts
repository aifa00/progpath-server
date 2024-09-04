import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true    
    },
    otp: {
        type: String,
        required: true 
    },
    createdAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    expiresAt: {
        type: Date,
    },
});

// pre-save hook to calculate the expiry time
otpSchema.pre('save', function (next) {

    const createdAt = this.createdAt;
    const expiresAt = new Date(createdAt);
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    this.expiresAt = expiresAt;
    
    next();

});

const OtpVerification= mongoose.model("OTP", otpSchema);

export default OtpVerification;