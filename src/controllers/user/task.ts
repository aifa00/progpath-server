import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Task from "../../models/taskModel";
import { v4 as uuidv4 } from "uuid";
import Comment from "../../models/commentModel";
import {
  deleteFileFromS3,
  getPreSignedUrl,
  uploadFilesToS3,
} from "../../utils/S3Utils";
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import AppResponse from "../../utils/appResponse";

export const getTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId, projectId, taskId } = req.params;

    if (!workspaceId || !projectId || !taskId) {
      return next(
        new AppError(
          "Workspace Id, Project Id and Task Id is required !",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const task: any = await Task.findById(taskId)
      .populate({
        path: "reporter",
        select: "_id username avatar",
      })
      .populate({
        path: "assignee",
        select: "_id username avatar",
      });

    if (!task) {
      return next(
        new AppError("Task not exist", HttpStatusCodes.BAD_REQUEST, {
          notify: true,
        })
      );
    }

    // Get ataachment's urls
    const attachmentsWithUrls = await Promise.all(
      task?.attachments?.map(async (file: any) => {
        const url = await getPreSignedUrl(file.key);
        return { ...file._doc, imageUrl: url };
      })
    );

    // Replace atachments array
    const currentTask = {
      ...task.toObject(),
      attachments: attachmentsWithUrls,
    };

    const comments = await Comment.aggregate([
      {
        $match: { referenceId: new mongoose.Types.ObjectId(taskId as string) },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: "$userDetails",
      },
      {
        $project: {
          _id: 1,
          text: 1,
          timestamp: 1,
          userDetails: {
            _id: 1,
            username: 1,
            avatar: 1,
          },
        },
      },
    ]);

    new AppResponse(res, HttpStatusCodes.OK, "Task loaded usccessfully", {
      task: currentTask,
      comments,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadAttachments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { taskId } = req.params;
    const files = (req as any).files;

    if (!files || files.length === 0) {
      return next(new AppError("No files found", HttpStatusCodes.NOT_FOUND));
    }

    const folder = "attachment";

    const uploadedFiles = await uploadFilesToS3(files, folder);

    const task = await Task.findById(taskId);

    if (!task) {
      return next(new AppError("Task not found", HttpStatusCodes.NOT_FOUND));
    }

    task.attachments.push(...uploadedFiles);

    await task.save();

    // Get urls of uploaded files
    const attachmentsWithUrls: any = await Promise.all(
      uploadedFiles.map(async (file: any) => {
        const url = await getPreSignedUrl(file.key);
        return { _id: uuidv4(), ...file, imageUrl: url };
      })
    );

    new AppResponse(
      res,
      HttpStatusCodes.CREATED,
      "Files uploaded and task updated successfully",
      {
        files: attachmentsWithUrls,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const deleteAttachment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attachmentKey, taskId } = req.params;

    // Delete file from S3
    await deleteFileFromS3(attachmentKey);

    // Delete file from database
    await Task.findByIdAndUpdate(taskId, {
      $pull: { attachments: { key: attachmentKey } },
    });

    new AppResponse(res, HttpStatusCodes.OK, "Attachment deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const addNewTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId, projectId } = req.params;
    const {
      title,
      description,
      labels,
      assignee,
      reporter,
      status,
      startDate,
      dueDate,
      priority,
      tags,
      storyPoints,
    } = req.body;
    const files = (req as any).files;
    const folder = "attachment";

    if (!title) {
      return next(
        new AppError(
          "Title is required to create task",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const task = await Task.findOne({
      workspaceId,
      projectId,
      title: new RegExp(`^${title.trim()}$`, "i"), // create a js object like : "title: { $regex: `^${title}$`, $options: 'i' }"
    });

    if (task) {
      return next(
        new AppError("Task with name exist !", HttpStatusCodes.CONFLICT)
      );
    }

    //Upload files to s3 if exist
    let uploadedFiles: {}[] = [];

    if (files.length > 0) {
      uploadedFiles = await uploadFilesToS3(files, folder);
    }

    // Handle adding task with status "Done"
    const completionDate = status === "Done" ? new Date() : null;

    const newTask = new Task({
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      projectId: new mongoose.Types.ObjectId(projectId as string),
      title: title.trim(),
      description,
      attachments: uploadedFiles,
      labels: JSON.parse(labels).map((l: any) => ({
        text: l.text,
        theme: l.theme,
      })),
      assignee: JSON.parse(assignee).map(
        (a: any) => new mongoose.Types.ObjectId(a._id as string)
      ),
      reporter: JSON.parse(reporter).map(
        (a: any) => new mongoose.Types.ObjectId(a._id as string)
      ),
      status: status,
      startDate,
      dueDate,
      completionDate,
      priority,
      tags: JSON.parse(tags),
      storyPoints: parseInt(storyPoints) || null,
    });

    await newTask.save();

    new AppResponse(res, HttpStatusCodes.CREATED, "Task added successfully");
  } catch (error) {
    next(error);
  }
};

export const editTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId, projectId, taskId } = req.params;
    const {
      title,
      description,
      labels,
      assignee,
      reporter,
      status,
      startDate,
      dueDate,
      priority,
      tags,
      storyPoints,
    } = req.body;

    if (!title) {
      return next(
        new AppError("Title is required", HttpStatusCodes.BAD_REQUEST)
      );
    }

    // Check for task with same name
    const taskExist = await Task.findOne({
      _id: { $ne: new mongoose.Types.ObjectId(taskId as string) },
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      projectId: new mongoose.Types.ObjectId(projectId as string),
      title: new RegExp(`^${title.trim()}$`, "i"),
    });

    if (taskExist) {
      return next(
        new AppError(
          "Task with the same name already exist !",
          HttpStatusCodes.CONFLICT
        )
      );
    }

    const task: any = await Task.findById(taskId);

    task.title = title.trim();
    task.description = description;
    task.labels = labels.map((l: any) => ({ text: l.text, theme: l.theme }));
    task.assignee = assignee.map(
      (a: any) => new mongoose.Types.ObjectId(a._id as string)
    );
    task.reporter = reporter.map(
      (a: any) => new mongoose.Types.ObjectId(a._id as string)
    );
    task.status = status;
    task.startDate = startDate;
    task.dueDate = dueDate;
    task.priority = priority;
    task.tags = tags;
    task.storyPoints = storyPoints || null;

    // If status is "Done", set completionDate to current date
    if (status === "Done") {
      if (task.status !== "Done") {
        task.completionDate = new Date();
      }
    }

    await task.save();

    new AppResponse(res, HttpStatusCodes.OK, "Task updated successfully");
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    const task: any = await Task.findById(taskId);

    // If status is "Done", set completionDate to current date
    if (status === "Done") {
      if (task.status !== "Done") {
        task.completionDate = new Date();
      }
    }

    // Update status of the task
    task.status = status;

    await task.save();

    new AppResponse(res, HttpStatusCodes.OK, "Status updated successfully");
  } catch (error) {
    next(error);
  }
};

export const updatePriority = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { taskId } = req.params;
    const { priority } = req.body;

    //update status of the task
    await Task.findByIdAndUpdate(taskId, { priority });

    new AppResponse(res, HttpStatusCodes.OK, "Priority updated successfully");
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);

    if (!task) {
      return next(new AppError("Task not found!", HttpStatusCodes.NOT_FOUND));
    }

    const attachments = task?.attachments;

    // Delete related attachments from s3
    if (attachments && attachments.length > 0) {
      await Promise.all(
        attachments.map(async (file) => {
          await deleteFileFromS3(file.key);
        })
      );
    }

    // Delete related comments
    await Comment.deleteMany({
      referenceId: new mongoose.Types.ObjectId(taskId as string),
    });

    await Task.findByIdAndDelete(taskId);

    new AppResponse(res, HttpStatusCodes.OK, "Task deleted successfully");
  } catch (error) {
    next(error);
  }
};
