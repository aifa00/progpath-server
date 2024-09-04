// import { Request, Response, NextFunction } from "express";
// import { v4 as uuidv4 } from 'uuid'
// import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";



// const accessKeyId = process.env.AWS_ACCESS_KEY_ID as string;
// const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY as string;
// const region = process.env.AWS_REGION as string;

// const s3 = new S3Client({
//     credentials: {
//         accessKeyId: accessKeyId,
//         secretAccessKey: secretAccessKey
//     },
//     region: region
// });



// const uploadFile = async (req: Request, res:Response, next: NextFunction, folder: string): Promise<any> =>  {
//     try {
//         const file = (req as any).file;
         
//         if (!file) return res.status(400).json({ success: false, message: 'No file found !' });

//         const params = {
//             Bucket: process.env.AWS_BUCKET_NAME || '',
//             Key: `${folder}/${uuidv4()}_${file.originalname}`,
//             Body: file.buffer,
//             ContentType: file.mimetype,
//         }

//         const command = new PutObjectCommand(params);
        
//         const data = await s3.send(command);

//         return data
        
//     } catch (error) {
//         next();
//     }
// }

// export default uploadFile
