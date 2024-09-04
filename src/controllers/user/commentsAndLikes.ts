import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Comment from "../../models/commentModel";
import User from "../../models/userModel";
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import Like from "../../models/likeModel";
import AppResponse from "../../utils/appResponse";

export const postComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, text, referenceId } = req.body;

    if (!text) {
      return next(
        new AppError(
          "Cannot save comment without text",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const comment = new Comment({
      userId: new mongoose.Types.ObjectId(userId as string),
      referenceId: new mongoose.Types.ObjectId(referenceId as string),
      text,
    });

    await comment.save();

    const user: any = await User.findById(userId, "username avatar");

    // Send new comment in response
    const newComment = {
      _id: comment._id,
      userDetails: {
        _id: user?._id,
        username: user?.username,
        avatar: user?.avatar,
      },
      text: comment.text,
      timestamp: new Date(comment.timestamp),
    };

    new AppResponse(
      res,
      HttpStatusCodes.CREATED,
      "Comment posted successfully",
      {
        newComment,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const editComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    if (!text) {
      return next(
        new AppError(
          "Cannot save comment without text",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }
    await Comment.findByIdAndUpdate(commentId, {
      text,
    });

    new AppResponse(res, HttpStatusCodes.OK, "Comment edited successfully");
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { commentId } = req.params;

    if (!commentId) {
      return next(
        new AppError("CommentId is required", HttpStatusCodes.BAD_REQUEST)
      );
    }

    await Comment.findByIdAndDelete(commentId);

    new AppResponse(res, HttpStatusCodes.OK, "Comment deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const getComments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { referenceId } = req.params;

    if (!referenceId) {
      return next(
        new AppError("Reference id is required", HttpStatusCodes.BAD_REQUEST)
      );
    }

    const comments = await Comment.aggregate([
      {
        $match: {
          referenceId: new mongoose.Types.ObjectId(referenceId as string),
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "parentId",
          as: "replies",
        },
      },
      {
        $addFields: {
          replyCount: { $size: "$replies" },
        },
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
          "userDetails._id": 1,
          "userDetails.username": 1,
          "userDetails.avatar": 1,
          replyCount: 1,
        },
      },
    ]);

    new AppResponse(res, HttpStatusCodes.OK, "Comments loaded successfully", {
      comments,
    });
  } catch (error) {
    next(error);
  }
};

export const addLike = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, referenceId } = req.body;

    if (!referenceId || !userId) {
      return next(
        new AppError(
          "reference id and user id is required!",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const newLIke = new Like({
      userId: new mongoose.Types.ObjectId(userId as string),
      referenceId: new mongoose.Types.ObjectId(referenceId as string),
    });

    await newLIke.save();

    new AppResponse(res, HttpStatusCodes.CREATED, "Like added successfully");
  } catch (error) {
    next(error);
  }
};

export const removeLike = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { referenceId } = req.params;
    const { userId } = req.body;

    if (!referenceId || !userId) {
      return next(
        new AppError(
          "reference id and user id is required!",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const referenceObjectId = new mongoose.Types.ObjectId(
      referenceId as string
    );
    const userObjectId = new mongoose.Types.ObjectId(userId as string);

    await Like.deleteOne({
      referenceId: referenceObjectId,
      userId: userObjectId,
    });

    new AppResponse(res, HttpStatusCodes.OK, "Like removed successfully");
  } catch (error) {
    next(error);
  }
};

export const replyComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { parentCommentId } = req.params;
    const { userId, mentionedTo, text } = req.body;

    if (!parentCommentId || !mentionedTo || !userId || !text) {
      return next(
        new AppError(
          "parent comment id, mentioned to, user id, and text are required!",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const reply = new Comment({
      userId: new mongoose.Types.ObjectId(userId as string),
      parentId: new mongoose.Types.ObjectId(parentCommentId as string),
      mentionedTo: new mongoose.Types.ObjectId(mentionedTo as string),
      text: text.trim(),
    });

    await reply.save();

    const addedReply = await Comment.findById(reply._id)
      .populate("userId", "username avatar")
      .populate("mentionedTo", "username")
      .select("_id text timestamp userId mentionedTo");

    new AppResponse(res, HttpStatusCodes.OK, "Reply added successfully", {
      addedReply,
    });
  } catch (error) {
    next(error);
  }
};

export const getReplies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { parentCommentId } = req.params;

    if (!parentCommentId) {
      return next(
        new AppError(
          "parent comment id is required!",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const replies = await Comment.find({
      parentId: new mongoose.Types.ObjectId(parentCommentId as string),
    })
      .sort({ timestamp: 1 })
      .populate("userId", "username avatar")
      .populate("mentionedTo", "username")
      .select("_id text timestamp userId mentionedTo");

    new AppResponse(res, HttpStatusCodes.OK, "Reply added successfully", {
      replies,
    });
  } catch (error) {
    next(error);
  }
};
