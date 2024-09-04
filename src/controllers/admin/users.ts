import { Request, Response, NextFunction } from "express"
import User from "../../models/userModel";
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import AppResponse from "../../utils/appResponse";

export const getUsers = async (req: Request, res:Response, next: NextFunction) => {
    try {         
        const { page = '1', search = '', role, status, sortby, order } = req.query;
         
        const pageNumber = parseInt(page as string, 10);  
        const limitNumber = 10;
        
        const query: any = {};
 
         // Handle: Search
         if (search) {
            query.$or = [
                { username: new RegExp(search as string, 'i') },
                { email: new RegExp(search as string, 'i') },
            ];
         }  

         //Handle: Filter
         if (role) {
            query.role = role;
         }           
         if (status) {
            query.blocked = status === 'blocked';
         }
          
         const sortOptions: any = {};
         
         // Handle: Sort
         if (sortby) {
            sortOptions[sortby as string] = order === 'desc' ? -1 : 1;
         }
 
         // Execute query
        const users = await User.find(query, '_id avatar username email blocked role')
        .sort(sortOptions)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

        // Give serial numbers
        const usersWithSerialNumbers = users.map((user, index) => ({
            ...user.toObject(),
            slno: (pageNumber - 1) * limitNumber + index + 1,
        }));
         
        // Count the total number of users matching the query
        const totalUsers = await User.countDocuments(query);
        
        new AppResponse(res, HttpStatusCodes.OK, 'Users loaded successfully', {
            users: usersWithSerialNumbers,
            totalUsers,
            totalPages: Math.ceil(totalUsers / limitNumber),
            currentPage: pageNumber
        });

    } catch (error) {
        next (error)
    }
}


export const blockUser = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {userId} = req.params;
        const {action} = req.body;
        

        if (!userId || !['block', 'unblock'].includes(action)) {
            return next(new AppError('Invalid userId or action', HttpStatusCodes.BAD_REQUEST));           
        }

        await User.findByIdAndUpdate(userId, {blocked: action === 'block' ? true : false});

        new AppResponse(res, HttpStatusCodes.OK, `User ${action === 'block' ? 'blocked' : 'unblocked'} successfully !`); 

    } catch (error) {
        next (error)
    }
}


export const changeRole = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {userId} = req.params;
        const {role} = req.body;
        

        if (!userId || !['regular', 'teamlead'].includes(role)) {
            return next(new AppError('Invalid userId or role', HttpStatusCodes.BAD_REQUEST));         
        }

        await User.findByIdAndUpdate(userId, {role: role});

        new AppResponse(res, HttpStatusCodes.OK, "Users's role changed successfully");
               
    } catch (error) {
        next (error)
    }
}