import mongoose, { Schema, model }from "mongoose";

const subscriptionPlanSchema = new Schema ({
    userId : {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true 
    },
    planTitle: {
        type: String,
        required: true
    },
    startDate : {
        type: Date,
        required: true
    },    
    endDate : {
        type: Date,
        required: true
    },
    amountPaid : {
        type: Number,
        required: true
    }, 
    timestamp : {
        type: Date,
        default: Date.now,
        required: true
    },
})


const UserSubscription = model("UserSubscription", subscriptionPlanSchema);

export default UserSubscription;