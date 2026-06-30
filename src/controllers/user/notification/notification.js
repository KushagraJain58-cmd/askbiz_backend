let { catchAsyncError } = require('../../../../utils/constants/generateError');
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes')
const UserNotification = require("../../../models/userNotification");
const User = require("../../../models/users");
const mongoose = require("mongoose");
const { sendMulticastNotification } = require("../../../config/notification")

exports.getNotifications = catchAsyncError(async (req, res) => {
    const userId = req.user.id; 
    const { pageNo = 1, limit = 10 } = req.query; 
    const skip = (parseInt(pageNo) - 1) * parseInt(limit); 

    const notifications = await UserNotification.aggregate([
        { $match: { recipientId: new mongoose.Types.ObjectId(userId) } },
        {
            $lookup: {
                from: "users",
                localField: "senderId",
                foreignField: "_id",
                as: "sender"
            }
        },
        { $unwind: { path: "$sender", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "posts",
                localField: "referenceId",
                foreignField: "_id",
                as: "postReference"
            }
        },
        {
            $lookup: {
                from: "comments",
                localField: "referenceId",
                foreignField: "_id",
                as: "commentReference"
            }
        },
        {
            $lookup: {
                from: "communities",
                localField: "referenceId",
                foreignField: "_id",
                as: "communityReference"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "referenceId",
                foreignField: "_id",
                as: "userReference"
            }
        },
        {
            $lookup: {
                from: "reports",
                localField: "referenceId",
                foreignField: "_id",
                as: "reportReference"
            }
        },
        {
            $lookup: {
                from: "notificationalerts",
                localField: "referenceId",
                foreignField: "_id",
                as: "adminNotificationReference"
            }
        },
        {
            $set: {
                referenceData: {
                    $switch: {
                        branches: [
                            { case: { $eq: ["$referenceType", "Post"] }, then: { $arrayElemAt: ["$postReference", 0] } },
                            { case: { $eq: ["$referenceType", "Comment"] }, then: { $arrayElemAt: ["$commentReference", 0] } },
                            { case: { $eq: ["$referenceType", "Community"] }, then: { $arrayElemAt: ["$communityReference", 0] } },
                            { case: { $eq: ["$referenceType", "User"] }, then: { $arrayElemAt: ["$userReference", 0] } },
                            { case: { $eq: ["$referenceType", "Report"] }, then: { $arrayElemAt: ["$reportReference", 0] } },
                            { case: { $eq: ["$referenceType", "NotificationAlert"] }, then: { $arrayElemAt: ["$adminNotificationReference", 0] } }
                        ],
                        default: null
                    }
                }
            }
        },

        {
            $project: {
                _id: 1,
                senderId: 1,
                recipientId: 1,
                type: 1,
                referenceId: 1,
                referenceType: 1,
                message: 1,
                isRead: 1,
                createdAt: 1,
                sender: {
                    _id: 1,
                    username: 1,
                    profileImage: 1,
                    name: 1,
                    businessName : 1
                },
                referenceData: {
                    _id: 1,
                    title: { $ifNull: ["$referenceData.title", "$referenceData.name"] },
                    imagesOrVideos:  { $ifNull: ["$referenceData.imagesOrVideos", "$referenceData.imagesOrVideos"] },
                    description:  { $ifNull: ["$referenceData.description", "$referenceData.description"] }
                }
            }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
    ]);


    const notificationIdsToUpdate = notifications
            .filter(notification => !notification.isRead)
            .map(notification => notification._id);
    
    if (notificationIdsToUpdate.length > 0) {
        await UserNotification.updateMany(
            { _id: { $in: notificationIdsToUpdate } },
            { $set: { isRead: true } }
        );
    }

    const totalNotifications = await UserNotification.countDocuments({ recipientId: userId });

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Notifications fetched successfully", {
        total: totalNotifications,
        pageNo: parseInt(pageNo),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalNotifications / limit),
        nextPage : Number(pageNo) < totalNotifications ? Number(pageNo) + 1 : null,
        prevPage: Number(pageNo) > 1 ? Number(pageNo) - 1 : null,
        notifications
    });
});

exports.deleteNotification = catchAsyncError(async (req, res) => {
    const userId = req.user.id;
    const { notificationId } = req.query;

    if (notificationId) {

        const deletedNotification = await UserNotification.findOneAndDelete({
            _id: notificationId,
            recipientId: userId
        });

        if (!deletedNotification) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "Notification not found"
            );
        }

        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            "Notification deleted successfully"
        );
    } else {
        await UserNotification.deleteMany({ recipientId: userId });

        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            "All notifications deleted successfully"
        );
    }
});

exports.hasUnseenNotifications = catchAsyncError(async (req, res) => {
    const userId = req.user.id;

    const hasUnread = await UserNotification.exists({ recipientId: userId, isRead: false });

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Pending notification status fetched successfully",
        { hasUnread: !!hasUnread }
    );
});

exports.toggleNotification = catchAsyncError(async (req, res) => {
    const { toggleAction } = req.query;
    const userId = req.user.id;

    if (!["on", "off"].includes(toggleAction)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Invalid toggleAction! Use 'on' or 'off'."
        );
    }

    const notificationOff = toggleAction === "off"; // Set based on action

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { notificationOff },
        { new: true, select: "notificationOff" } // Returns updated document
    );

    if (!updatedUser) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "User not found!"
        );
    }

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        `Notification ${toggleAction} successfully!`,
        { notificationOff: updatedUser.notificationOff }
    );
});

exports.testPushNotification = catchAsyncError(async(req, res)=>{

    const { tokens, title, body, data } = req.body;

    const notification = await sendMulticastNotification(tokens, title, body, data)

    return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, "Notification sent successfully!");

})
