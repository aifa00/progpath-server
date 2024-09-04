import { Request, Response, NextFunction } from "express";
import User from "../models/userModel";
import bcrypt from "bcrypt";
import { sendOtp } from "../utils/sentOtp";
import jwt from "jsonwebtoken";
import OtpVerification from "../models/otpModel";
import { OAuth2Client } from "google-auth-library";
import Admin from "../models/adminModel";
import crypto from "crypto";
import axios from "axios";
import HttpStatusCodes from "../enums/httpStatusCodes";
import AppError from "../utils/appError";
import AppResponse from "../utils/appResponse";

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return next(
        new AppError(
          "Please provide all required credentials to continue !",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const foundUser = await User.findOne({ email });

    if (foundUser && foundUser.verified) {
      return next(new AppError("User already exist", HttpStatusCodes.CONFLICT));
    }

    if (foundUser && !foundUser.verified) {
      await User.deleteOne({ email });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username: username.trim(),
      email: email.trim(),
      password: hashedPassword,
      role,
    });

    await newUser.save();

    sendOtp(res, email.trim(), next);
  } catch (error: any) {
    next(error);
  }
};

export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(
        new AppError(
          "Email and password are required !",
          HttpStatusCodes.UNAUTHORIZED
        )
      );
    }

    const user = await User.findOne({ email });

    if (!user) {
      return next(
        new AppError("User doesn't exist !", HttpStatusCodes.NOT_FOUND)
      );
    }

    if (user && !user.verified) {
      return next(
        new AppError("User is not verified !", HttpStatusCodes.UNAUTHORIZED)
      );
    }

    if (user && user.blocked) {
      return next(
        new AppError("User is blocked !", HttpStatusCodes.UNAUTHORIZED)
      );
    }

    const passwordValid = await bcrypt.compare(password, user.password || "");

    if (!passwordValid) {
      return next(
        new AppError(
          "Invalid password, please try again !",
          HttpStatusCodes.UNAUTHORIZED
        )
      );
    }

    const payload = {
      username: user.username,
      avatar: user.avatar || "",
      userId: user._id,
      role: user.role,
      iat: Date.now(),
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: "30d",
    });

    user.token = token;

    await user.save();

    new AppResponse(res, HttpStatusCodes.OK, "User logged in successfully", {
      token,
      user: {
        username: user.username,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, confirmPassword, isAdmin } = req.body;

    if (!email || !password || !confirmPassword) {
      return next(
        new AppError(
          "Email, Password, confirm password and is admin are required !",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    if (password !== confirmPassword) {
      return next(
        new AppError(
          "Password and confirm password did not match !",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    // Generate hashed password
    const hashedPassword = await bcrypt.hash(password, 10);

    if (isAdmin) {
      const admin = await Admin.findOne({ email });

      if (!admin) {
        return next(
          new AppError("Admin not found!", HttpStatusCodes.NOT_FOUND)
        );
      }

      admin.password = hashedPassword;

      admin.save();
    } else {
      const user = await User.findOne({ email });

      if (!user) {
        return next(new AppError("User not found!", HttpStatusCodes.NOT_FOUND));
      }

      user.password = hashedPassword;

      user.save();
    }

    new AppResponse(res, HttpStatusCodes.OK, "Password reset successfully");
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, isAdmin } = req.body;

    if (!email) {
      return next(
        new AppError("Email is required !", HttpStatusCodes.BAD_REQUEST)
      );
    }

    if (isAdmin) {
      const admin = await Admin.findOne({ email });

      if (!admin) {
        return next(
          new AppError("Admin does not exist!", HttpStatusCodes.NOT_FOUND, {
            notify: true,
          })
        );
      }
    } else {
      const user = await User.findOne({ email });

      if (!user) {
        return next(
          new AppError("User does not exist!", HttpStatusCodes.NOT_FOUND, {
            notify: true,
          })
        );
      }
    }

    sendOtp(res, email, next);
  } catch (error) {
    next(error);
  }
};

export const adminLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(
        new AppError(
          "Email and password are required !",
          HttpStatusCodes.UNAUTHORIZED
        )
      );
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return next(
        new AppError("Admin doesn't exist !", HttpStatusCodes.NOT_FOUND)
      );
    }

    const passwordValid = await bcrypt.compare(password, admin.password || "");

    if (!passwordValid) {
      return next(
        new AppError(
          "Invalid password, please try again !",
          HttpStatusCodes.UNAUTHORIZED
        )
      );
    }

    const payload = {
      email: admin.email,
      userId: admin._id,
      role: "admin",
      iat: Date.now(),
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: "30d",
    });

    admin.token = token;

    await admin.save();

    new AppResponse(res, HttpStatusCodes.OK, "Admin logged in successfully", {
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(
        new AppError("Email and otp required", HttpStatusCodes.UNAUTHORIZED)
      );
    }

    const otpRecord = await OtpVerification.findOne({ email });

    if (!otpRecord) {
      return next(new AppError("Invalid OTP", HttpStatusCodes.BAD_REQUEST));
    }

    if (otpRecord.expiresAt && otpRecord.expiresAt < new Date()) {
      return next(
        new AppError(
          "OTP is expired, please try again !",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);

    if (!isValid) {
      return next(new AppError("Incorrect OTP", HttpStatusCodes.UNAUTHORIZED));
    }

    if (isValid) {
      await User.updateOne({ email }, { verified: true });
    }

    new AppResponse(res, HttpStatusCodes.OK, "OTP verified successfully");
  } catch (error) {
    next(error);
  }
};

export const resendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    if (!email) return;

    sendOtp(res, email, next);
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.body;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const client = new OAuth2Client(clientId);

    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: clientId,
    });

    const payload: any = ticket.getPayload();
    const { sub, email, email_verified, name, picture, aud, iss } = payload;

    // Ensure the token is issued by Google and the audience matches your client ID
    if (aud !== clientId || iss !== "https://accounts.google.com") {
      return next(new AppError("Unauthorized", HttpStatusCodes.UNAUTHORIZED));
    }

    // Check if the email is verified
    if (!email_verified) {
      return next(
        new AppError("Email is not verified !", HttpStatusCodes.BAD_REQUEST)
      );
    }

    // Check user existence in the database
    let user = await User.findOne({ email });

    let isUserExist = false;

    if (!user) {
      user = new User({
        email,
        username: name,
        avatar: picture,
        verified: true,
      });
    } else {
      // Update user information
      if (user.username !== name) user.username = name;
      if (user.avatar !== picture) user.avatar = picture;

      if (user.role) {
        isUserExist = true;
      }
    }

    const jwtPayload = {
      username: user.username,
      avatar: user.avatar || "",
      userId: user._id,
      role: user.role,
      iat: Date.now(),
    };

    const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET as string, {
      expiresIn: "30d",
    });

    user.token = jwtToken;

    await user.save();

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "User logged in successfully (Google)",
      {
        token: jwtToken,
        isUserExist,
        user: {
          username: user.username,
          avatar: user.avatar,
        },
      }
    );
  } catch (error) {
    next(error);
  }
};

const generateAppSecretProof = (accessToken: string, appSecret: string) => {
  return crypto
    .createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");
};

export const facebookLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { accessToken } = req.body;

    const appSecretProof = generateAppSecretProof(
      accessToken,
      process.env.FACEBOOK_APP_SECRET as string
    );

    // Verify the access token with Facebook and get user info
    const response = await axios.get(
      `https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture.type(large)&appsecret_proof=${appSecretProof}`
    );

    const { name, email, picture } = response.data;

    let user = await User.findOne({ email });

    let isUserExist = false;

    if (!user) {
      user = new User({
        email,
        username: name,
        avatar: picture.data.url,
        verified: true,
      });
    } else {
      if (user.username !== name) user.username = name;
      if (user.avatar !== picture.data.url) user.avatar = picture.data.url;

      if (user.role) {
        isUserExist = true;
      }
    }

    const jwtPayload = {
      username: user.username,
      avatar: user.avatar || "",
      userId: user._id,
      role: user.role,
      iat: Date.now(),
    };

    const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET as string, {
      expiresIn: "30d",
    });

    user.token = jwtToken;

    await user.save();

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "User logged in successfully (Facebook)",
      {
        token: jwtToken,
        isUserExist,
        user: {
          username: user.username,
          avatar: user.avatar,
        },
      }
    );
  } catch (error) {
    next(error);
  }
};

export const setRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, roleSelected } = req.body;

    if (!userId) {
      return next(new AppError("User not found!", HttpStatusCodes.NOT_FOUND));
    }

    if (!["regular", "teamlead"].includes(roleSelected)) {
      return next(new AppError("Invalid role!", HttpStatusCodes.BAD_REQUEST));
    }

    await User.findByIdAndUpdate(userId, { role: roleSelected });

    new AppResponse(res, HttpStatusCodes.OK, "Role set successfully");
  } catch (error) {
    next(error);
  }
};

export const logoutUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return next(
        new AppError("User is not logged-in !", HttpStatusCodes.UNAUTHORIZED)
      );
    }

    await User.findByIdAndUpdate(userId, { token: "" });

    new AppResponse(res, HttpStatusCodes.OK, "User logged-out successfully");
  } catch (error) {
    next(error);
  }
};

export const logoutAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { adminId } = req.body;

    if (!adminId) {
      return next(
        new AppError("Admin is not logged-in !", HttpStatusCodes.UNAUTHORIZED)
      );
    }

    await Admin.findByIdAndUpdate(adminId, { token: "" });

    new AppResponse(res, HttpStatusCodes.OK, "Admin logged-out successfully");
  } catch (error) {
    next(error);
  }
};
