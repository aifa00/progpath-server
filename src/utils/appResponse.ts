import { Response } from "express";

class AppResponse {
    constructor (res: Response, statusCode: number = 200, message: string = 'Success', data?: any) {
        return res.status(statusCode).json({
            success: true,
            message,
            ...data,
        });
    }
}

export default AppResponse;
