import { Request, Response, NextFunction } from "express";
import sharp from "sharp";

export const processProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If no file is uploaded, skip processing
  if (!req.file) return next();

  try {
    // Process the image using sharp
    const processedBuffer = await sharp(req.file.buffer)
      .resize({ width: 300, height: 300, fit: sharp.fit.cover }) // Crop to 1:1 aspect ratio, size 300x300
      .toFormat("jpeg", { quality: 50 }) // Compress and convert to JPEG with 50% quality
      .toBuffer();

    // Update the req.file object with the processed image data
    req.file.buffer = processedBuffer;
    req.file.mimetype = "image/jpeg";

    next();
  } catch (error) {
    next(error);
  }
};

export const processImages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If no files, skip processing
  if (!req.files) return next();

  try {
    // Create an array to hold processed images
    const processedImages = await Promise.all(
      (req.files as any).map(async (file: any) => {
        const processedBuffer = await sharp(file.buffer)
          .resize({ width: 1600, height: 1000, fit: sharp.fit.cover }) // Crop to 16:10 aspect ratio
          .toFormat("jpeg", { quality: 80 }) // Compress and convert to JPEG with 80% quality
          .toBuffer();

        return {
          originalname: file.originalname,
          buffer: processedBuffer,
          mimetype: "image/jpeg",
        };
      })
    );

    req.files = processedImages;
    next();
  } catch (error) {
    next(error);
  }
};
