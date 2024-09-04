import mongoose, { Schema, model } from "mongoose";

const likeSchema = new Schema ({
    userId : {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true 
    },
    referenceId: {
        type: mongoose.Types.ObjectId,
        ref: 'Program',
        required: true 
    },
})


const Like = model("Like", likeSchema);

export default Like;