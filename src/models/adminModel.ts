import { Schema, model } from "mongoose"

const  adminSchema = new Schema({
    username: {
        type: String,
    },
    email: {
        type: String,
    },
    password: {
        type: String,
    },
    token: {
        type: String,     
    }
});

const Admin = model('Admin', adminSchema);

export default Admin;