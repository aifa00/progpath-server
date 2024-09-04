import { Request, Response, NextFunction } from "express";
import run from "../../utils/geminiApi";
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import AppResponse from "../../utils/appResponse";

export const processPrompt = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {prompt} = req.body;

        if (!prompt) {
            return next(new AppError('No prompts given', HttpStatusCodes.NOT_FOUND));
        }

        const result = await run(prompt);

        new AppResponse(res, HttpStatusCodes.OK, 'Result generated successfully', {
            result
        });        
       
    } catch (error) {
        next (error)
    }
}

export const summarizeContent = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {content} = req.body;

        if (!content) {
            return next(new AppError('No content to summarize', HttpStatusCodes.NOT_FOUND));
        }

        const prompt = `Summarize the following project details : ${content}`       

        const summary = await run(prompt);

        new AppResponse(res, HttpStatusCodes.OK, 'Summary generated successfully', {
            summary
        }); 
       
    } catch (error) {
        next (error)
    }
}