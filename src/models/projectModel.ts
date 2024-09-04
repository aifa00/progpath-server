import mongoose, {Schema, model } from "mongoose"

const  projectSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
    },
    workspaceId: { 
        type: mongoose.Types.ObjectId,
        ref: 'Workspace',
        required: true     
    },
    theme: {
        type: String,        
        required: true
    },
    starred: {
        type: Boolean,            
    },   
    timestamp: {
        type: Date,
        default: Date.now()
    }
});

const Project = model('Project', projectSchema);

export default Project;