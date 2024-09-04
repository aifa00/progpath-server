import { Request, Response, NextFunction} from "express";
import mongoose from "mongoose";
import Workspace from "../../models/workspaceModel";
import User from "../../models/userModel";
import { sendInvitation } from "../../utils/sendInvitation";
import Project from "../../models/projectModel";
import Task from "../../models/taskModel";
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import currentPremiumMembership from "../../utils/CheckCurrentPremiumMembership";
import AppResponse from "../../utils/appResponse";



export const getWorkspace = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {userId} = req.body;
        const user = await User.findById(userId);

        if (!user) {
            return next(new AppError('User not found', HttpStatusCodes.NOT_FOUND));
        }

        const datas = await Workspace.aggregate([
            {
                $facet: {
                    workspaces: [
                        {
                            $match: {collaborators: new mongoose.Types.ObjectId(userId as string)}                
                        },
                        {
                            $sort: {timestamp: -1}
                        },
                        {
                            $project: {_id: 1, title: 1}
                        }
                    ],
                    invitations: [
                        {
                            $unwind: '$invitations'
                        },
                        {
                            $match: {'invitations.email': user?.email, 'invitations.status': 'pending'}               
                        },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'createdBy',
                                foreignField: '_id',
                                as: 'admin'
                            }
                        },  
                        {
                            $sort : {'invitations.timestamp': -1}
                        },      
                        {
                            $project: {
                                _id: 1, 
                                workspaceAdmin: { $arrayElemAt: ['$admin.username', 0] },
                                title: 1,
                                'invitations._id': 1,    
                                'invitations.status': 1, 
                                'invitations.timestamp': 1
                            }
                        }
                    ],                    
                }
            }
        ]);
        
        const result = {
            workspaces: datas[0].workspaces,            
            invitations: datas[0].invitations
        }        
        
        
        new AppResponse(res, HttpStatusCodes.OK, 'Workspace page loaded', {
            result
        });
        
    } catch (error) {         
        next (error)
    }
}

export const addWorkspace = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {userId, title, type, description, emails} = req.body;
        
        const numOfFreeWorkspaces =2;

        const numOfFreeCollaborators = 2;

        if (!title || !type) return next(new AppError('Title and Type is required !', HttpStatusCodes.BAD_REQUEST))

        // Check for premium membership and allowed workspaces
        const numOfCurrentWorkspaces = await Workspace.countDocuments ({createdBy: new mongoose.Types.ObjectId(userId as string)});

        const premiumMembership =  await currentPremiumMembership(userId);

        if (numOfCurrentWorkspaces >= numOfFreeWorkspaces && !premiumMembership) {
            return next(new AppError("You have reached the limit for free workspaces. Please upgrade to a premium plan to create additional workspaces.", 
                HttpStatusCodes.UNAUTHORIZED,
                {
                    isPremiumUser: false,
                    notify: true
                }
            ))
        }

        //Check for premium membership and allowed collaborators
        if (emails.length >= numOfFreeCollaborators && !premiumMembership) {
            return next(new AppError(`You cannot add morethan ${numOfFreeCollaborators} collaborators. Please upgrade to a premium plan to add more collaborators.`, HttpStatusCodes.UNAUTHORIZED, {
                isPremiumUser: false,
                notify: true
            }))
        }

        //Check for workspace with same title
        const workspace = await Workspace.findOne({
            createdBy: new mongoose.Types.ObjectId(userId as string),
            title: new RegExp(`^${title.trim()}$`, 'i')
        });
        
        if (workspace) return next(new AppError("Workspace with this name already exist !", HttpStatusCodes.CONFLICT))
        
        // Create invitations array from emails array
        const  invitations = emails.map((email: string) => ({
            email,
            status: 'pending'
        }));
 
        const newWorkspace = new Workspace({
            title,
            type,
            createdBy: new mongoose.Types.ObjectId(userId as string),
            collaborators: [new mongoose.Types.ObjectId(userId as string)],
        });

        if (description) newWorkspace.description = description;
        if (emails.length > 0) newWorkspace.invitations = invitations;
        
        //Create new workspace
        await newWorkspace.save();
    
        const workspaceId = newWorkspace._id;

        if (emails.length > 0) {            
            const workspaceTitle = title;
            const sender = req.body.username;

            //Send invitation mails if emails are found while adding workspace
            sendInvitation(res, emails, workspaceTitle, workspaceId, sender, next);
        } else {
            new AppResponse(res, HttpStatusCodes.OK, 'Workspace created succcessfully', {
                workspace: {
                    _id: workspaceId,
                    title
                }
            });            
        }
     
    } catch (error) {
        next (error);
    }
}


export const sendInvitations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { emails, userId } = req.body;
        const { workspaceId } = req.params;
        const numOfFreeCollaborators = 2;

        if (!emails || !workspaceId) {
            return next(new AppError('Please enter email to send invitations!', HttpStatusCodes.BAD_REQUEST));
        }

        if (emails.length === 0) {
            return next(new AppError('Please provide emails to send invitation!', HttpStatusCodes.BAD_REQUEST));            
        }

        const workspace: any = await Workspace.findById(workspaceId).populate('createdBy');
        
        if (!workspace) {
            return next(new AppError("Workspace not found!", HttpStatusCodes.NOT_FOUND));
        }

        // Check for premium membership
        const premiumMembership = await currentPremiumMembership(userId);

        if (workspace.invitations.length >= numOfFreeCollaborators && !premiumMembership) {
            return next(new AppError("You have reached the limit for free collaborators. Please upgrade to a premium plan to add more collaborators.", 
                HttpStatusCodes.UNAUTHORIZED, 
                {
                    isPremiumUser: false,
                    notify: true
                }
            ));
        }

        // Create invitations array from emails
        const invitations = emails.map((email: string) => ({
            email,
            status: 'pending'
        }));
    
        workspace.invitations.push(...invitations);

        // Save the updated workspace
        await workspace.save();

        const workspace_id = workspace._id;
        const workspaceTitle = workspace.title;
        const sender = workspace.createdBy.username;

        sendInvitation(res, emails, workspaceTitle, workspace_id, sender, next);

    } catch (error) {
        next(error);
    }
};



export const invitationAction = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {userId, workspaceId, invitationId, action } = req.body;

        const updateQuery: any = {
            $set: {
                'invitations.$[invitation].status': action
            }
        };

        const arrayFilters = [{ 'invitation._id': new mongoose.Types.ObjectId(invitationId) }];

        if (action === 'accepted') {
            updateQuery['$push'] = { collaborators: userId };
        }

        const result = await Workspace.updateOne(
            { _id: workspaceId },
            updateQuery,
            { arrayFilters }
        );

        if (result.modifiedCount === 0) {
            return next(new AppError('Invitation not found or already updated', HttpStatusCodes.NOT_FOUND));         
        }

        new AppResponse(res, HttpStatusCodes.OK, `Invitation ${action} successfully!`); 
          
    } catch (error) {
        next (error)
    }
}


export const getSingleWorkspace = async (req: Request, res:Response, next: NextFunction) => {
    try {  
        const {workspaceId} = req.params;        

        const workspace = await Workspace.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(workspaceId as string)
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'collaborators',
                    foreignField: '_id',
                    as: 'collaborators'
                }
            },
            {
                $addFields: {
                    invitations: {
                        $filter: {
                            input: '$invitations',
                            as: 'invitation',
                            cond: { $in: ["$$invitation.status", ['pending', 'rejected']]}
                        }
                    },
                }
            },
            {
                $project: {             
                    'createdBy.password' : 0,                    
                    'createdBy.blocked': 0,
                    'createdBy.verified': 0,
                    'createdBy.role': 0,
                    'createdBy.token': 0,
                    'collaborators.password': 0,
                    'collaborators.blocked': 0,
                    'collaborators.verified': 0,
                    'collaborators.role': 0,
                    'collaborators.token': 0,
                }
            }
        ]);

        const projects = await Project.find({workspaceId: new mongoose.Types.ObjectId(workspaceId as string)}, {workspaceId: 0}).sort({timestamp: -1});
      
        new AppResponse(res, HttpStatusCodes.OK, 'Workspace loaded successfully', {
            workspace: workspace[0],
            projects
        });        

    } catch (error) {            
        next (error)
    }
}


export const editWorkspace = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {workspaceId} = req.params;

        const {userId, title, type, description} = req.body;

        if (!title || !type) {
            return next(new AppError('Title and type is required !', HttpStatusCodes.BAD_REQUEST));            
        }

        const workspace = await Workspace.findOne({
            _id: {$ne: new mongoose.Types.ObjectId(workspaceId as string)},
            createdBy: new mongoose.Types.ObjectId(userId as string),
            title: new RegExp(`^${title.trim()}$`, 'i'),            
        });

        if (workspace) {
            return next(new AppError('Workspace with same name already exist!', HttpStatusCodes.CONFLICT));
        }
        

        await Workspace.findByIdAndUpdate(workspaceId, {
            title,
            type,
            description
        });

        new AppResponse(res, HttpStatusCodes.OK, 'Workspace updated successfully');        

    } catch (error) {
        next (error)
    }
}

export const cancelInvitation = async (req: Request, res:Response, next: NextFunction) => {
    try {

        const {workspaceId, invitationId} = req.params

        if (!workspaceId || !invitationId) {
            return next(new AppError('Workspace id and invitation id are required !', HttpStatusCodes.BAD_REQUEST));
        }

        await Workspace.findByIdAndUpdate(workspaceId, {
            $pull: { invitations: { _id: invitationId } }
        })

        new AppResponse(res, HttpStatusCodes.OK, 'Invitation cancelled successfully!');        
        
    } catch (error) {
        next (error)
    }
}

export const removeCollaborator = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {workspaceId, collaboratorId} = req.params

        if (!workspaceId || !collaboratorId) {
            return next(new AppError('Workspace id and collaborator id are required !', HttpStatusCodes.BAD_REQUEST));
        }

        await Workspace.findByIdAndUpdate(workspaceId, {
            $pull: { collaborators: new mongoose.Types.ObjectId(collaboratorId as string) }
        })

        new AppResponse(res, HttpStatusCodes.OK, 'Collaborator removed successfully!');        
        
    } catch (error) {
        next (error)
    }
}


export const getInvitationsSend = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {workspaceId} = req.params

        const workspace = await Workspace.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(workspaceId as string)
                }
            },
            {
                $addFields: {
                    invitations: {
                        $filter: {
                            input: '$invitations',
                            as: 'invitation',
                            cond: { $in: ["$$invitation.status", ['pending', 'rejected']]}
                        }
                    },
                }
            },
            {
                $project: {             
                    invitations: 1
                }
            }
        ]);

        const invitations = workspace[0]?.invitations || [];

        new AppResponse(res, HttpStatusCodes.OK, 'Invitations retrieved successfully', {
            invitations
        });        
        
    } catch (error) {
        next (error)
    }
}

export const deleteWorkspace = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {workspaceId} = req.params;

        if (!workspaceId) {
            return next(new AppError('Invalid workspace ID', HttpStatusCodes.BAD_REQUEST));
        }

        const workspace = await Workspace.findById(workspaceId);

        if (!workspace) {
            return next(new AppError('Workspace not found', HttpStatusCodes.NOT_FOUND));           
        }

        await Task.deleteMany({
            workspaceId: new mongoose.Types.ObjectId(workspaceId as string)
        })

        await Project.deleteMany({
            workspaceId: new mongoose.Types.ObjectId(workspaceId as string)
        })

        await Workspace.findByIdAndDelete(workspaceId);

        new AppResponse(res, HttpStatusCodes.OK, 'Workspace deleted successfully'); 

    } catch (error) {
        next (error)
    }
}