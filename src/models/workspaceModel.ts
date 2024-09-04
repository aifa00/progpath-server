import mongoose, {Schema, model } from "mongoose"

const  workspaceSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    createdBy: { 
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true     
    },
    collaborators: [
        {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        }
    ],
    type: {
        type: String,
        enum: ['engineering', 'business', 'sales', 'project', 'education'],
        required: true
    },
    description: {
        type: String,        
    },
    invitations: [
        {
            email: {
                type: String,
                required: true,
            },
            status: {
                type: String,
                enum: ['pending', 'accepted', 'rejected'],
                required: true,                
            },
            timestamp: {
                type: Date,
                default: Date.now()
            }
        }
    ],
    freezed: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now()
    }
});

const Workspace = model('Workspace', workspaceSchema);

export default Workspace;