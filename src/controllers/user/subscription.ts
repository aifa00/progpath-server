import { Request, Response, NextFunction } from "express";
import SubscriptionPlan from "../../models/subscriptionPlanModel";
import Razorpay from "razorpay";
import crypto from "crypto";
import mongoose from "mongoose";
import UserSubscription from "../../models/userSubscriptionsModel";
import logger from "../../utils/logger";
import AppError from "../../utils/appError";
import HttpStatusCodes from "../../enums/httpStatusCodes";
import AppResponse from "../../utils/appResponse";

export const getPremiumPage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.body;

    const plans = await SubscriptionPlan.find({ active: true });

    const userSubscriptions = await UserSubscription.find({
      userId: new mongoose.Types.ObjectId(userId as string),
    });

    // Determine subscription status
    const subscribed = userSubscriptions.some(
      (subscription) => subscription.endDate > new Date()
    );

    const isTrialUsed = userSubscriptions.length > 0;

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "Subscription plans loaded successfully",
      {
        plans,
        subscribed,
        isTrialUsed,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const subscribe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const key_id = process.env.RAZORPAY_KEY_ID as string;
    const key_secret = process.env.RAZORPAY_KEY_SECRET as string;

    const { amount } = req.body;

    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });

    const options = {
      amount,
      currency: "INR",
      receipt: `receipt_${Math.random().toString(36).substring(2, 9)}`,
    };

    // Create razorpay order
    const order = await razorpay.orders.create(options);

    if (!order) {
      return next(
        new AppError(
          "Failed to create razorpay order",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    new AppResponse(
      res,
      HttpStatusCodes.OK,
      "razorpay order created successfully!",
      {
        order,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const addSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      amount,
      planId,
      userId,
    } = req.body;

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !planId
    ) {
      return next(
        new AppError(
          "Required credentials are missing!",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET as string;

    const sha = crypto.createHmac("sha256", key_secret);
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");

    if (digest !== razorpay_signature) {
      return next(
        new AppError(
          "Transaction is not legit. Transaction failed !",
          HttpStatusCodes.BAD_REQUEST
        )
      );
    }

    // Add Subscription
    const plan: any = await SubscriptionPlan.findById(planId);

    if (!plan) {
      return next(new AppError("Plan not found", HttpStatusCodes.BAD_REQUEST));
    }

    const startDate = new Date();

    let endDate = new Date(startDate);

    const existingSubscriptions = await UserSubscription.find({
      userId: new mongoose.Types.ObjectId(userId as string),
      endDate: { $gt: new Date() },
    }).sort({ endDate: -1 });

    if (existingSubscriptions.length > 0) {
      const recentSubscription = existingSubscriptions[0]; // Take the most recent subscription
      endDate = new Date(recentSubscription.endDate);
    }

    switch (plan.durationType) {
      case "day":
        endDate.setDate(endDate.getDate() + plan.durationValue);
        break;
      case "month":
        endDate.setMonth(endDate.getMonth() + plan.durationValue);
        break;
      case "year":
        endDate.setFullYear(endDate.getFullYear() + plan.durationValue);
        break;
      default:
        logger.info("Invalid duration type");
    }

    const newSubscription = new UserSubscription({
      userId: new mongoose.Types.ObjectId(userId as string),
      planTitle: plan.title,
      startDate,
      endDate,
      amountPaid: amount,
    });

    await newSubscription.save();

    new AppResponse(
      res,
      HttpStatusCodes.CREATED,
      "Payment verified and subsciption added!"
    );
  } catch (error) {
    next(error);
  }
};

export const subscribeToTrial = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId, userId } = req.body;

    const plan: any = await SubscriptionPlan.findById(planId);

    if (!plan) {
      return next(new AppError("Plan not found", HttpStatusCodes.BAD_REQUEST));
    }

    const startDate = new Date();
    const endDate = new Date(startDate);

    switch (plan.durationType) {
      case "day":
        endDate.setDate(endDate.getDate() + plan.durationValue);
        break;
      case "month":
        endDate.setMonth(endDate.getMonth() + plan.durationValue);
        break;
      case "year":
        endDate.setFullYear(endDate.getFullYear() + plan.durationValue);
        break;
      default:
        logger.info("Invalid duration type");
    }

    const newSubscription = new UserSubscription({
      userId: new mongoose.Types.ObjectId(userId as string),
      planTitle: plan.title,
      startDate,
      endDate,
      amountPaid: plan.price,
    });

    await newSubscription.save();

    new AppResponse(res, HttpStatusCodes.OK, "Payment is verified");
  } catch (error) {
    next(error);
  }
};
