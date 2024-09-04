import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Workspace from "../../models/workspaceModel";
import User from "../../models/userModel";
import Project from "../../models/projectModel";
import Task from "../../models/taskModel";
import AppResponse from "../../utils/appResponse";
import { HttpStatusCode } from "axios";


export const getHome = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {userId} = req.body;

        const user = await User.findById(userId);

        const result = {
            totalWorkspaces: 0,
            newInvitations: 0,
            totalProjects: 0
        }; 

        // Find workspaces with current user
        const allWorkspaces = await Workspace.aggregate([
            { $match: { collaborators: new mongoose.Types.ObjectId(userId as string) } },
            { $project: {_id: 1}}
        ]);
        const workspaceIds = allWorkspaces.map((workspace: any) => workspace._id);

        // Find Number of projects
        const numOftotalProjects = await Project.find({workspaceId: {$in: workspaceIds}}).countDocuments();
                  
        // Find number of invitations pending
        const newInvitations = await Workspace.aggregate([
            {
                $match: {
                    invitations: {
                        $elemMatch: {
                            email: user?.email,
                            status: 'pending'
                        }
                    }
                }
            },
            {
                $count: 'count'
            }
        ]);

        result.totalWorkspaces = allWorkspaces.length || 0
        result.newInvitations = newInvitations[0]?.count || 0
        result.totalProjects = numOftotalProjects || 0    

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (7 - today.getDay()));


        // Find tasks based on status and due
        const taskAnalytics = await Task.aggregate ([
            {
                $facet: {
                    taskStatusCounts: [
                        {
                            $match: {workspaceId: {$in: workspaceIds}}
                        },
                        {
                            $group: {_id: '$status', count: {$sum: 1}}
                        }
                    ],
                    tasksDueToday: [
                        {
                            $match: {
                                workspaceId: {$in: workspaceIds},
                                dueDate: {
                                    $gte: today,
                                    $lt: tomorrow
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                workspaceId: 1,
                                projectId: 1
                            }
                        }
                    ],
                    tasksDueTomorrow: [
                        {
                            $match: {
                                workspaceId: {$in: workspaceIds},
                                dueDate: {
                                    $gte: tomorrow,
                                    $lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                workspaceId: 1,
                                projectId: 1
                            }
                        }
                    ],
                    tasksDueThisWeek: [
                        {
                            $match: {
                                workspaceId: {$in: workspaceIds},
                                dueDate: {
                                    $gte: tomorrow,
                                    $lt: endOfWeek
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                workspaceId: 1,
                                projectId: 1
                            }
                        }
                    ]
                }
            }
        ])
        const taskStatusCounts: any = {
            'Not Started': 0,
            'In Progress': 0,
            'Stuck': 0,
            'Done': 0
        };

        taskAnalytics[0].taskStatusCounts.forEach((status: any) => {
            taskStatusCounts[status._id] = status.count;
        });

        const tasks = {
            tasksDueToday:  taskAnalytics[0]?.tasksDueToday,
            tasksDueTomorrow:  taskAnalytics[0]?.tasksDueTomorrow,
            tasksDueThisWeek: taskAnalytics[0]?.tasksDueThisWeek
        }

        new AppResponse(res, HttpStatusCode.Ok, 'Home page loaded', {
            result,
            taskStatusCounts,
            tasks
        });        
        
    } catch (error) {
        next (error)
    }
}

