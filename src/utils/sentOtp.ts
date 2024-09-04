import { Response, NextFunction } from 'express';
import nodeMailer from 'nodemailer';
import bcrypt from 'bcrypt';
import OtpVerification from '../models/otpModel';
import AppResponse from './appResponse';
import { HttpStatusCode } from 'axios';

export const sendOtp = async (res: Response, email: string, next :NextFunction) => {

    try {
        const transporter = nodeMailer.createTransport({
            service: 'Gmail',
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.USER as string,
                pass: process.env.APP_PASSWORD as string
            }
        });            
        
           
        function generateOTP(length: number): string {
            const charset = '0123456789';
            let otp = '';
        
            for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * charset.length);
                otp += charset[randomIndex];
            }
        
            return otp;
        }

        const OTP = generateOTP(4);   
    
        
        const mailOptions = {
            from: {
                name: "ProgPath",
                address: 'progpathapp@gmail.com',
            },
            to: email,
            subject: `${OTP} is your Progpath confirmation code`,
            html: `
            <p>Hi there ,</p>            
            <p>You recently registered for Progpath. To complete your Progpath registration, please confirm your account.</p>
            <p>You may be asked to enter this confirmation code: <strong style="font-size: 25px;" >${OTP}</strong></p>            
            `
        };


        await OtpVerification.deleteMany({email});

        const hashedOtp = await bcrypt.hash (OTP, 10);

        const newOtpVerification = new OtpVerification({
            email,
            otp: hashedOtp
        })

        await newOtpVerification.save();

        await transporter.sendMail(mailOptions);

        new AppResponse(res, HttpStatusCode.Ok, 'OTP sent successfully', {
            email
        });

    } catch (error) {
        next (error)
    }
}

