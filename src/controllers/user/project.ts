import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Project from "../../models/projectModel";
import Task from "../../models/taskModel";
import Workspace from "../../models/workspaceModel";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import AppError from "../../utils/appError";
import AppResponse from "../../utils/appResponse";

export const addNewProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId } = req.params;
    const { title, theme, description } = req.body;

    if (!workspaceId || !title || !theme) {
      return next(
        new AppError(
          "Tile, theme and descriptions are required !",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    // Find Project with same name
    const project = await Project.findOne({
      workspaceId,
      title: new RegExp(`^${title.trim()}$`, "i"), // create a js object like : "title: { $regex: `^${title}$`, $options: 'i' }"
    });

    if (project) {
      return next(
        new AppError("Project with name exist !", HttpStatusCodes.CONFLICT)
      );
    }

    const newProject = new Project({
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      title,
      theme,
    });

    if (description) {
      newProject.description = description;
    }

    await newProject.save();

    new AppResponse(
      res,
      HttpStatusCodes.CREATED,
      "Project created successfully",
      {
        projectId: newProject._id,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const starProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;
    const { action } = req.body;

    if (![0, 1].includes(action)) {
      return next(
        new AppError("Action is requied!", HttpStatusCodes.BAD_REQUEST)
      );
    }

    await Project.findByIdAndUpdate(projectId, {
      starred: action === 1,
    });

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      `Project ${action === 1 ? "starred" : "unstarred"} successfully !`
    );
  } catch (error) {
    next(error);
  }
};

export const getProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId, projectId } = req.params;

    // Retrieve the project details
    const project = await Project.findById(projectId).select(
      "title theme description timestamp starred"
    );

    // Retrieve workspace admin and members
    const workspace = await Workspace.findById(workspaceId)
      .populate({
        path: "collaborators",
        select: "_id username avatar",
      })
      .select("collaborators createdBy");

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "Project page loaded successfully",
      {
        project,
        workspaceMembers: workspace?.collaborators,
        workspaceAdmin: workspace?.createdBy,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const getBurnoutData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;

    // Calculate burn down data for the current week
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Start of the week (Monday)

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of the week (Sunday)

    // Retrieve tasks for the current week
    const tasks: any = await Task.find({
      projectId: new mongoose.Types.ObjectId(projectId as string),
      dueDate: { $gte: startOfWeek, $lte: endOfWeek },
    }).select("status completionDate");

    const burnoutData: { date: string; actualBurnDownData: number }[] = [];

    const totalTasks = tasks.length;
    let remainingTasks = totalTasks;
    const daysInWeek = 7;

    // Calculate the ideal decrement per day
    const idealDecrementPerDay = totalTasks / daysInWeek;

    // Iterate over each day of the current week
    for (
      let date = new Date(startOfWeek);
      date <= endOfWeek;
      date.setDate(date.getDate() + 1)
    ) {
      const currentDate = new Date(date); // Clone the date to avoid mutation

      // Actual burn down logic
      const completedTasksForDay = tasks.filter(
        (task: any) =>
          task.status === "Done" &&
          task.completionDate &&
          new Date(task.completionDate).toDateString() ===
            currentDate.toDateString()
      ).length;

      remainingTasks -= completedTasksForDay;

      burnoutData.push({
        // Format date as YYYY-MM-DD
        date: currentDate.toISOString().split("T")[0],
        // Ensure no negative remaining tasks
        actualBurnDownData: Math.max(remainingTasks, 0),
      });
    }

    burnoutData.sort();

    const burnoutDataWithIdealBurnDownData = burnoutData.map(
      (data: any, index: number) => {
        const day = index + 1;

        const idealRemainingTasks = (
          day === 1 ? totalTasks : totalTasks - day * idealDecrementPerDay
        ).toFixed(2);

        return {
          ...data,
          idealBurnDownData: idealRemainingTasks,
        };
      }
    );

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "Burnout data loaded successfully",
      {
        burnoutData: burnoutDataWithIdealBurnDownData,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const getTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId, projectId } = req.params;
    const {
      search,
      date,
      dateFrom,
      dateUpto,
      status,
      priority,
      sortBy,
      order,
    } = req.query;

    const query: any = {
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      projectId: new mongoose.Types.ObjectId(projectId as string),
    };

    // Handle: Search
    if (search) {
      let searchPattern = search as string;

      // Check if search starts with '#' and remove it
      if (searchPattern.startsWith("#")) {
        searchPattern = searchPattern.slice(1);
      }

      query.$or = [
        { title: new RegExp(searchPattern, "i") },
        { tags: new RegExp(searchPattern, "i") },
      ];
    }

    // Handle: Filter
    if (dateFrom && dateUpto) {
      const startDate = new Date(dateFrom as string);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateUpto as string);
      endDate.setHours(23, 59, 59, 999);

      query.dueDate = { $gte: startDate, $lte: endDate };
    } else {
      if (date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startOfNextMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          1
        );

        if (date === "today") {
          query.dueDate = { $gte: today, $lt: tomorrow };
        } else if (date === "thisweek") {
          query.dueDate = { $gte: tomorrow, $lt: endOfWeek };
        } else if (date === "thismonth") {
          query.dueDate = { $gte: startOfMonth, $lt: startOfNextMonth };
        }
      }
    }

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    const sortOptions: any = {};

    // Handle: Sort
    if (sortBy) {
      sortOptions[sortBy as string] = parseInt(order as string);
    } else {
      sortOptions.timestamp = -1;
    }

    const tasks = await Task.find(query)
      .populate({
        path: "assignee",
        select: "username avatar",
      })
      .select("_id title status labels dueDate priority")
      .sort(sortOptions);

    new AppResponse(res, HttpStatusCodes.OK, "Tasks loaded successfully", {
      tasks,
    });
  } catch (error) {
    next(error);
  }
};

export const editProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId, projectId } = req.params;

    const { title, theme, description } = req.body;

    if (!title || !theme) {
      return next(
        new AppError(
          "Title and theme is required !",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const project = await Project.findOne({
      _id: { $ne: new mongoose.Types.ObjectId(projectId as string) },
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      title: new RegExp(`^${title.trim()}$`, "i"),
    });

    if (project) {
      return next(
        new AppError(
          "Project with the same name already exist !",
          HttpStatusCodes.CONFLICT
        )
      );
    }

    await Project.findByIdAndUpdate(projectId, {
      title,
      theme,
      description,
    });

    new AppResponse(res, HttpStatusCodes.OK, "Project updated successfully!");
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId, projectId } = req.params;

    if (!projectId) {
      return next(
        new AppError("Invalid project ID", HttpStatusCodes.BAD_REQUEST)
      );
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return next(new AppError("Project not found", HttpStatusCodes.NOT_FOUND));
    }

    await Task.deleteMany({
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      projectId: new mongoose.Types.ObjectId(projectId as string),
    });

    await Project.findByIdAndDelete(projectId);

    new AppResponse(res, HttpStatusCodes.OK, "Project deleted succesfully");
  } catch (error) {
    next(error);
  }
};

// export const getProject = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         const { workspaceId, projectId } = req.params;

//         // 1. Retrieve the project details
//         const project = await Project.findById(projectId).select('title theme description timestamp starred');

//         // 2. Retrieve workspace members
//         const workspaceMembers = await Workspace.findById(workspaceId)
//             .populate({
//                 path: 'collaborators',
//                 select: '_id username avatar',
//             })
//             .select('collaborators');

//         // 3. Calculate burnout data for the current week
//         const today = moment().startOf('day');
//         const startOfWeek = moment().startOf('isoWeek'); // Start of the current week (Monday)
//         const endOfWeek = moment().endOf('isoWeek'); // End of the current week (Sunday)

//         const tasks = await Task.find({
//             projectId: projectId,
//             timestamp: { $gte: startOfWeek.toDate(), $lte: endOfWeek.toDate() }
//         }).select('status timestamp');

//         const burnoutData: { date: string, remainingTasks: number }[] = [];

//         // Initialize the week with the total task count
//         let remainingTasks = tasks.length;

//         // Iterate over each day of the current week
//         for (let date = moment(startOfWeek); date.isSameOrBefore(endOfWeek); date.add(1, 'days')) {
//             // Count tasks that are not done as of this day
//             const remainingTasksForDay = tasks.filter(task => {
//                 return moment(task.timestamp).isSameOrBefore(date) && task.status !== 'Done';
//             }).length;

//             burnoutData.push({
//                 date: date.format('YYYY-MM-DD'),
//                 remainingTasks: remainingTasksForDay,
//             });

//             // Update the remaining task count
//             remainingTasks = remainingTasksForDay;
//         }

//         // 4. Send the response with project details and burnout data
//         new AppResponse(res, HttpStatusCodes.OK, 'Project page loaded successfully', {
//             project,
//             workspaceMembers: workspaceMembers?.collaborators,
//             burnoutData
//         });

//     } catch (error) {
//         next(error);
//     }
// };
