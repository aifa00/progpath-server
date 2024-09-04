import { Request, Response, NextFunction } from "express";
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import Program from "../../models/programModel";
import mongoose from "mongoose";
import { deleteFileFromS3, getPreSignedUrl } from "../../utils/S3Utils";
import AppResponse from "../../utils/appResponse";



export const getPrograms = async (req: Request, res:Response, next: NextFunction) => {
    try {        
        const {search, page = '1', filterBy, sort, order} = req.query;

        const pageNumber = parseInt(page as string);
        const pageLimit = 10;
    
        const query: any = {}

        const sortOption: any = {}

        // Handle: search
        if (search) {
            const searchRegex = new RegExp(search as string, 'i');
                    
            query.$or = [
                { title: searchRegex },
                { languages: searchRegex },
                { frameworks: searchRegex }, 
                { technologies: searchRegex } 
            ];
        }

        // Handle: filter
        if (filterBy) {
            if (!['week', 'month', 'year', 'pending', 'accepted', 'rejected'].includes(filterBy as string)) {
                return next(new AppError ('Invalid filter option', HttpStatusCodes.BAD_REQUEST));
            }

            const currentDate = new Date();
            const startDate = new Date(currentDate);

            if (filterBy === 'week') {
                startDate.setDate(currentDate.getDate() - 7);
                query.timestamp = { $gte: startDate };
            } else if (filterBy === 'month') {
                startDate.setMonth(currentDate.getMonth() - 1);
                query.timestamp = { $gte: startDate };
            } else if (filterBy === 'year') {
                startDate.setFullYear(currentDate.getFullYear() - 1);
                query.timestamp = { $gte: startDate };
            } else if (['pending', 'accepted', 'rejected'].includes(filterBy as string)) {
                query.status = filterBy;
            } 
            
        }

        // Handle: sort
        if (sort) {
            if (!['title', 'date'].includes(sort as string)) {
                return next(new AppError ('Invalid sort option', HttpStatusCodes.BAD_REQUEST));
            }

            if (sort === 'title') {
                sortOption.title = order === 'asce' ? 1 : -1;
            } else if (sort === 'date') {
                sortOption.timestamp = order === 'asce' ? 1 : -1;
            }
        } else {
            sortOption.timestamp = -1
        }

        // Find records to skip
        const recordsToSkip = (pageNumber - 1) * pageLimit;
        
        const aggregationPipeline = [
            { $match: query },            
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'publishedBy'
                }
            },
            {$unwind: '$publishedBy'},
            {
                $sort: sortOption
            },
            { $skip: recordsToSkip},
            { $limit: pageLimit },
            {
                $project: {
                    _id: 1,
                    title: 1,                    
                    status: 1,                                        
                    'publishedBy.username' : 1,
                    timestamp: 1
                }
            }
        ];

        // Execute the query
        const programs = await Program.aggregate(aggregationPipeline);

        // Give serial numbers to records
        const programsWithSerialNumbers = programs.map((program, index) => ({
            ...program,
            slno: (pageNumber - 1) * pageLimit + index + 1,
        }));
        

        const totalResults = await Program.countDocuments();
        const totalPages = Math.ceil(totalResults / pageLimit);            

        new AppResponse (res, HttpStatusCodes.OK, 'Programs page loaded successfully!', {
            programs: programsWithSerialNumbers,
            totalResults,
            totalPages
        });

    } catch (error) {
        next (error)
    }
}


export const updateProgramStatus = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {programId} = req.params;
        const {status} = req.body;

        if (!programId || !['accepted', 'rejected', 'pending'].includes(status)) {
            return next(new AppError ('Invalid status', HttpStatusCodes.BAD_REQUEST));            
        }
     
        const program: any = await Program.findById(programId, 'status rejectedMessage');

        // Remove rejected message if any while accepting program
        if (status === 'accepted') {
            program.rejectedMessage = ''
        }

        program.status = status;
        
        await program.save()
        
        new AppResponse(res, HttpStatusCodes.OK, 'Status updated successfully!');        

    } catch (error) {
        next (error)
    }
}


export const getProgram = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {programId} = req.params;

        const programObjectId = new mongoose.Types.ObjectId(programId as string);

        let program: any = await Program.findOne(
            {_id: programObjectId},
            {random: 0, timestamp: 0, status: 0}
        );

        // Get url of images from S3
        if (program) {
            const modifiedImagesArray = await Promise.all(
                program?.images.map(async (obj: any) => {
                    const url = await getPreSignedUrl(obj.key);
                    return {
                        key: obj.key,
                        imageUrl: url
                    }
                })
            )
            
            // Replace images array with urls
            const modifiedProgram = {
                ...program.toObject(),
                images: modifiedImagesArray
            }

            program = modifiedProgram
        }

        new AppResponse(res, HttpStatusCodes.OK, 'Program retrieved successfully!', {
            program
        });       

    } catch (error) {
        next (error)
    }
}


export const editProgram = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {
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

        await Program.findByIdAndUpdate(programId, {         
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
        
        new AppResponse (res, HttpStatusCodes.OK, 'Program updated successfully!');        
        
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
       
        new AppResponse(res, HttpStatusCodes.OK, 'Program deleted successfully!');        
        
    } catch (error) {
        next (error)
    }
}