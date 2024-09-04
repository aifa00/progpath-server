import { NextFunction, Request, Response } from "express";
import Workspace from "../models/workspaceModel";
import mongoose from "mongoose";
import AppError from "../utils/appError";
import HttpStatusCodes from "../enums/httpStatusCodes";


export const isTeamlead = async (req:Request, res:Response, next:NextFunction) => {
    try {
        const  {role} = req.body;    

        if (role !== 'teamlead') {
            return next(new AppError('Unauthorized! not a teamlead', HttpStatusCodes.UNAUTHORIZED))
        }

        next();
    } catch (error) {
        next();
    }
};

export const authorizeTeamlead = async (req:Request, res:Response, next:NextFunction) => {
    try {
        const  {workspaceId} = req.params;
        const  {userId} = req.body;

        const workspace = await Workspace.findById(workspaceId).select('createdBy freezed')

        if (!workspace) {
            return next(new AppError('Forbidden! workspace does not exist to authorize teamlead', HttpStatusCodes.FORBIDDEN))
        }

        //Check is this current workspace admin
        if ( (!(workspace.createdBy as mongoose.Types.ObjectId).equals(new mongoose.Types.ObjectId(userId as string)))) {
            return next(new AppError('Unauthorized! not the admin of current workspace!', HttpStatusCodes.UNAUTHORIZED));            
        }

        //Check whether worksapce is freezed
        if (workspace.freezed) {
            return next (new AppError("Unauthorized ! can't perform operations in current workspace, workspace is temporarily freezed!", 
                HttpStatusCodes.UNAUTHORIZED, 
                {
                    notify: true
                }
            ))  
        }

        next();
    } catch (error) {
        next();
    } 
};

