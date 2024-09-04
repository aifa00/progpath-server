import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../models/userModel";
import Admin from "../models/adminModel";
import AppError from "../utils/appError";
import HttpStatusCodes from "../enums/httpStatusCodes";
import AppResponse from "../utils/appResponse";

export const authorizeUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.headers.authorization) {
    return next(
      new AppError(
        "Forbidden, Invalid token format or token not found",
        HttpStatusCodes.FORBIDDEN
      )
    );
  }

  const [Bearer, token] = req.headers.authorization.split(" ");

  jwt.verify(token, process.env.JWT_SECRET as string, async (err, decoded) => {
    if (err) {
      return next(
        new AppError("Forbidden, Invalid token !", HttpStatusCodes.FORBIDDEN)
      );
    }

    const user = await User.findOne({ _id: (decoded as JwtPayload).userId });

    // handle: when token exist, but user doesn't exist in db
    if (!user)
      return next(
        new AppError("Forbidden, user not found", HttpStatusCodes.FORBIDDEN)
      );

    // handle: when user logged out but token isn't expired
    if (!user.token || user.token !== token) {
      return next(
        new AppError(
          "Forbidden ! user is already logged out",
          HttpStatusCodes.FORBIDDEN
        )
      );
    }

    // handle: when user is blocked
    if (user.blocked)
      return next(
        new AppError(
          "Unauthorized ! user is blocked",
          HttpStatusCodes.UNAUTHORIZED
        )
      );

    // JWT payload includes user data, including username, userId and iat
    req.body.userId = (decoded as JwtPayload).userId;
    req.body.role = (decoded as JwtPayload).role;
    req.body.username = (decoded as JwtPayload).username;

    next();
  });
};

export const authorizeAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.headers.authorization) {
    return next(
      new AppError(
        "Forbidden, Invalid token format or token not found",
        HttpStatusCodes.FORBIDDEN
      )
    );
  }

  const [Bearer, token] = req.headers.authorization.split(" ");

  jwt.verify(token, process.env.JWT_SECRET as string, async (err, decoded) => {
    if (err)
      return next(
        new AppError("Forbidden: Invalid Token !", HttpStatusCodes.FORBIDDEN)
      );

    const admin = await Admin.findOne({ _id: (decoded as JwtPayload).userId });

    if (!admin)
      return next(
        new AppError(
          "Forbidden ! admin does not exist",
          HttpStatusCodes.FORBIDDEN
        )
      );

    if (!admin.token || admin.token !== token) {
      return next(
        new AppError(
          "Forbidden ! Admin is already logged out",
          HttpStatusCodes.FORBIDDEN
        )
      );
    }

    req.body.adminId = (decoded as JwtPayload).userId;

    next();
  });
};

export const isLoggedIn = (req: Request, res: Response, next: NextFunction) => {
  if (!req.headers.authorization) {
    return next(
      new AppError(
        "Forbidden, Invalid token format or token not found",
        HttpStatusCodes.FORBIDDEN
      )
    );
  }

  const [_, token] = req.headers.authorization.split(" ");

  jwt.verify(token, process.env.JWT_SECRET as string, async (err, decoded) => {
    if (err)
      return next(new AppError("Invalid Token !", HttpStatusCodes.FORBIDDEN));

    if ((decoded as JwtPayload).role === "admin") {
      const admin = await Admin.findOne({
        _id: (decoded as JwtPayload).userId,
      });

      if (!admin)
        return next(
          new AppError(
            "Forbidden! admin does not exist",
            HttpStatusCodes.FORBIDDEN
          )
        );

      if (!admin.token || admin.token !== token) {
        return next(
          new AppError(
            "Forbidden ! Admin is already logged out",
            HttpStatusCodes.FORBIDDEN
          )
        );
      }

      new AppResponse(res, HttpStatusCodes.OK, "Admin is logged-in");
    } else {
      const user = await User.findOne({ _id: (decoded as JwtPayload).userId });

      // handle: when token exist, but user doesn't exist in db
      if (!user)
        return next(
          new AppError(
            "Forbidden ! user does not exist",
            HttpStatusCodes.FORBIDDEN
          )
        );

      // handle: when user logged out but token isn't expired
      if (!user.token || user.token !== token) {
        return next(
          new AppError(
            "Forbidden! user is already logged out",
            HttpStatusCodes.FORBIDDEN
          )
        );
      }

      // handle: when user is blocked
      if (user.blocked)
        return next(
          new AppError(
            "Unauthorized! user is blocked !",
            HttpStatusCodes.UNAUTHORIZED
          )
        );

      new AppResponse(res, HttpStatusCodes.OK, "User is logged-in", {
        user: {
          username: user?.username,
          avatar: user?.avatar,
        },
      });
    }
  });
};
