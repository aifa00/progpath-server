import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import logger from "./logger";

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
  region: process.env.AWS_REGION as string,
});

export const getPreSignedUrl = async (key: string) => {
  try {
    const getObjectParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    };
    const command = new GetObjectCommand(getObjectParams);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    logger.error(`Failed to get URL for key: ${key}`, error);
    throw new Error("Failed to get URL from S3");
  }
};

export const uploadFilesToS3 = async (files: any[], folder: string) => {
  const uploadedFiles: {}[] = [];

  const uploadPromises = files.map(async (file: any) => {
    try {
      const key = `${folder}/${uuidv4()}.jpg`;

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME as string,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const command = new PutObjectCommand(params);
      await s3.send(command);

      uploadedFiles.push({
        originalName: file.originalname,
        key: key,
        type: file.mimetype,
      });
    } catch (error) {
      logger.error(`Failed to upload file ${file.originalname}`, error);
    }
  });

  // Wait for all file uploads to complete
  await Promise.all(uploadPromises);
  return uploadedFiles;
};

export const deleteFileFromS3 = async (key: string) => {
  try {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: key,
    };

    const command = new DeleteObjectCommand(params);

    await s3.send(command);

    return true; // Return true if deletion is successful
  } catch (error) {
    logger.error(`Failed to delete file ${key}`, error);
    throw new Error("Failed to delete file from S3");
  }
};

export const uploadProfileImageToS3 = async (file: any, folder: string) => {
  try {
    const key = `${folder}/${uuidv4()}.jpg`;

    const params: any = {
      Bucket: process.env.AWS_BUCKET_NAME as string,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      //   ACL: "public-read",
    };

    const command = new PutObjectCommand(params);
    await s3.send(command);

    // Generate a public URL for the uploaded file
    const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return url;
  } catch (error) {
    logger.error(`Failed to upload file ${file.originalname}`, error);
    throw new Error("Failed to upload file to S3");
  }
};

export const deleteProfileImageFromS3 = async (url: string) => {
  try {
    // Extract the S3 key from the URL
    const bucketName = process.env.AWS_BUCKET_NAME as string;
    const key = url.replace(
      `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
      ""
    );

    const params = {
      Bucket: bucketName,
      Key: key,
    };

    const command = new DeleteObjectCommand(params);
    await s3.send(command);

    return true; // Return true if deletion is successful
  } catch (error) {
    logger.error(`Failed to delete file from S3: ${url}`, error);
    throw new Error("Failed to delete file from S3");
  }
};
