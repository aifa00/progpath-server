import { Response, NextFunction } from 'express';
import nodeMailer from 'nodemailer';
import logger from './logger';
import mongoose from 'mongoose';
import AppResponse from './appResponse';
import HttpStatusCodes from '../enums/httpStatusCodes';

export const sendInvitation = async (res: Response, emails: string[], workspaceTitle:string, workspaceId:mongoose.Types.ObjectId, sender: string, next :NextFunction) => {

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
    
        const link = `${process.env.REACT_APP_BASE_URL as string}/workspaces?invitation=1`
        
        const getMailOptions = (email: string) => {
            const mailOptions = {
                from: {
                    name: "ProgPath",
                    address: 'progpathapp@gmail.com',
                },
                to: email,
                subject: `Invitation to Collaborate on ${workspaceTitle}`,
                html: `
                    <p>Hi there,</p>
                    <p>You have been invited by ${sender} to collaborate on the workspace <strong>${workspaceTitle}</strong> on ProgPath.</p>
                    <p>Please click the button below to join and start collaborating:</p>
                    <p>
                        <a href="${link}" style="
                            display: inline-block;
                            padding: 10px 20px;
                            font-size: 16px;
                            color: white;
                            background-color: green;
                            text-decoration: none;
                            border-radius: 5px;
                        ">Join Workspace</a>
                    </p>                    
                    <p>The ProgPath Team</p>                    
                `,
            };

            return mailOptions;
        }        

        // Send invitations asynchronously
        await Promise.all(emails.map(async (email) => {
            try {
                await transporter.sendMail(getMailOptions(email));
            } catch (error) {
                logger.error(`Failed to send invitation email to ${email}:`, error);
            }
        }));

        new AppResponse(res, HttpStatusCodes.OK, 'Invitations sent successfully', {
            workspace: {
                _id: workspaceId, 
                title: workspaceTitle
            }
        });

    } catch (error) {
        next (error)
    }
}

