import { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import Program from "../../models/programModel";
import mongoose from "mongoose";
import currentPremiumMembership from "../../utils/CheckCurrentPremiumMembership";
import { deleteFileFromS3, getPreSignedUrl, uploadFilesToS3 } from "../../utils/S3Utils";
import Like from "../../models/likeModel";
import Comment from "../../models/commentModel";
import AppResponse from "../../utils/appResponse";


export const getMarketplace = async (req: Request, res:Response, next: NextFunction) => {
    try {        
        const {search, page = '1', duration, sort, order} = req.query;
        const {userId} = req.body;

        const pageNo = parseInt(page as string);
        const pageLimit = 12;
    
        const query: any = {
            status: 'accepted'
        }

        const sortOption: any = {}

        // Handle: Search
        if (search) {
            const searchRegex = new RegExp(search as string, 'i');
                    
            query.$or = [
                { title: searchRegex },
                { languages: searchRegex }, 
                { frameworks: searchRegex }, 
                { technologies: searchRegex } 
            ];
        }

        // Handle: Filter
        if (duration) {
            if (!['week', 'month', 'year'].includes(duration as string)) {
                return next(new AppError ('Invalid filter option', HttpStatusCodes.BAD_REQUEST));
            }

            const currentDate = new Date();
            const startDate = new Date(currentDate);

            if (duration === 'week') {
                startDate.setDate(currentDate.getDate() - 7);
            } else if (duration === 'month') {
                startDate.setMonth(currentDate.getMonth() - 1);
            } else if (duration === 'year') {
                startDate.setFullYear(currentDate.getFullYear() - 1);
            }

            query.timestamp = { $gte: startDate };
        }

        // Handle: Sort
        if (sort) {
            if (!['title', 'date', 'popular'].includes(sort as string)) {
                return next(new AppError ('Invalid sort option', HttpStatusCodes.BAD_REQUEST));
            }

            if (sort === 'title') {
                sortOption.title = order === 'asce' ? 1 : -1;
            } else if (sort === 'date') {
                sortOption.timestamp = order === 'asce' ? 1 : -1;
            } else if (sort === 'popular') {
                sortOption.popularity = order === 'asce' ? 1 : -1;
            }
        } else {
            sortOption.random = 1
        }

        const recordsToSkip = (pageNo - 1) * pageLimit;

        const aggregationPipeline = [
            { $match: query },
            {
                $lookup: {
                    from: 'likes',
                    localField: '_id',
                    foreignField: 'referenceId',
                    as: 'likes'
                }
            },
            {
                $lookup: {
                    from: 'comments',
                    localField: '_id',
                    foreignField: 'referenceId',
                    as: 'comments'
                }
            },
            {
                $addFields: {
                    likesCount: { $size: '$likes' },
                    commentsCount: { $size: '$comments'}
                }
            },
            {
                $addFields: {
                    popularity: { $sum: ['$likesCount', '$commentsCount'] }
                }
            },
            {
                $sort: sortOption
            },
            { $skip: recordsToSkip},
            { $limit: pageLimit },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    description: 1,
                    images: 1,
                    popularity: 1,
                    likesCount: 1,
                    commentsCount: 1
                }
            }
        ];

        const programs = await Program.aggregate(aggregationPipeline);

        const totalResults = await Program.countDocuments({status: 'accepted'});
        const totalPages = Math.ceil(totalResults / pageLimit);
        const from = recordsToSkip + 1;
        const to = from + programs.length - 1

        // Get image urls from S3
        const programsWithImageUrls = await Promise.all(programs.map(async (program) => {
            const singleImageKey = program.images.length > 0 ? program.images[0].key : null;
            const singleImageUrl = singleImageKey ? await getPreSignedUrl(singleImageKey) : null;
            return {
                _id: program._id,
                title: program.title,
                description: program.description,
                image: singleImageUrl,
                likesCount: program.likesCount,
                commentsCount: program.commentsCount,                
            };
        }));

        // Check subscription membership
        const membership = await currentPremiumMembership(userId);

        new AppResponse(res, HttpStatusCodes.OK, 'Marketplace loaded successfully', {
            programs: programsWithImageUrls,
            premiumUser: membership ? true : false,
            totalResults,
            totalPages,
            from,
            to
        }); 
        
    } catch (error) {
        next (error)
    }
}



export const addNewProgram = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {
            userId, 
            title, 
            description, 
            features, 
            languages, 
            frameworks,
            technologies, 
            highlights, 
            collaborators, 
            contact
        } = req.body;

        const images = (req as any).files;// if no files are uploaded, req.files will be an empty array
        const folder = 'marketplace-images'

        if (!title || ! description || !features || !languages || !images || images.length <= 0) {
            return next(new AppError('Title, description, features, languages and images are required', HttpStatusCodes.BAD_REQUEST));
        }

        // Check membership
        const membership = await currentPremiumMembership(userId);

        if (!membership) {
            return next(new AppError('User should have membership to upload programs, please subscribe to a plan to continue', HttpStatusCodes.BAD_REQUEST, {
                notify: true
            }));
        }

        // Upload images to S3
        const uploadedImages: any = await uploadFilesToS3(images, folder);

        const newProgram = new Program({
            userId: new mongoose.Types.ObjectId(userId as string),
            images: uploadedImages,
            title,
            description,
            features,
            languages,
            frameworks: frameworks || '',
            technologies: technologies || '',
            highlights: highlights || '',
            collaborators: collaborators || '',
            contact: contact || '',
        })

        await newProgram.save();

        // Get url of one image of uploaded program
        const singleImageUrl = uploadedImages.length > 0 ? await getPreSignedUrl(uploadedImages[0].key) : null;

        // Uploaded program
        const newProgramWithImageUrl = {
            _id: newProgram._id,
            title: newProgram.title,
            description: newProgram.description,
            image: singleImageUrl,
            status: newProgram.status
        }
        
        new AppResponse(res, HttpStatusCodes.CREATED, 'New program added successfully!', {
            program: newProgramWithImageUrl
        });        
        
    } catch (error) {
        next (error)
    }
}


//get single program in marketplace
export const getSingleProgram = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {programId} = req.params;
        const {userId} = req.body;

        const programObjectId = new mongoose.Types.ObjectId(programId as string);
        const userObjectId = new mongoose.Types.ObjectId(userId as string);

        let program: any = await Program.findOne (
            {_id: programObjectId},
            {random: 0, status: 0, rejectedMessage: 0}
        )
        .populate('userId', '_id username avatar');

        if (program) {
            // Get image urls from S3
            const imageUrls = await Promise.all(
                program?.images.map(async (obj: any) => {
                    const url = await getPreSignedUrl(obj.key);
                    return url
                })
            )
            
            const modifiedProgram = {
                ...program.toObject(),
                images: imageUrls
            }

            program = modifiedProgram
        }


        const likesCount = await Like.countDocuments({ referenceId: programObjectId });
        const commentsCount = await Comment.countDocuments({ referenceId: programObjectId });
        const userLiked = await Like.exists({ referenceId: programObjectId, userId: userObjectId });
             
        new AppResponse(res, HttpStatusCodes.OK, 'Program loaded succcessfully', {
            program,
            likesCount,
            commentsCount,
            userLiked: Boolean(userLiked)
        });        
        
    } catch (error) {
        next (error)
    }
}


export const editProgram = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {userId,
            title, 
            description, 
            features, 
            languages, 
            frameworks, 
            technologies, 
            highlights, 
            collaborators, 
            contact
        } = req.body; 
        const {programId} = req.params

        if (!title || ! description || !features || !languages) {
            return next(new AppError('Title, description, features and languages are required', HttpStatusCodes.BAD_REQUEST));
        }

        const userObjectId = new mongoose.Types.ObjectId(userId as string)

        await Program.findByIdAndUpdate(programId, {
            userId: userObjectId,
            title,
            description,
            features,
            languages,
            frameworks: frameworks || '',
            technologies: technologies || '',
            highlights: highlights || '',
            collaborators: collaborators || '',
            contact: contact || '',
            status: 'pending'
        })
        
        new AppResponse(res, HttpStatusCodes.OK, 'Program updated successfully!');        
        
    } catch (error) {
        next (error)
    }
}



export const deleteProgram = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {programId} = req.params;

        // Use findByIdAndDelete to get the program while deleting
        const program = await Program.findByIdAndDelete(programId, { returnDocument: 'after' });

        if (!program) {
            return next(new AppError('Program not found to delete', HttpStatusCodes.BAD_REQUEST));
        }

        const imageKeys = program.images.map((image) => image.key);

        // Delete images from S3
        await Promise.all(imageKeys.map(async (key) => {
            await deleteFileFromS3(key as string);
        }));
       
        new AppResponse(res, HttpStatusCodes.OK, 'Program deleted successfully');       
        
    } catch (error) {
        next (error)
    }
}

