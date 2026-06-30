const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
const NotificationAlert = require("../../../models/notificationAlert")
const User = require("../../../models/users");
const mongoose = require("mongoose");
const { addToAdminAlertNotificationQueue } = require("../../../../utils/queue/adminAlertNotificationQueue");


exports.addNotificationAlert = catchAsyncError(async (req, res) => {
    const { title, message, userType, selectedUsers } = req.body;

    if (!title || !message || !userType) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Title, message, and userType are required"
        );
    }

    let numberOfUsers = 0;
    let userIds = [];
    let users = [];

    if (userType === "Selected") {
        if (!Array.isArray(selectedUsers) || selectedUsers.length === 0) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Selected user IDs are required when userType is 'Selected'"
            );
        }
        userIds = selectedUsers;
        numberOfUsers = userIds.length;
        
    } else {
        users = userType === "All"
            ? await User.find({ status: "active" }).select("_id")
            : await User.find({ accountType: userType, status: "active" }).select("_id");

        userIds = users.map(user => user._id);
        numberOfUsers = userIds.length;
        
    }

    const notification = await NotificationAlert.create({
        title,
        message,
        userType,
        numberOfUsers,
        selectedUsers : userIds,
        sentOn: new Date(),
    });

    if (numberOfUsers === 0) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "No users found to send notifications"
        );
    }

    users = await User.find({ _id: { $in: userIds } }).select("tokens");

    
    const tokens = users.flatMap(user => user.tokens.map(tokenObj => tokenObj.fcmToken)).filter(Boolean);

    // if (!tokens.length) {
    //     return response.responseHandlerWithMessage(
    //         res,
    //         false,
    //         statusCode.RESULTNOTFOUND,
    //         "No valid FCM tokens found for the selected users"
    //     );
    // }

    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        await addToAdminAlertNotificationQueue(title, message, batch, data = {notificationType : "admin_alert", notificationAlertId : notification._id});
    }

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        "Notification alert added and sent successfully"
    );
});

exports.getNotificationAlerts = catchAsyncError(async (req, res) => {
    const { userType, status, startDate, endDate, search, pageNo = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(pageNo, 10);
    const pageSize = parseInt(limit, 10);

    let matchQuery = {};

    if (userType && userType !== "All") {
        matchQuery.userType = userType;
    }

    if (status) {
        matchQuery.status = status;
    }

    if (startDate && endDate) {
        matchQuery.sentOn = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        };
    }

    if (search) {
        matchQuery.$or = [
            { title: { $regex: search, $options: "i" } },
            { message: { $regex: search, $options: "i" } }
        ];
    }

    const notifications = await NotificationAlert.aggregate([
        { $match: matchQuery },
        { $sort: { createdAt: -1 } },
        {
            $facet: {
                metadata: [{ $count: "total" }],
                data: [{ $skip: (pageNumber - 1) * pageSize }, { $limit: pageSize }]
            }
        },
        {
            $project: {
                totalRecords: { $arrayElemAt: ["$metadata.total", 0] },
                notifications: "$data"
            }
        }
    ]);

    const result = notifications[0] || { totalRecords: 0, notifications: [] };

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Notification alerts fetched successfully",
        {
            totalRecords: result.totalRecords || 0,
            currentPage: pageNumber,
            totalPages: Math.ceil((result.totalRecords || 0) / pageSize),
            notifications: result.notifications
        }
    );
});

exports.updateNotificationAlert = catchAsyncError(async (req, res) => {
    const { notificationId, title, message, userType, selectedUsers } = req.body;

    if (!notificationId || (!title && !message && !userType)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Notification ID and at least one field to update are required"
        );
    }

    let notification = await NotificationAlert.findById(notificationId);
    if (!notification) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Notification alert not found"
        );
    }

    if (title) notification.title = title;
    if (message) notification.message = message;
    if (userType) notification.userType = userType;

    let numberOfUsers = notification.numberOfUsers;
    let toUsers = [];

    if (userType === "Selected") {
        if (!Array.isArray(selectedUsers) || selectedUsers.length === 0) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Selected user IDs are required when userType is 'Selected'"
            );
        }
        numberOfUsers = selectedUsers.length;
        toUsers = selectedUsers;
    } else {
        let userQuery = { status: "active" };
        if (userType !== "All") {
            userQuery.accountType = userType;
        }

        let users = await User.find(userQuery).select("_id");
        toUsers = users.map(user => user._id);
        numberOfUsers = toUsers.length;
    }

    notification.numberOfUsers = numberOfUsers;
    notification.selectedUsers = toUsers;
    
    await notification.save();

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        "Notification alert updated."
    );
});

exports.deleteNotificationAlert = catchAsyncError(async (req, res) => {
    const { notificationId } = req.query;

    if (!notificationId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Notification ID is required"
        );
    }

    const deletedNotification = await NotificationAlert.findByIdAndDelete(notificationId);

    if (!deletedNotification) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Notification alert not found"
        );
    }

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        "Notification alert deleted successfully"
    );
});

exports.resendNotificationAlert = catchAsyncError(async (req, res) => {

    const { notificationAlertId } = req.body;

    if (!notificationAlertId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Notification Alert ID is required"
        );
    }

    const notification = await NotificationAlert.findById(notificationAlertId);
    
    if (!notification) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Notification Alert not found"
        );
    }

    const { title, message, userType } = notification;
    let users = [];

    if (userType === "Selected") {
        if (!notification.selectedUsers || !notification.selectedUsers.length) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "No selected users found for this notification"
            );
        }
        users = await User.find({ _id: { $in: notification.selectedUsers }, status: "active" }).select("tokens");
    } else if (userType === "All") {
        users = await User.find({ status: "active" }).select("tokens");
    } else {
        users = await User.find({ accountType: userType, status: "active" }).select("tokens");
    }

    const tokens = users.flatMap(user => user.tokens.map(tokenObj => tokenObj.fcmToken)).filter(Boolean);

    // if (!tokens.length) {
    //     return response.responseHandlerWithMessage(
    //         res,
    //         false,
    //         statusCode.RESULTNOTFOUND,
    //         "No valid FCM tokens found for the selected users"
    //     );
    // }

    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        await addToAdminAlertNotificationQueue(title, message, batch, data = {notificationType : "admin_alert", notificationAlertId : notificationAlertId});
    }

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        "Notifications added to the queue in batches"
    );
});

exports.getReceivedUsers = catchAsyncError(async (req, res) => {
    const { notificationAlertId, pageNo = 1, limit = 10, search } = req.query;

    if (!notificationAlertId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Notification Alert ID is required"
        );
    }

    const page = parseInt(pageNo, 10);
    const perPage = parseInt(limit, 10);
    const skip = (page - 1) * perPage;

    const matchStage = {
        _id: new mongoose.Types.ObjectId(notificationAlertId)
    };

    const pipeline = [
        { $match: matchStage },
        { 
            $lookup: {
                from: "users", 
                localField: "toUsers",
                foreignField: "_id",
                as: "userDetails",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            businessName: 1,
                            username: 1,
                            profileImage: 1,
                            accountType: 1,
                            description: 1,
                            shortBio: 1,
                            blueTick: 1
                        }
                    }
                ]
            }
        },
        { $unwind: "$userDetails" },
        {
            $match: search
                ? {
                      $or: [
                          { "userDetails.username": { $regex: search, $options: "i" } },
                          { "userDetails.name": { $regex: search, $options: "i" } },
                          { "userDetails.businessName": { $regex: search, $options: "i" } }
                      ]
                  }
                : {}
        },
        {
            $facet: {
                metadata: [{ $count: "total" }],
                data: [{ $skip: skip }, { $limit: perPage }]
            }
        }
    ];

    const result = await NotificationAlert.aggregate(pipeline);

    const users = result[0]?.data || [];
    const total = result[0]?.metadata[0]?.total || 0;
    const totalPages = Math.ceil(total / perPage);

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Users retrieved successfully", {
        users,
        totalUsers: total,
        totalPages,
        currentPage: page,
        perPage
    });
});






