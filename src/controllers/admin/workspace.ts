import { Request, Response, NextFunction } from "express"
import Workspace from "../../models/workspaceModel";
import Project from "../../models/projectModel";
import Task from "../../models/taskModel";
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import AppResponse from "../../utils/appResponse";

export const getWorkspaces = async (req: Request, res:Response, next: NextFunction) => {
  try {
    const { page = '1', search = '', startDate, endDate, sortBy, order } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = 10;

    const match: any = {};

    // Handle: Serach
    if (search) {
      match.title = { $regex: search, $options: 'i' };
    }

    // Handle: Filter
    if (startDate && endDate) {
      match.timestamp = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      };
    }
    
    const sortOptions: any = {
      timeStamp: -1
    };

    // Handle: Sort
    if (sortBy) {
      const sortOrder = order === 'desc' ? -1 : 1;

      if (sortBy === 'title') {
        sortOptions.title = sortOrder;
      } else if (sortBy === 'admin') {              
        sortOptions['createdBy.username'] = sortOrder;
      } else if (sortBy === 'date') {
        sortOptions.timestamp = sortOrder;
      } else if (sortBy === 'numOfCollaborators') {
        sortOptions.collaboratorsCount = sortOrder;
      } else if (sortBy === 'numOfProjects') {
        sortOptions.projectsCount = sortOrder;
      } else if (sortBy === 'numOfTasks') {
        sortOptions.tasksCount = sortOrder;
      }
    }

    
    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy'
        }
      },
      {$unwind: '$createdBy'},
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: 'workspaceId',
          as: 'projects'
        }
      },
      {
        $lookup: {
          from: 'tasks',
          localField: '_id',
          foreignField: 'workspaceId',
          as: 'tasks'
        }
      },
      {
        $addFields: {
          collaboratorsCount: { $size: '$collaborators' },
          projectsCount: { $size: '$projects' },
          tasksCount: { $size: '$tasks' },
        }
      },
      {
        $sort: sortOptions
      },
      {
        $skip: (pageNumber - 1) * limitNumber
      },
      {
        $limit: limitNumber
      },
      {
        $project: {
          title: 1,
          'createdBy.username': 1,
          collaboratorsCount: 1,
          type: 1,                
          projectsCount: 1,
          tasksCount: 1,
          freezed: 1,
          timestamp: 1,
        }
      }
    ];
    
    const workspaces = await Workspace.aggregate(pipeline);
    
    // Give serial number
    const workspacesWithSlno = workspaces.map((workspace, index) => (
      {
        ...workspace,
        slno: (pageNumber - 1) * limitNumber + index + 1
      }
    ))


    const totalWorkspaces = await Workspace.countDocuments(match);
    const total_workspaces = await Workspace.countDocuments();
    const total_projects = await Project.countDocuments();
    const total_tasks = await Task.countDocuments();

    const analytics = {
      total_workspaces,
      total_projects,
      total_tasks
    }

    new AppResponse(res, HttpStatusCodes.OK, 'Workspace loaded successfully', {
      analytics,
      workspaces: workspacesWithSlno,
      totalPages: Math.ceil(totalWorkspaces / limitNumber),
      totalWorkspaces
    });

  } catch (error) {
    next (error);
  }
}


export const freezWorkspace = async (req: Request, res:Response, next: NextFunction) => {
  try {
    const {workspaceId} = req.params;
    const {action} = req.body;    

    if (!workspaceId || !['freez', 'unfreez'].includes(action)) {
      return next(new AppError('Invalid workspaceId or action', HttpStatusCodes.BAD_REQUEST));       
    }

    await Workspace.findByIdAndUpdate(workspaceId, {freezed: action === 'freez' ? true : false});

    new AppResponse(res, HttpStatusCodes.OK, `Workspace ${action === 'freez' ? 'freezed' : 'unfreezed'} successfully !`);    
      
  } catch (error) {
      next (error)
  }
}
