import { Request, Response, NextFunction } from "express"
import SubscriptionPlan from "../../models/subscriptionPlanModel"
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import AppResponse from "../../utils/appResponse";


export const getSubscriptionPlans = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const plans = await SubscriptionPlan.find({});

        new AppResponse(res, HttpStatusCodes.OK, 'Subscription plans loaded successfully', {
            plans
        });       
        
    } catch (error) {
        next (error)
    }
}


export const addNewSubscriptionPlan = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {title, durationType, durationValue, price} = req.body        

        const maxNumOfPlans = 5;

        if (!title || !durationType || !durationValue || !price)  {
            return next(new AppError(`Title, duration type, duration value, and price is required!`, HttpStatusCodes.BAD_REQUEST));
        }

        const existingPlansCount = await SubscriptionPlan.countDocuments();

        if (existingPlansCount >= maxNumOfPlans) {
            return next(new AppError(`cannot add more than five plans !`, HttpStatusCodes.BAD_REQUEST));           
        }

        const newPlan = new SubscriptionPlan({
            title,
            durationType,
            durationValue,
            price
        })

        await newPlan.save()

        new AppResponse(res, HttpStatusCodes.CREATED, 'New subscription plan is added', {
            newPlan
        });       
        
    } catch (error) {
        next (error)
    }
}


export const editSubscriptionPlan = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {planId} = req.params
        const {title, durationType, durationValue, price} = req.body        
        

        if (!planId || !title || !durationType || !durationValue || (!price && price !== 0)) {
            return next(new AppError(`Title, duration type, duration value, and price is required!`, HttpStatusCodes.BAD_REQUEST));           
        }

        await SubscriptionPlan.findByIdAndUpdate(planId, {
            title,
            durationType,
            durationValue,
            price
        })

        new AppResponse(res, HttpStatusCodes.OK, 'Plan updated successfully');                 

    } catch (error) {
        next (error)
    }
}


export const disableSubscriptionPlan = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const {planId} = req.params;
        const {action} = req.body;
        

        if (!planId || !['disable', 'activate'].includes(action)) {
            return next(new AppError('Invalid planId or action', HttpStatusCodes.BAD_REQUEST));            
        }

        const activePlanCount = await SubscriptionPlan.countDocuments({ active: true });

        if (action === 'activate') {
            if (activePlanCount >= 4) {
                return next(new AppError('At a time only four plans can be activated', HttpStatusCodes.BAD_REQUEST));               
            }
        }

        await SubscriptionPlan.findByIdAndUpdate(planId, {active: action === 'activate' ? true : false});

        new AppResponse(res, HttpStatusCodes.OK, `Plan ${action === 'activate' ? 'activated' : 'disabled'} successfully !`);

    } catch (error) {
        next (error)
    }
}