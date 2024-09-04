import mongoose, { Schema, model } from "mongoose"


const  taskSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    workspaceId: {
        type: mongoose.Types.ObjectId,
        ref: 'Workspace',
        required: true     
    },
    projectId: { 
        type: mongoose.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    description: {
        type: String,        
    },
    status: {
        type: String,
        default: 'Not Started',
        enum: ['Not Started', 'In Progress', 'Done', 'Stuck']
    },
    startDate: {
        type: Date,
    },
    dueDate: {
        type: Date,
    },
    completionDate: {
        type: Date,
    },
    labels:[
        {
            text: {
                type: String,                
            },
            theme: {
                type: String
            }
        }
    ],
    attachments: [
        {
            originalName: {
                type: String
            },
            key: {
                type: String
            },
            type: {
                type: String
            }
        }
    ],
    assignee: [
        {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        }
    ],
    reporter: [
        {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        }
    ], 
    tags: [String],
    priority: {
        type: String,
        enum: ['', 'Low', 'Medium', 'High'],
    },
    storyPoints: {
        type: Number
    },   
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const Task = model('Task', taskSchema);

export default Task;