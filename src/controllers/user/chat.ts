import { Request, Response, NextFunction } from "express";
import AppResponse from "../../utils/appResponse";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import User from "../../models/userModel";
import mongoose from "mongoose";
import AppError from "../../utils/appError";
import Chat from "../../models/chatModel";
import Message from "../../models/messageModel";

export const AllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.body;
    const { search } = req.query;

    if (!userId) {
      return next(
        new AppError("User id not found", HttpStatusCodes.BAD_REQUEST)
      );
    }

    const query: any = {
      _id: { $ne: new mongoose.Types.ObjectId(userId as string) },
    };

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query).select("username email avatar");

    new AppResponse(res, HttpStatusCodes.OK, "Users retrieved successfully", {
      users,
    });
  } catch (error) {
    next(error);
  }
};

export const fetchChats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return next(
        new AppError("User id not found", HttpStatusCodes.BAD_REQUEST)
      );
    }

    const userObjectId = new mongoose.Types.ObjectId(userId as string);

    let chats: any = await Chat.find({
      users: { $elemMatch: { $eq: userObjectId } },
    })
      .populate("users", "username avatar")
      .populate("latestMessage", "content")
      .sort({ updatedAt: -1 })
      .exec();

    chats = chats.map((chat: any) => {
      // Find the user whose ID does not match the current user's ID
      const otherUser = chat.users.find(
        (user: any) => user._id.toString() !== userObjectId.toString()
      );

      // New object with the `user` field instead of `users`
      const newObj = {
        ...chat.toObject(),
        user: otherUser,
      };

      delete newObj.users;
      return newObj;
    });

    new AppResponse(res, HttpStatusCodes.OK, "Users retrieved successfully", {
      chats,
    });
  } catch (error) {
    next(error);
  }
};

export const accessChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.body;
    const { user_id } = req.params;

    if (!userId || !user_id) {
      return next(
        new AppError(
          "userId and user_id are required",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    // Check if the chat already exists
    let chat: any = await Chat.findOne({
      users: {
        $all: [
          new mongoose.Types.ObjectId(user_id as string),
          new mongoose.Types.ObjectId(userId as string),
        ],
      },
    })
      .populate("users", "_id username avatar")
      .populate("latestMessage", "content");

    // If chat exists, return it
    if (chat) {
      const modifiedChat = {
        ...chat.toObject(),
        user: chat.users.find((user: any) => user._id.toString() !== userId),
      };

      delete modifiedChat.users;

      chat = modifiedChat;

      return new AppResponse(
        res,
        HttpStatusCodes.OK,
        "Chat accessed susseccsully",
        {
          chat,
        }
      );
    }

    // If chat doesn't exist, create a new chat
    const chatData = {
      chatName: "sender",
      users: [
        new mongoose.Types.ObjectId(user_id as string),
        new mongoose.Types.ObjectId(userId as string),
      ],
    };

    const newChat = await Chat.create(chatData);

    chat = await Chat.findById(newChat._id).populate(
      "users",
      "username avatar"
    );

    const modifiedChat = {
      ...chat.toObject(),
      user: chat.users.find((user: any) => user._id.toString() !== userId),
    };

    delete modifiedChat.users;

    chat = modifiedChat;

    new AppResponse(res, HttpStatusCodes.OK, "Chat accessed susseccsully", {
      chat,
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, content } = req.body;
    const { chatId } = req.params;

    if (!userId || !content || !chatId) {
      return next(
        new AppError(
          "Invalid data passed into request",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    var newMessage = {
      sender: new mongoose.Types.ObjectId(userId as string),
      chat: new mongoose.Types.ObjectId(chatId as string),
      content: content,
    };

    var message = await Message.create(newMessage);

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    new AppResponse(res, HttpStatusCodes.OK, "Users retrieved successfully", {
      message,
    });
  } catch (error) {
    next(error);
  }
};

export const allMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;

    if (!chatId) {
      return next(
        new AppError("Required data is not passed", HttpStatusCodes.BAD_REQUEST)
      );
    }

    const messages = await Message.find({
      chat: new mongoose.Types.ObjectId(chatId as string),
    });

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "Messages retrieved successfully",
      {
        messages,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { messageId } = req.params;
    const { latestmessageid } = req.query;

    if (!messageId) {
      return next(
        new AppError("Required data is not passed", HttpStatusCodes.BAD_REQUEST)
      );
    }

    const message = await Message.findById(messageId);

    if (latestmessageid) {
      message?.chat &&
        (await Chat.findByIdAndUpdate(message.chat, {
          latestMessage: new mongoose.Types.ObjectId(latestmessageid as string),
        }));
    }

    await Message.findByIdAndDelete(messageId);

    new AppResponse(res, HttpStatusCodes.OK, "Message deleted successfully");
  } catch (error) {
    next(error);
  }
};
