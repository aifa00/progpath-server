import { Request, Response, NextFunction } from "express"
import UserSubscription from "../../models/userSubscriptionsModel";
import User from "../../models/userModel";
import AppResponse from "../../utils/appResponse";
import HttpStatusCodes from "../../enums/httpStatusCodes";


export const getDashboard = async (req: Request, res:Response, next: NextFunction) => {
  try {
    const {dateFrom, dateTo} = req.query;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    let startDate = new Date(currentYear, 0, 1);
    let endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    if(dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    }

    const totalUsers = await User.countDocuments();

    const monthlyRevenue = Array(12).fill(0);

    const monthlyUserSignIns = Array(12).fill(0);

    const userRoleNumbers = Array(2).fill(0);

    let premiumUsers = [];

    let totalRevenue = 0;

    let currentPremiumUsers = 0;

    // Find subscription related datas
    const subscriptionData = await UserSubscription.aggregate([
      {
        $facet: {
          totalRevenue: [
            {
              $group: {
                _id: null,
                totalAmountPaid: { $sum: "$amountPaid" }
              }
            }
          ],
          currentPremiumUsers: [
            {
              $match: {
                endDate: { $gte: new Date() }
              }
            },
            {
              $count: "currentPremiumUsers"
            }
          ],
          monthlyRevenue: [
              {
                $match: {
                  timestamp: {
                    $gte: startDate,
                    $lte: endDate
                  }
                }
              },
              {
                $group: {
                  _id: { month: { $month: "$timestamp" } },
                  totalAmountPaid: { $sum: "$amountPaid" }
                }
              },
              {
                $sort: { "_id.month": 1 }
              }
          ],              
          premiumUsers: [
              {
                $match: {
                    timestamp: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
              },                 
              {
                $group: {
                  _id: '$planTitle',
                  totalSubscriptions: { $sum: 1 }
                }
              }
          ]
        }
      },
      {
        $project: {
          totalRevenue: { $arrayElemAt: ["$totalRevenue.totalAmountPaid", 0] },
          currentPremiumUsers: { $arrayElemAt: ["$currentPremiumUsers.currentPremiumUsers", 0] },
          monthlyRevenue: 1,
          premiumUsers: 1
        }
      }
    ]);

    totalRevenue = subscriptionData[0]?.totalRevenue;

    currentPremiumUsers = subscriptionData[0]?.currentPremiumUsers;

    premiumUsers = subscriptionData[0]?.premiumUsers

    for (const data of subscriptionData[0]?.monthlyRevenue) {
      
      // Convert month to zero-based index
      const monthIndex = data._id.month - 1; 

      if (monthIndex >= 0 && monthIndex < 12) {
        monthlyRevenue[monthIndex] = data.totalAmountPaid
      }
    }

    // Find user related datas
    const userData = await User.aggregate([
      {
        $match: {
          timestamp: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $facet: {
          userRoleNumbers: [
            {
              $group: {
                _id: '$role', 
                totalUsers: { $sum: 1 }
              }                
            }
          ],
          monthlyUserSignIns: [
            {
              $group: {
                _id: { month: { $month: "$timestamp" } },
                totalUsers: { $sum: 1 }
              }
            },
            {
              $sort: { "_id.month": 1 }
            }
          ]
        }
      }
    ]);
    
    //label order:  regular, teamlead
    for (const data of userData[0]?.userRoleNumbers) {
      if (data._id === 'regular') {
        userRoleNumbers[0] = data.totalUsers
      } else if (data._id === 'teamlead') {
        userRoleNumbers[1] = data.totalUsers
      }
    }

    for (const data of userData[0]?.monthlyUserSignIns) {
        // Convert month to zero-based index
        const monthIndex = data._id.month - 1; 

        if (monthIndex >= 0 && monthIndex < 12) { 
          monthlyUserSignIns[monthIndex] = data?.totalUsers; 
        }
    }

    // Form result object
    const result = { 
      totalRevenue,
      totalUsers,
      currentPremiumUsers,
      monthlyRevenue,
      monthlyUserSignIns,
      userRoleNumbers,
      premiumUsers
    }
    
    new AppResponse(res, HttpStatusCodes.OK, 'Dashboard loaded successfully', {
      result
    })
       
  } catch (error) {
    next (error);
  }
}