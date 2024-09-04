import { Schema, model }from "mongoose";

const subscriptionPlanSchema = new Schema ({
    title : {
        type: String,
        required: true
    },
    price : {
        type: Number,
        required: true
    },    
    durationValue : {
        type: Number,
        required: true
    },
    durationType : {
        type: String,
        enum: ['day', 'month', 'year'],
        required: true
    },
    active : {
        type: Boolean,
        default: false,
        required: true
    }
})


const SubscriptionPlan = model("SubscriptionPlan", subscriptionPlanSchema);

export default SubscriptionPlan;