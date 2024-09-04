import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    // error stack
    logger.error(err.stack);

    const statusCode = err.statusCode || 500;
    
    const errorResponse = {
        success: false,
        message: err.message || 'Internal Server Error',
        ...err.data // Spread the additional data if available
    };

    // Send the response with the error message and additional info (if any)
    res.status(statusCode).json(errorResponse);
};

export default errorHandler;