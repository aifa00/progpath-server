import mongoose from 'mongoose';
import UserSubscription from '../models/userSubscriptionsModel';

const currentPremiumMembership = async (userId: string) => {
    try {       
        const membership = await UserSubscription.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId as string),
                    endDate: {$gte: new Date()}
                }                
            },
            {
                $sort: {endDate: -1}
            },
            {
                $limit: 1
            },
            {
                $project: {
                    planTitle: 1,
                    endDate: 1
                }
            }
        ]);

        const currentMembership = membership.length > 0 ? membership[0] : null

        return currentMembership;
    } catch (error) {
        throw new Error('Error checking premium membership');
    }
}

export default currentPremiumMembership