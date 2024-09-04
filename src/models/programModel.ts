import mongoose, { Schema, model } from "mongoose";

const programSchema = new Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    images: [
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
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true        
    },
    features: {
        type: String,        
        required: true
    },
    languages: {
        type: String,    
        required: true       
    },
    frameworks: {
        type: String,           
    },
    technologies: {
        type: String,           
    },
    highlights: {
        type: String,     
    },
    collaborators: {
        type: String,       
    },
    contact: {
        type: String,
    },
    status: {
        type: String,
        enum: ['pending', 'rejected', 'accepted'],
        default: 'pending'           
    },
    rejectedMessage: {
        type: String,   
    },
    random: {
        type: Number,
        default: Math.random
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const Program = model('Program', programSchema);

export default Program;