import mongoose, { Schema, model }from "mongoose";


const commentSchema = new Schema ({
    userId : {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true 
    },
    parentId : {
        type: mongoose.Types.ObjectId,
        ref: 'Comment',    
    }, 
    referenceId: {
        type: mongoose.Types.ObjectId,
    },  
    text : {
        type: String,
        required: true
    },
    mentionedTo : {
        type: mongoose.Types.ObjectId,
        ref: 'User',

    },
    timestamp : {
        type: Date,
        default: Date.now,
        required: true
    },
})


const Comment = model("Comment", commentSchema);

export default Comment;