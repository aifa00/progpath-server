import { Schema, model} from "mongoose";

const  userSchema = new Schema({
    username: {
        type: String,
    },
    email: {
        type: String,
    },
    password: {
        type: String,
    },
    avatar: {
        type: String,
    },
    verified: {
        type: Boolean,
        default: false,
        required: true,
    },
    blocked: {
        type: Boolean,
        default: false,
        required: true,
    },
    role: {
        type: String,
        enum:['regular', 'teamlead'],
        default: 'regular',
        required: true,
    },
    token: {
        type: String,
    },
    timestamp : {
        type: Date,
        default: Date.now
    }
})

const User = model('User', userSchema);

export default User;