let User = require('../../../models/users');
let Friend = require('../../../models/follow').Friend;
let FriendRequest = require('../../../models/follow').FriendRequest;
let { catchAsyncError } = require('../../../../utils/constants/generateError')
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes');
let { sendOneToOneNotification, sendUserBulkNotifications } = require("../../../../utils/helpers/notificationUtils")
let mongoose = require("mongoose")


exports.sendFollowRequest = catchAsyncError(async (req, res) => {
    const { receiverId } = req.body;
    const senderId = req.user.id;

    if (senderId == receiverId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            'You cannot follow yourself'
        );
    }

    if (!receiverId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            'Please provide receiver ID'
        );
    }

    const isUserReceiverExist = await User.findOne({ _id: receiverId });

    if (!isUserReceiverExist) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            'Receiver not found'
        );
    }

    if (isUserReceiverExist.accountType == "Bussiness" || isUserReceiverExist.accountType == "Expert") {
        const isAlreadyFollower = await Friend.findOne({
            userId: receiverId,
            friendId: senderId,
            status: "active"
        });

        if (isAlreadyFollower) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.SUCCESS,
                `You are already following this ${isUserReceiverExist.accountType} account type user.`
            );
        }

        const findFriend = await User.findOne({ _id: senderId }).lean();

        if (!findFriend) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                'Sender not found'
            );
        }

        const createFriend = await Friend.create({
            userId: receiverId,
            friendId: senderId,
            name: findFriend.name || findFriend.businessName,
            username: findFriend.username,
            email: findFriend.email,
            profileImage: findFriend.profileImage
        });

        if (!createFriend) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                'Error in creating friend.'
            );
        }

        await sendOneToOneNotification(
            senderId,
            receiverId,
            "New Follower",
            `${findFriend?.name || findFriend?.businessName || "Someone"} started following you.`,
            {
                type: "follow",
                referenceId: senderId,
                referenceType: "User",
                senderName: findFriend?.name || findFriend?.businessName,
            }
        );

        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            `You are now following the requested ${isUserReceiverExist.accountType} account.`
        );
    }

    const isRequestExist = await FriendRequest.findOne({
        senderId,
        receiverId,
        status: 'pending'
    });

    if (isRequestExist) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.SUCCESS,
            'Request already sent'
        );
    }

    const isAlreadyFollower = await Friend.findOne({
        userId: receiverId,
        friendId: senderId
    });

    if (isAlreadyFollower) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.SUCCESS,
            `You are already following this ${isUserReceiverExist.accountType} account type user.`
        );
    }

    const followRequest = await FriendRequest.create({
        senderId,
        receiverId
    });

    if (!followRequest) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            'Friend Request not sent.'
        );
    }

    await sendOneToOneNotification(
        senderId,
        receiverId,
        "Follow Request",
        `${req.user.data.name || req.user.data.businessName || "Someone"} sent you a follow request.`,
        {
            type: "follow",
            referenceId: senderId,
            referenceType: "User",
            senderName: req.user.data.name || req.user.data.businessName,
        }
    );

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.CREATED,
        'Friend Request sent successfully.',
        followRequest
    );
});

exports.getFriendRequest = catchAsyncError(async (req, res) => {
    const receiverId = req.user.id;

    const friendRequests = await FriendRequest.find({ receiverId, status: "pending" });

    if (!friendRequests || friendRequests.length === 0) {
        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            'Friend requests not found'
        );
    }


    const friendRequestsData = await Promise.all(
        friendRequests.map(async (request) => {
            const sender = await User.findById(request.senderId);

            if(!sender){
                return {
                    senderId: null,
                    senderUsername: null,
                    senderName: null,
                    senderEmail: null,
                    status: null,
                    createdAt: null,
                    profileImage: null
                };
            }
            return {
                senderId: sender._id,
                senderUsername: sender.username,
                senderName: sender.name || sender.businessName,
                senderEmail: sender.email,
                status: request.status,
                createdAt: request.createdAt,
                profileImage: sender.profileImage
            };
        })
    );

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        'Pending friend requests retrieved successfully',
        { friendRequests: friendRequestsData, count: friendRequests.length }
    );
});

exports.cancelFriendRequest = catchAsyncError(async (req, res) => {
    const { receiverId } = req.body;
    const senderId = req.user.id;

    const friendRequest = await FriendRequest.findOne({
        senderId,
        receiverId,
        status: 'pending'
    });

    if (!friendRequest) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            'Friend request not found or already processed'
        );
    }

    await FriendRequest.deleteOne({ _id: friendRequest._id });

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        'Friend request cancelled successfully'
    );
});

exports.actionFollowRequest = catchAsyncError(async (req, res) => {
    const { senderId, action } = req.body;

    if (action == "accept") {
        const followRequest = await FriendRequest.findOne({
            senderId,
            receiverId: req.user.id,
            status: 'pending'
        });

        if (!followRequest) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                'Follow Request not found.'
            );
        }

        followRequest.status = "accepted";
        await followRequest.save();

        const findFriend = await User.findOne({ _id: senderId }).lean();

        if (!findFriend) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                'Sender not found'
            );
        }

        const createFriend = await Friend.create({
            userId: req.user.id,
            friendId: senderId,
            name: findFriend.name || findFriend.businessName,
            username: findFriend.username,
            email: findFriend.email,
            profileImage: findFriend.profileImage
        });

        if (!createFriend) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.ERROR,
                'Error on creating friend.'
            );
        }

        await FriendRequest.findOneAndDelete({
            senderId,
            receiverId: req.user.id,
            status: 'accepted'
        });

        await sendOneToOneNotification(
            req.user.id,
            senderId,
            "Follow request accepted",
            `${req.user.data.name || req.user.data.businessName || "Someone"} accept your follow request.`,
            {
                type: "follow",
                referenceId: senderId
            }
        );

    } else if (action == 'reject') {
        await FriendRequest.findOneAndDelete({
            senderId,
            receiverId: req.user.id,
            status: 'pending'
        });
    }

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        `Follow Request ${action}ed successfully.`
    );
});

exports.getFollowing = catchAsyncError(async (req, res) => {
    const friendId = req.query.userId || req.user.id;

    const following = await Friend.find({ friendId, status: "active" });

    if (!following || following.length === 0) {
        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            "No following found",
            []
        );
    }

    const followingData = await Promise.all(
        following.map(async (follow) => {
            const user = await User.findById(follow.userId);

            if(!user){
                return null
            }

            return {
                userId: user._id,
                username: user.username,
                name: user.name || user.businessName,
                email: user.email,
                profileImage: user?.profileImage,
                description : user?.description,
                shortBio : user?.shortBio,
                accountType : user?.accountType,
                status: follow.status,
                createdAt: follow.createdAt,
            };
        })
    );

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Following retrieved successfully",
        {
            following: followingData,
            count: following.length,
        }
    );
});

exports.getFollowers = catchAsyncError(async (req, res) => {
    const userId = req.query.userId || req.user.id ;
    const followers = await Friend.find({ userId: userId, status: "active" });

    if (!followers || followers.length === 0) {
        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            "User has no followers",
            []
        );
    }

    const followerData = await Promise.all(
        followers.map(async (follower) => {
            const user = await User.findById(follower.friendId);

            if(!user){
                return null
            }

            return {
                userId: user._id,
                username: user.username,
                name: user.name || user.businessName,
                email: user.email,
                profileImage: user?.profileImage,
                description : user?.description,
                shortBio : user?.shortBio,
                accountType : user?.accountType,
                status: follower.status,
                createdAt: follower.createdAt,
            };
        })
    );

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Followers retrieved successfully",
        {
            followers: followerData,
            count: followers.length,
        }
    );
});

exports.getMutualConnections = catchAsyncError(async (req, res) => {
    const loggedInUserId = new mongoose.Types.ObjectId(req.user.id);
    const userId = new mongoose.Types.ObjectId(req.query.userId);

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    let skip = (page - 1) * limit;

    const mutualConnections = await Friend.aggregate([
        {
            $match: {
                userId: userId,
                status: "active"
            }
        },
        {
            $lookup: {
                from: "friends",
                let: { friendId: "$friendId" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$userId", loggedInUserId] },
                                    { $eq: ["$friendId", "$$friendId"] },
                                    { $eq: ["$status", "active"] }
                                ]
                            }
                        }
                    }
                ],
                as: "mutualFriendInfo"
            }
        },
        {
            $match: {
                "mutualFriendInfo.0": { $exists: true }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "friendId",
                foreignField: "_id",
                as: "friendDetails"
            }
        },
        {
            $unwind: "$friendDetails"
        },
         {
              $lookup: {
                from: "friends",
                let: { mutualUserId: "$friendDetails._id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$userId", "$$mutualUserId"] },
                          { $eq: ["$friendId", new mongoose.Types.ObjectId(loggedInUserId)] },
                          { $eq: ["$status", "active"] }
                        ]
                      }
                    }
                  }
                ],
                as: "followingOfMutualFriendInfo"
              }
            },
            {
              $lookup: {
                from: "friendrequests",
                let: { mutualUserId: "$friendDetails._id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$senderId", new mongoose.Types.ObjectId(loggedInUserId)] },
                          { $eq: ["$receiverId", "$$mutualUserId"] },
                          { $eq: ["$status", "pending"] }
                        ]
                      }
                    }
                  }
                ],
                as: "friendShipStatus"
              }
            },
            {
                $addFields : {
                    isFollowingToMutualUser: {
                        $cond: [
                          { $gt: [{ $size: "$followingOfMutualFriendInfo" }, 0] },
                          "accepted",
                          {
                            $cond: [
                              { $gt: [{ $size: "$friendShipStatus" }, 0] },
                              "requested",
                              "notFollow"
                            ]
                          }
                        ]
                    }
                }
            },
        {
            $project: {
                _id: "$friendDetails._id",
                name: "$friendDetails.name",
                username: "$friendDetails.username",
                profileImage: "$friendDetails.profileImage",
                occupationTitle: "$friendDetails.occupationTitle",
                occupationSector: "$friendDetails.occupationSector",
                businessName: "$friendDetails.businessName",
                description: "$friendDetails.description",
                shortBio: "$friendDetails.shortBio",
                accountType: "$friendDetails.accountType",
                blueTick: "$friendDetails.blueTick",
                isFollowingToMutualUser: 1
            }
        },
        { $skip: skip },   
        { $limit: limit } 
    ]);

    const totalConnections = await Friend.aggregate([
        {
            $match: {
                userId: userId,
                status: "active"
            }
        },
        {
            $lookup: {
                from: "friends",
                let: { friendId: "$friendId" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$userId", loggedInUserId] },
                                    { $eq: ["$friendId", "$$friendId"] },
                                    { $eq: ["$status", "active"] }
                                ]
                            }
                        }
                    }
                ],
                as: "mutualFriendInfo"
            }
        },
        {
            $match: {
                "mutualFriendInfo.0": { $exists: true }
            }
        },
        {
            $count: "total"
        }
    ]);

    let total = totalConnections.length > 0 ? totalConnections[0].total : 0;
    let totalPages = Math.ceil(total / limit);
    let nextPage = page < totalPages ? page + 1 : null; 
    let previousPage = page > 1 ? page - 1 : null; 

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Mutual connections retrieved", {
        total,
        totalPages,
        currentPage: page,
        previousPage,
        nextPage,
        limit,
        mutualConnections,
    });
});


exports.unFriend = catchAsyncError(async (req, res) => {
    const { friendId, removeType } = req.body;

    let deletedRecord;

    if (removeType === "following") {
        // Removing from following list (i.e., the authenticated user unfollows friendId)
        deletedRecord = await Friend.findOneAndDelete({
            userId: friendId,
            friendId: req.user.id,
            status: "active"
        });
    } else if (removeType === "follower") {
        // Removing from followers list (i.e., the authenticated user removes friendId as a follower)
        deletedRecord = await Friend.findOneAndDelete({
            friendId: friendId,
            userId: req.user.id,
            status: "active"
        });
    } else {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Invalid removeType. Valid options are 'following' or 'follower'."
        );
    }

    if (deletedRecord) {
        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            `Successfully removed ${removeType === 'following' ? 'following' : 'follower'} relationship.`,
            deletedRecord
        );
    } else {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "No active relationship found to remove."
        );
    }
});

exports.blockFriend = catchAsyncError(async (req, res) => {
    const { friendId, userId } = req.body;

    const setBlockFriend = await Friend.findOneAndUpdate(
        { userId, friendId, status: "Active" },
        { status: "Blocked" },
        { new: true }
    );

    if (!setBlockFriend) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Friend not found to Block"
        );
    }

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Friend blocked successfully",
        setBlockFriend
    );
});

exports.unblockFriend = catchAsyncError(async (req, res) => {
    const { friendId, userId } = req.body;

    const setUnblockFriend = await Friend.findOneAndUpdate(
        { userId, friendId, status: "Blocked" },
        { status: "Active" },
        { new: true }
    );

    if (!setUnblockFriend) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Friend not found to unblock"
        );
    }

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Friend unblocked successfully",
        setUnblockFriend
    );
});
