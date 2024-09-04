import { Request, Response, NextFunction } from "express";
import User from "../../models/userModel";
import { sendOtp } from "../../utils/sentOtp";
import bcrypt from "bcrypt";
import currentPremiumMembership from "../../utils/CheckCurrentPremiumMembership";
import Program from "../../models/programModel";
import mongoose from "mongoose";
import {
  deleteFileFromS3,
  deleteProfileImageFromS3,
  getPreSignedUrl,
  uploadFilesToS3,
  uploadProfileImageToS3,
} from "../../utils/S3Utils";
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import AppResponse from "../../utils/appResponse";

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.body;

    const profile = await User.findById(
      userId,
      "username email password avatar"
    );

    if (!profile) {
      return next(new AppError("User not found!", HttpStatusCodes.NOT_FOUND));
    }

    // Check subscription membership
    const membership = await currentPremiumMembership(userId);

    new AppResponse(res, HttpStatusCodes.OK, "Profile loaded successfully!", {
      profile,
      membership,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.body;
    const image = (req as any).file;

    if (!image) {
      return next(
        new AppError("Image is not given!", HttpStatusCodes.NOT_FOUND)
      );
    }

    const folder = "profile-images";

    const imageUrl = await uploadProfileImageToS3(image, folder);

    imageUrl && (await User.findByIdAndUpdate(userId, { avatar: imageUrl }));

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "Profile picture updated successfully!",
      { imageUrl }
    );
  } catch (error) {
    next(error);
  }
};

export const deleteProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    const avatarUrl = user?.avatar;

    if (avatarUrl) {
      await deleteProfileImageFromS3(avatarUrl);
      user.avatar = "";
      await user.save();
    }

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "Profile picture removed successfully!"
    );
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, newUsername, newEmail } = req.body;

    if (!newUsername && !newEmail) {
      return next(
        new AppError(
          "Username and Email are required",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError("User not found!", HttpStatusCodes.NOT_FOUND));
    }

    user.username = newUsername;

    await user.save();

    if (newEmail && newEmail !== user.email) {
      const userExist = await User.findOne({ email: newEmail });

      if (userExist) {
        return next(
          new AppError(
            "User with this email already exist!",
            HttpStatusCodes.CONFLICT
          )
        );
      }

      sendOtp(res, newEmail, next);

      return new AppResponse(
        res,
        HttpStatusCodes.OK,
        "Email needs to be verified, OTP sent!",
        {
          updateEmail: true,
        }
      );
    }

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "Profile is updated successfully!",
      {
        updateEmail: false,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const changeEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, email } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError("User not found!", HttpStatusCodes.NOT_FOUND));
    }

    user.email = email.trim();

    await user.save();

    new AppResponse(res, HttpStatusCodes.OK, "Email updated successfully", {
      profile: user,
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { currentPassword, newPassword, confirmPassword, userId } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return next(
        new AppError(
          `currentPassword, newPasssword and confirmPassword are required`,
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError("User not found!", HttpStatusCodes.NOT_FOUND));
    }

    if (newPassword !== confirmPassword) {
      return next(
        new AppError(
          "New password and confirm password doesn't match!",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const passwordValid = await bcrypt.compare(
      currentPassword,
      user.password as string
    );

    if (!passwordValid) {
      return next(
        new AppError("Invalid current password !", HttpStatusCodes.UNAUTHORIZED)
      );
    }

    user.password = hashedPassword;

    await user.save();

    new AppResponse(res, HttpStatusCodes.OK, "Password updated successfully!");
  } catch (error) {
    next(error);
  }
};

export const getUploadedPrograms = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.body;
    const { sort, order } = req.query;

    const query: any = {
      userId: new mongoose.Types.ObjectId(userId as string),
    };

    const sortOptions: any = {};

    // Handle: Sort
    if (sort) {
      sortOptions[sort as string] = order === "asce" ? 1 : -1;
    } else {
      sortOptions["timestamp"] = -1;
    }

    const programs = await Program.find(query)
      .sort(sortOptions)
      .select("_id title description images status");

    // Get url of one image from each program
    const programsWithImageUrls = await Promise.all(
      programs.map(async (program) => {
        const singleImageKey =
          program.images.length > 0 ? program.images[0].key : null;
        const singleImageUrl = singleImageKey
          ? await getPreSignedUrl(singleImageKey)
          : null;
        return {
          _id: program._id,
          title: program.title,
          description: program.description,
          image: singleImageUrl,
          status: program.status,
        };
      })
    );

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "Retrieved programs uploaded by user!",
      {
        programs: programsWithImageUrls,
      }
    );
  } catch (error) {
    next(error);
  }
};

// Get uploaded program to edit
export const getProgram = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { programId } = req.params;

    const programObjectId = new mongoose.Types.ObjectId(programId as string);

    let program: any = await Program.findOne(
      { _id: programObjectId },
      { rejectedMessage: 0, random: 0, timestamp: 0, status: 0 }
    );

    if (program) {
      // Get image urls from S3
      const modifiedImagesArray = await Promise.all(
        program?.images.map(async (obj: any) => {
          const url = await getPreSignedUrl(obj.key);
          return {
            key: obj.key,
            imageUrl: url,
          };
        })
      );

      // Replace images array with urls
      const modifiedProgram = {
        ...program.toObject(),
        images: modifiedImagesArray,
      };

      program = modifiedProgram;
    }

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "Program to edit retrieved successfully!",
      {
        program,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const addProgramImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { programId } = req.params;
    const images = (req as any).files;
    const folder = "marketplace-images";

    if (!images || images.length <= 0) {
      return next(
        new AppError(
          "There are no images to proceed",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    // Upload images in S3
    const uploadedImages: any = await uploadFilesToS3(images, folder);

    if (!uploadedImages || uploadedImages.length <= 0) {
      return next(
        new AppError("Image is failed to upload!", HttpStatusCodes.BAD_REQUEST)
      );
    }

    await Program.findByIdAndUpdate(programId, {
      $push: { images: uploadedImages[0] },
    });

    // Get url of uploaded image
    const newImageUrl = await getPreSignedUrl(uploadedImages[0].key);

    const newImage = {
      key: uploadedImages[0].key,
      imageUrl: newImageUrl,
    };

    new AppResponse(res, HttpStatusCodes.OK, "Image uploaded successfully!", {
      newImage,
    });
  } catch (error) {
    next(error);
  }
};

export const removeProgramImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { programId, imageKey } = req.params;

    if (!programId || !imageKey) {
      return next(
        new AppError(
          "Program id and image key is required to proceed",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const decodedImagekey = decodeURIComponent(imageKey);

    const isDeleted = await deleteFileFromS3(decodedImagekey);

    if (!isDeleted) {
      return next(
        new AppError("Image is failed to remove!", HttpStatusCodes.BAD_REQUEST)
      );
    }

    await Program.findByIdAndUpdate(programId, {
      $pull: { images: { key: decodedImagekey } },
    });

    new AppResponse(res, HttpStatusCodes.OK, "Image uploaded successfully!");
  } catch (error) {
    next(error);
  }
};
