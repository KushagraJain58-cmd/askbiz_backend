let response = require('../../../utils/constants/responseFunctions');
let statusCode = require('../../../utils/constants/responseCodes');
const { catchAsyncError } = require('../../../utils/constants/generateError');
const User = require("../../models/users");
const Admin = require("../../models/admin");
let Friend = require('../../models/follow').Friend;
const ChatRoom = require("../../models/chat");
let Message = require("../../models/message")
let ChatRequest = require("../../models/chatRequests");
let mongoose = require("mongoose");
const chatRequests = require('../../models/chatRequests');
const redisClient = require("../../config/redis");
const { sendOneToOneNotification, sendUserBulkNotifications } = require("../../../utils/helpers/notificationUtils")


// exports.createRoom = catchAsyncError(async (req, res) => {
//     let { type, groupName, groupImage, groupDescription, participants = [], isAdminChat } = req.body;
//     const creator = req.user.id || req.user.data.id;

//     if (!type || !Array.isArray(participants)) {
//         return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Invalid request data');
//     }

//     if (isAdminChat && type === "group") {
//         return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Admin chat can only be created for private chat');
//     }

//     if (type === 'oneToOne' && participants.length !== 1) {
//         return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'OneToOne chat must have exactly one other participant');
//     }

//     if (type === 'group' && participants.length < 1) {
//         return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Group chat must have at least one other participant');
//     }

//     const participantSet = new Set(participants.map(p => p.person.toString()));
//     if (!participantSet.has(creator)) {
//         participants.push({ person: creator, status: 'active', isAdmin: true });
//     }

//     const participantIds = participants.map(p => p.person);

//     if (type === "oneToOne") {
//         let participantsKey = participantIds.join('-');
//         let reverseParticipantsKey = [...participantIds].reverse().join('-');

//         const existingChat = await ChatRoom.findOne({
//             type: 'oneToOne',
//             $or: [
//                 { participantsKey: participantsKey },
//                 { participantsKey: reverseParticipantsKey }
//             ]
//         }).lean();

//         if (existingChat) {
//             const opponentId = participantIds.find(id => id !== creator);

//             const rejectedRequest = await ChatRequest.findOne({
//                 senderId: creator,
//                 receiverId: opponentId,
//                 chatRoomId: existingChat._id,
//                 requestType: 'oneToOne',
//                 status: 'rejected'
//             }).lean();

//             if (rejectedRequest) {

//                 const isFollowing = await Friend.findOne({
//                     $or: [
//                         { userId: creator, friendId: opponentId },
//                         { userId: opponentId, friendId: creator }
//                     ]
//                 });

//                 if (!isFollowing) {

//                     await ChatRequest.updateOne(
//                         { _id: rejectedRequest._id },
//                         {
//                             $set: {
//                                 status: isAdminChat ? "accepted" : "pending"
//                             }
//                         }
//                     );

//                     await sendOneToOneNotification(
//                         req.user.id,
//                         opponentId.toString(),
//                         "Message Request",
//                         `${req.user.data.name || req.user.data.businessName || "Someone"} sent you a message request`,
//                         {
//                             type: "message",
//                             chatRoomId: chatRoom._id.toString()
//                         }
//                     )

//                     return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'Chat request resent successfully', {
//                         isNewlyCreated: true,
//                         ...existingChat
//                     });
//                 }

//                 return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'Users are now following each other, no chat request needed', {
//                     isNewlyCreated: false,
//                     ...existingChat
//                 });
//             }

//             return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'Chat inbox already exists', {
//                 isNewlyCreated: false,
//                 ...existingChat
//             });
//         }
//     }

//     const updatedParticipants = [];
//     for (let p of participants) {
//         const participantId = p.person.toString();

//         let status = p.status || "inactive";
//         let isAdmin = p.isAdmin || false;

//         const isFollowing = await Friend.findOne({
//             $or: [
//                 { userId: creator, friendId: participantId },
//                 { userId: participantId, friendId: creator }
//             ]
//         });

//         if (isFollowing || isAdminChat) {
//             status = "active";
//         }

//         updatedParticipants.push({
//             person: participantId,
//             isAdmin,
//             status
//         });
//     }

//     const chatRoom = new ChatRoom({ type, groupName, groupImage, groupDescription, creator, participants: updatedParticipants, isAdminChat });
//     await chatRoom.save();

//     const chatRequests = [];
//     for (let participant of updatedParticipants) {

//         const participantId = participant.person;

//         if (participantId.toString() !== creator && participant.status !== "active") {

//             chatRequests.push({
//                 senderId: creator,
//                 receiverId: participantId,
//                 chatRoomId: chatRoom._id,
//                 requestType: type,
//                 status: isAdminChat ? "accepted" : "pending"
//             });
//         }
//     }

//     if (chatRequests.length > 0) {
//         await ChatRequest.insertMany(chatRequests);
//     }

//     const chatRoomData = await ChatRoom.findById(chatRoom._id).lean();

//     const participentToSentNotiId = chatRequests
//         .filter(req => req.status === "pending")
//         .map(req => req.receiverId.toString());


//     const notiMess = type == "oneToOne" ? `${req.user.data.name || req.user.data.businessName || "Someone"} sent you a message request` :
//     `${req.user.data.name || req.user.data.businessName || "Someone"} sent you an invite to join group.`

//     await sendUserBulkNotifications(
//         req.user.id,
//         participentToSentNotiId,
//         type == "oneToOne" ? "Message Request" : "Group Chat Request",
//         notiMess,
//         {
//             type: "message",
//             chatRoomId: chatRoom._id.toString()
//         }
//     )

//     return response.responseHandlerWithData(res, true, statusCode.CREATED, 'Chat room created successfully', {
//         isNewlyCreated: true,
//         ...chatRoomData
//     });
// });


exports.createRoom = catchAsyncError(async (req, res) => {
    let { type, groupName, groupImage, groupDescription, participants = [], isAdminChat } = req.body;
    const creator = req.user.id || req.user.data.id;

    if (!type || !Array.isArray(participants)) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Invalid request data');
    }

    if (isAdminChat && type === "group") {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Admin chat can only be created for private chat');
    }

    if (type === 'oneToOne' && participants.length !== 1) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'OneToOne chat must have exactly one other participant');
    }

    if (type === 'group' && participants.length < 1) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Group chat must have at least one other participant');
    }

    const participantSet = new Set(participants.map(p => p.person.toString()));
    if (!participantSet.has(creator)) {
        participants.push({ person: creator, status: 'active', isAdmin: true });
    }

    const participantIds = participants.map(p => p.person);

    if (type === "oneToOne") {
        let participantsKey = participantIds.join('-');
        let reverseParticipantsKey = [...participantIds].reverse().join('-');

        const existingChat = await ChatRoom.findOne({
            type: 'oneToOne',
            $or: [
                { participantsKey: participantsKey },
                { participantsKey: reverseParticipantsKey }
            ]
        }).lean();

        if (existingChat) {
            const opponentId = participantIds.find(id => id !== creator);

            const rejectedRequest = await ChatRequest.findOne({
                senderId: creator,
                receiverId: opponentId,
                chatRoomId: existingChat._id,
                requestType: 'oneToOne',
                status: 'rejected'
            }).lean();

            if (rejectedRequest) {

                const isFollowing = await Friend.findOne({
                    $or: [
                        { userId: creator, friendId: opponentId },
                        { userId: opponentId, friendId: creator }
                    ]
                });

                if (!isFollowing) {

                    await ChatRequest.updateOne(
                        { _id: rejectedRequest._id },
                        {
                            $set: {
                                status: isAdminChat ? "accepted" : "pending"
                            }
                        }
                    );

                    await sendOneToOneNotification(
                        req.user.id,
                        opponentId.toString(),
                        "Message Request",
                        `${req.user.data.name || req.user.data.businessName || "Someone"} sent you a message request`,
                        {
                            type: "message",
                            chatRoomId: existingChat._id.toString()
                        }
                    )

                    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'Chat request resent successfully', {
                        isNewlyCreated: true,
                        participantsKey : existingChat.participantsKey,
                        chatRoomId : existingChat._id.toString()
                    });
                }

                return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'Users are now following each other, no chat request needed', {
                    isNewlyCreated: false,
                    participantsKey : existingChat.participantsKey,
                    chatRoomId : existingChat._id.toString()
                });
            }

            return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'Chat inbox already exists', {
                isNewlyCreated: false,
                participantsKey : existingChat.participantsKey,
                chatRoomId : existingChat._id.toString()
            });
        }
    }

    const updatedParticipants = [];
    for (let p of participants) {
        const participantId = p.person.toString();

        let status = p.status || "inactive";
        let isAdmin = p.isAdmin || false;

        const isFollowing = await Friend.findOne({
            $or: [
                { userId: creator, friendId: participantId },
                { userId: participantId, friendId: creator }
            ]
        });

        if (isFollowing || isAdminChat) {
            status = "active";
        }

        updatedParticipants.push({
            person: participantId,
            isAdmin,
            status
        });
    }

    const chatRoom = new ChatRoom({ type, groupName, groupImage, groupDescription, creator, participants: updatedParticipants, isAdminChat });
    await chatRoom.save();

    const chatRequests = [];
    for (let participant of updatedParticipants) {

        const participantId = participant.person;

        if (participantId.toString() !== creator && participant.status !== "active") {
            
            chatRequests.push({
                senderId: creator,
                receiverId: participantId,
                chatRoomId: chatRoom._id,
                requestType: type,
                status: isAdminChat ? "accepted" : "pending"
            });
        }
    }    

    if (chatRequests.length > 0) {
        await ChatRequest.insertMany(chatRequests);
    }

    const participentToSentNotiId = chatRequests
    .filter(req => req.status === "pending")
    .map(req => req.receiverId.toString());


    const notiMess = type == "oneToOne" ? `${req.user.data.name || req.user.data.businessName || "Someone"} sent you a message request` :
    `${req.user.data.name || req.user.data.businessName || "Someone"} sent you an invite to join group.`


    await sendUserBulkNotifications(
        req.user.id,
        participentToSentNotiId,
        type == "oneToOne" ? "Message Request" : "Chat group Request",
        notiMess,
        {
            type: "message",
            chatRoomId: chatRoom._id.toString()
        }
    )

    return response.responseHandlerWithData(res, true, statusCode.CREATED, 'Chat room created successfully', {
        isNewlyCreated: true,
        participantsKey : chatRoom.participantsKey,
        chatRoomId : chatRoom._id.toString()
    });
});


exports.updateGroup = catchAsyncError(async (req, res) => {
    const { chatRoomId, groupName, groupImage, groupDescription } = req.body;
    const userId = req.user.id;

    if (!chatRoomId) {
        return response.responseHandlerWithMessage(res, false, 400, 'Chat Room ID is required');
    }

    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom || chatRoom.type !== 'group') {
        return response.responseHandlerWithMessage(res, false, 404, 'Group chat not found');
    }

    const isAdmin = chatRoom.participants.some(p => p.person.toString() === userId.toString() && p.isAdmin);
    if (!isAdmin) {
        return response.responseHandlerWithMessage(res, false, 403, 'Only admins can update the group');
    }

    chatRoom.groupName = groupName || chatRoom.groupName;
    chatRoom.groupImage = groupImage || chatRoom.groupImage;
    chatRoom.groupDescription = groupDescription || chatRoom.groupDescription;
    await chatRoom.save();

    return response.responseHandlerWithData(res, true, 200, 'Group updated successfully', chatRoom);
});

exports.getChats = catchAsyncError(async (req, res) => {
    const userId = req.user.id || req.user.data.id;

    console.log("userId--", userId)

    const { limit = 10, pageNo = 1, search } = req.query;


    const pageLimit = parseInt(100, 10);
    const page = parseInt(1, 10);
    const skip = pageLimit * (page - 1);

    const loggedInUser = await User.findById(userId).select("blockedUsers");
    const blockedUsers = loggedInUser?.blockedUsers?.map(id => id.toString()) || [];

    let matchStage = {
        "participants": {
            $elemMatch: {
                "person": new mongoose.Types.ObjectId(userId),
                "status": { $nin: ["deleted", "inactive"] }
            }
        }
    };

    const chatRooms = await ChatRoom.aggregate([
        { $match: matchStage },
        {
            $lookup: {
                from: "messages",
                localField: "_id",
                foreignField: "chatRoomId",
                as: "messages"
            }
        },
        {
            $match: {
                $or: [
                    { type: "group" },
                    {
                        $and: [
                            { type: "oneToOne" },
                            {
                                "messages.0": { $exists: true },
                                "messages.status": "active",
                            }
                        ]
                    }
                ]
            }
        },

        {
            $addFields: {
                lastMessage: {
                    $arrayElemAt: [
                        {
                            $filter: {
                                input: "$messages",
                                as: "msg",
                                cond: { $eq: ["$$msg.status", "active"] } // Only active messages
                            }
                        },
                        -1
                    ]
                },
                lastMessageTime: {
                    $cond: {
                        if: { $gt: [{ $size: "$messages" }, 0] },
                        then: { $arrayElemAt: ["$messages.createdAt", -1] },
                        else: "$createdAt"
                    }
                },
                unseenMessageCount: {
                    $size: {
                        $filter: {
                            input: "$messages",
                            as: "msg",
                            cond: { $not: { $in: [new mongoose.Types.ObjectId(userId), "$$msg.seenBy"] } }
                        }
                    }
                }
            }
        },
        {
            $addFields: {
                participantDetails: {
                    $filter: {
                        input: "$participants",
                        as: "p",
                        cond: { $eq: ["$$p.person", new mongoose.Types.ObjectId(userId)] }
                    }
                }
            }
        },
        {
            $addFields: {
                removedAt: { $arrayElemAt: ["$participantDetails.removedAt", 0] },
                clearedAt: { $arrayElemAt: ["$participantDetails.clearedAt", 0] },
                isMuted: { $arrayElemAt: ["$participantDetails.muteNotifications", 0] }
            }
        },
        {
            $addFields: {
                lastMessage: {
                    $cond: {
                        if: {
                            $or: [
                                {
                                    $and: [
                                        { $ifNull: ["$clearedAt", false] },
                                        { $gt: ["$clearedAt", "$lastMessage.createdAt"] }
                                    ]
                                },
                                {
                                    $and: [
                                        { $ifNull: ["$removedAt", false] },
                                        { $lt: ["$lastMessage.createdAt", "$removedAt"] }
                                    ]
                                }
                            ]
                        },
                        then: null,
                        else: "$lastMessage"
                    }
                },

                lastMessageTime: {
                    $cond: {
                        if: {
                            $and: [
                                { $ifNull: ["$clearedAt", false] },
                                { $gt: ["$clearedAt", "$lastMessage.createdAt"] }
                            ]
                        },
                        then: "$createdAt",
                        else: "$lastMessageTime"
                    }
                }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "participants.person",
                foreignField: "_id",
                as: "participantDetailsForUser",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            businessName: 1,
                            profileImage: 1,
                            shortBio: 1,
                            description: 1,
                            username: 1,
                            blueTick: 1,
                            accountType: 1,
                            occupationTitle: 1,
                            occupationSector: 1,
                            workExperience: 1,
                            companyName: 1,
                            expertise: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "admins",
                localField: "participants.person",
                foreignField: "_id",
                as: "participantDetailsForAdmin",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            profileImage: 1,
                            email: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                participantDetails: { $concatArrays: ["$participantDetailsForUser", "$participantDetailsForAdmin"] }
            }
        },
        {
            $addFields: {
                participants: {
                    $map: {
                        input: "$participants",
                        as: "p",
                        in: {
                            person: "$$p.person",
                            status: "$$p.status",
                            muteNotifications: "$$p.muteNotifications",
                            joinedAt: "$$p.joinedAt",
                            isAdmin: "$$p.isAdmin",
                            personDetail: {
                                $arrayElemAt: [
                                    {
                                        $filter: {
                                            input: "$participantDetails",
                                            as: "user",
                                            cond: { $eq: ["$$user._id", "$$p.person"] }
                                        }
                                    },
                                    0
                                ]
                            }
                        }
                    }
                }
            }
        },
        {
            $addFields: {
                isBlocked: {
                    $cond: {
                        if: {
                            $and: [
                                { $eq: ["$type", "oneToOne"] },
                                {
                                    $gt: [
                                        {
                                            $size: {
                                                $filter: {
                                                    input: "$participants",
                                                    as: "p",
                                                    cond: {
                                                        $in: [
                                                            { $toString: "$$p.person" },
                                                            blockedUsers
                                                        ]
                                                    }
                                                }
                                            }
                                        },
                                        0
                                    ]
                                }
                            ]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        ...(search
            ? [{
                $match: {
                    $or: [
                        { groupName: { $regex: search, $options: "i" } },
                        { "participants.personDetail.businessName": { $regex: search, $options: "i" } },
                        { "participants.personDetail.username": { $regex: search, $options: "i" } },
                        { "participants.personDetail.name": { $regex: search, $options: "i" } },
                        { "participants.personDetail.email": { $regex: search, $options: "i" } }
                    ]
                }
            }]
            : []
        ),
        { $sort: { "lastMessageTime": -1 } },
        { $skip: skip },
        { $limit: pageLimit },
        {
            $project: {
                messages: 0,
                participantDetailsForAdmin: 0,
                participantDetailsForUser: 0,
                participantDetails: 0,
                clearedAt: 0
            }
        }
    ]);

    const totalChats = chatRooms.length;
    const totalPages = Math.ceil(totalChats / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "User chat rooms fetched", {
        totalChats,
        totalPages,
        currentPage: page,
        nextPage,
        prevPage,
        chatsInCurrentPage: chatRooms.length,
        chatRooms
    });
});

exports.makeAnAdminorRemove = catchAsyncError(async (req, res) => {

    const userId = req.user.id;

    const io = req.app.get('socket');

    const { roomId, participantId, actionType } = req.body;

    if (!roomId || !participantId || !["addAdmin", "removeAdmin"].includes(actionType)) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'roomId, participantId, and actionType are required.');
    }

    const chatRoom = await ChatRoom.findOne({ _id: roomId }, 'participants');

    if (!chatRoom) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Chat room not found.');
    }

    const requestingUser = chatRoom.participants.find(p => p.person.toString() === userId);

    if (!requestingUser || !requestingUser.isAdmin) {
        return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, 'Only an admin can manage admin roles.');
    }

    const participant = chatRoom.participants.find(p => p.person.toString() === participantId);

    if (!participant) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'User is not a participant of this group.');
    }

    const participantSocketId = await redisClient.hGet("onlineUsers", participantId.toString());

    if (actionType === "addAdmin") {
        if (participant.isAdmin) {
            return response.responseHandlerWithMessage(res, false, statusCode.CONFLICT, 'User is already an admin.');
        }
        await ChatRoom.updateOne(
            { _id: roomId, "participants.person": participantId },
            { $set: { "participants.$.isAdmin": true } }
        );

        if (participantSocketId) {
            io.to(participantSocketId).emit('update-group-admin', { roomId, participantId, updateAdmin: true });
        }

        return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'User successfully promoted to admin.', { participantId });
    }

    if (actionType === "removeAdmin") {
        const totalAdmins = chatRoom.participants.filter(p => p.isAdmin).length;

        if (!participant.isAdmin) {
            return response.responseHandlerWithMessage(res, false, statusCode.CONFLICT, 'User is not an admin.');
        }

        if (totalAdmins === 1) {
            return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, 'Cannot remove the only admin. Assign another admin first.');
        }

        await ChatRoom.updateOne(
            { _id: roomId, "participants.person": participantId },
            { $set: { "participants.$.isAdmin": false } }
        );

        if (participantSocketId) {
            io.to(participantSocketId).emit('update-group-admin', { roomId, participantId, updateAdmin: false });
        }

        return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'User successfully removed from admin role.', { participantId });
    }
});

exports.getChatMessages = catchAsyncError(async (req, res) => {

    const userId = new mongoose.Types.ObjectId(req.user.id || req.user.data.id);
    
    const { chatRoomId, limit = 100, pageNo = 1,  order = "desc" } = req.query;

    const sortOrder = order === "asc" ? 1 : -1;

    if (!chatRoomId) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "chatRoomId is required.");
    }

    const chatRoom = await ChatRoom.findOne({ _id: chatRoomId, "participants.person": userId }).lean();
    if (!chatRoom) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "Chat room not found.");
    }

    const userParticipant = chatRoom.participants.find(p => p.person.toString() === userId.toString());

    // if (userParticipant.status === 'removed') {
    //     return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, "You are no longer part of this chat room.");
    // }

    const clearedAt = userParticipant?.clearedAt || new Date(0);

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const skip = pageLimit * (page - 1);

    let isBlockedOneToOneChat = false;
    let isBlockedByLoggedIn = false;
    let isRemovedFromGroup = false;

    if (chatRoom.type === "oneToOne") {
        const opponentParticipants = chatRoom.participants.filter(p => p.person.toString() !== userId.toString());
        const opponentUserId = opponentParticipants[0]?.person.toString();

        if (opponentUserId) {
            let loggedInUser = await User.findById(userId).select('blockedUsers').lean();
            if (!loggedInUser) loggedInUser = await Admin.findById(userId).lean();

            const opponentUser = await User.findById(opponentUserId).select("blockedUsers").lean();
            const loggedInBlockedUsers = (loggedInUser?.blockedUsers || []).map(id => id.toString());
            const opponentBlockedUsers = (opponentUser?.blockedUsers || []).map(id => id.toString());

            isBlockedByLoggedIn = loggedInBlockedUsers.includes(opponentUserId);
            const isBlockedByOpponent = opponentBlockedUsers.includes(userId.toString());

            isBlockedOneToOneChat = isBlockedByLoggedIn || isBlockedByOpponent;
        }
    }else if (chatRoom.type === "group"){

        const loggedInParticipant = chatRoom.participants.find(
            p => p.person.toString() === userId.toString()
        );
    
        if (loggedInParticipant?.status === "removed") {
            isRemovedFromGroup = true;
        }

    }

    const loggedInUser = await User.findById(userId).select("blockedUsers").lean();
    const blockedUsers = loggedInUser?.blockedUsers || [];

    const totalMessagesAggregation = await Message.aggregate([
        {
            $match: {
                chatRoomId: new mongoose.Types.ObjectId(chatRoomId),
                createdAt: { $gt: clearedAt },
                status: "active",
                deletedBy: { $ne: userId }
            }
        },
        { $count: "count" }
    ]);

    const totalMessages = totalMessagesAggregation[0]?.count || 0;
    const totalPages = Math.ceil(totalMessages / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    const messages = await Message.aggregate([
        {
            $match: {
                chatRoomId: new mongoose.Types.ObjectId(chatRoomId),
                createdAt: { $gt: clearedAt },
                status: "active",
                deletedBy: { $ne: userId }
            }
        },
        { $sort: { createdAt: sortOrder } },
        { $skip: skip },
        { $limit: pageLimit },
        {
            $lookup: {
                from: "users",
                localField: "senderId",
                foreignField: "_id",
                as: "userSenderDetails",
                pipeline: [
                    { $project: { _id: 1, name: 1, profileImage: 1, username: 1, accountType: 1, businessName: 1 } }
                ]
            }
        },
        {
            $lookup: {
                from: "admins",
                localField: "senderId",
                foreignField: "_id",
                as: "adminSenderDetails",
                pipeline: [
                    { $project: { _id: 1, name: 1, profileImage: 1, email: 1 } }
                ]
            }
        },
        {
            $addFields: {
                senderDetails: {
                    $arrayElemAt: [
                        { $concatArrays: ["$userSenderDetails", "$adminSenderDetails"] },
                        0
                    ]
                }
            }
        },
        {
            $lookup: {
                from: "posts",
                localField: "postId",
                foreignField: "_id",
                as: "postDetails",
                pipeline : [
                    {
                        $project: {
                            _id : 1,
                            title: 1,
                            userId : 1,
                            description : 1,
                            postType : 1,
                            imagesOrVideos : { $arrayElemAt: ["$imagesOrVideos", 0] },
                            audienceSelection : 1,
                            communityId : 1,
                            createdAt : 1
                        }
                    }
                ]
            }
        },
        { $unwind: { path: "$postDetails", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                localField: "postDetails.userId",
                foreignField: "_id",
                as: "postCreator",
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
        { $unwind: { path: "$postCreator", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
              from: 'communities',
              localField: 'postDetails.communityId',
              foreignField: '_id',
              as: 'postCommunityDetail',
              pipeline: [
                {
                    $project: {
                        _id: 1,
                        userId : 1,
                        communityName: 1,
                        communityUsername: 1,
                        communityType: 1,
                        logo: 1,
                        coverImage: 1,
                        description: 1
                    }
                }
              ]
            }
          },
        { $unwind: { path: '$postCommunityDetail', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'communities',
                localField: 'communityId',
                foreignField: '_id',
                as: 'communityDetail',
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            userId: 1,
                            communityName: 1,
                            communityUsername: 1,
                            communityType: 1,
                            logo: 1,
                            coverImage: 1,
                            description: 1
                        }
                    }
                ]
            }
        },
        { $unwind: { path: '$communityDetail', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                userSenderDetails: 0,
                adminSenderDetails: 0
            }
        },
        {
            $addFields: {
                isSelf: { $eq: ["$senderId", userId] },
                byBlockedParticipent: {
                    $cond: {
                        if: { $in: ["$senderId", blockedUsers] },
                        then: true,
                        else: false
                    }
                }
            }
        }
    ]);

    const messageIdsToUpdate = messages
        .filter(msg => !msg.seenBy.includes(userId))
        .map(msg => msg._id);

    if (messageIdsToUpdate.length > 0) {
        await Message.updateMany(
            { _id: { $in: messageIdsToUpdate } },
            { $addToSet: { seenBy: userId } }
        );
    }
    
    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Messages fetched", {
        totalMessages,
        totalPages,
        currentPage: page,
        nextPage,
        prevPage,
        messagesInCurrentPage: messages.length,
        messages,
        isBlockedOneToOneChat,
        isBlockedByLoggedIn,
        isRemovedFromGroup
    });
});


// exports.getChatRoomDetails = catchAsyncError(async (req, res) => {
//     const { chatRoomId } = req.query;

//     if (!chatRoomId) {
//         return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "chatRoomId is required.");
//     }

//     const loggedInUser = req.user.id || req.user.data.id;

//     // I have to find isLoggedInUserAdmin key

//     const chatRoomAggregation = await ChatRoom.aggregate([
//         {
//             $match: { _id: new mongoose.Types.ObjectId(chatRoomId) }
//         },
//         {
//             $unwind: "$participants"
//         },
//         {
//             $lookup: {
//                 from: "users",
//                 localField: "participants.person",
//                 foreignField: "_id",
//                 as: "userDetails",
//                 pipeline: [
//                     {
//                         $project: {
//                             _id: 1,
//                             name: 1,
//                             businessName: 1,
//                             username: 1,
//                             profileImage: 1,
//                             accountType: 1,
//                             description: 1,
//                             shortBio: 1,
//                             blueTick: 1
//                         }
//                     }
//                 ]
//             }
//         },
//         {
//             $lookup: {
//                 from: "admins",
//                 localField: "participants.person",
//                 foreignField: "_id",
//                 as: "adminDetails",
//                 pipeline: [
//                     {
//                         $project: {
//                             _id: 1,
//                             name: 1,
//                             username: 1,
//                             email: 1,
//                             role: 1
//                         }
//                     }
//                 ]
//             }
//         },
//         {
//             $addFields: {
//                 participantDetails: {
//                     $cond: {
//                         if: { $gt: [{ $size: "$userDetails" }, 0] },
//                         then: { $arrayElemAt: ["$userDetails", 0] },
//                         else: { $arrayElemAt: ["$adminDetails", 0] }
//                     }
//                 }
//             }
//         },
//         {

//         },
//         {
//             $project: {
//                 userDetails: 0,
//                 adminDetails: 0
//             }
//         },
//         {
//             $group: {
//                 _id: "$_id",
//                 type: { $first: "$type" },
//                 groupImage: { $first: "$groupImage" },
//                 groupName: { $first: "$groupName" },
//                 groupDescription: { $first: "$groupDescription" },
//                 creator: { $first: "$creator" },
//                 isAdminChat: { $first: "$isAdminChat" },
//                 participants: { $push: { person: "$participants.person", personDetail: "$participantDetails", isAdmin: "$participants.isAdmin", status: "$participants.status", muteNotifications: "$participants.muteNotifications", joinedAt: "$participants.joinedAt" } },
//                 createdAt: { $first: "$createdAt" },
//                 groupAdminCount : { $sum: { $cond: { if: "$participants.isAdmin", then: 1 , else: 0 } } }
//             }
//         }
//     ]);

//     if (!chatRoomAggregation.length) {
//         return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "Chat room not found.");
//     }

//     return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Chat room details fetched successfully", chatRoomAggregation[0]);
// });

exports.getChatRoomDetails = catchAsyncError(async (req, res) => {
    const { chatRoomId } = req.query;

    if (!chatRoomId) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "chatRoomId is required.");
    }

    const loggedInUser = new mongoose.Types.ObjectId(req.user.id || req.user.data.id);

    const chatRoomAggregation = await ChatRoom.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(chatRoomId) }
        },
        {
            $unwind: "$participants"
        },
        {
            $lookup: {
                from: "users",
                localField: "participants.person",
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
        {
            $lookup: {
                from: "admins",
                localField: "participants.person",
                foreignField: "_id",
                as: "adminDetails",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            username: 1,
                            email: 1,
                            role: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                participantDetails: {
                    $cond: {
                        if: { $gt: [{ $size: "$userDetails" }, 0] },
                        then: { $arrayElemAt: ["$userDetails", 0] },
                        else: { $arrayElemAt: ["$adminDetails", 0] }
                    }
                }
            }
        },
        {
            $project: {
                userDetails: 0,
                adminDetails: 0
            }
        },
        {
            $group: {
                _id: "$_id",
                type: { $first: "$type" },
                groupImage: { $first: "$groupImage" },
                groupName: { $first: "$groupName" },
                groupDescription: { $first: "$groupDescription" },
                creator: { $first: "$creator" },
                isAdminChat: { $first: "$isAdminChat" },
                participants: {
                    $push: {
                        person: "$participants.person",
                        personDetail: "$participantDetails",
                        isAdmin: "$participants.isAdmin",
                        status: "$participants.status",
                        muteNotifications: "$participants.muteNotifications",
                        joinedAt: "$participants.joinedAt"
                    }
                },
                createdAt: { $first: "$createdAt" },
                groupAdminCount: {
                    $sum: { $cond: { if: "$participants.isAdmin", then: 1, else: 0 } }
                },
                isLoggedInUserAdmin: {
                    $max: { $cond: { if: { $eq: ["$participants.person", loggedInUser] }, then: "$participants.isAdmin", else: false } }
                }
            }
        }
    ]);

    if (!chatRoomAggregation.length) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "Chat room not found.");
    }

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Chat room details fetched successfully", chatRoomAggregation[0]);
});

exports.getChatRoomDetailsForUser = catchAsyncError(async (req, res) => {
    const { chatRoomId } = req.query;

    if (!chatRoomId) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "chatRoomId is required.");
    }

    const loggedInUser = new mongoose.Types.ObjectId(req.user.id);

    const chatRoomAggregation = await ChatRoom.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(chatRoomId) }
        },
        {
            $addFields: {
                activeParticipantsCount: {
                    $size: {
                        $filter: {
                            input: "$participants",
                            as: "participant",
                            cond: { $ne: ["$$participant.status", "inactive"] }
                        }
                    }
                },
                groupAdminCount: {
                    $size: {
                        $filter: {
                            input: "$participants",
                            as: "participant",
                            cond: {
                                $eq: ["$$participant.isAdmin", true],
                            }
                        }
                    }
                },
                isLoggedInUserAdmin: {
                    $gt: [
                        {
                            $size: {
                                $filter: {
                                    input: "$participants",
                                    as: "participant",
                                    cond: {
                                        $and: [
                                            { $eq: ["$$participant.person", loggedInUser] },
                                            { $eq: ["$$participant.isAdmin", true] }
                                        ]
                                    }
                                }
                            }
                        },
                        0
                    ]
                }
            }
        },
        {
            $project: {
                participants: 0
            }
        }
    ]);

    if (!chatRoomAggregation.length) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "Chat room not found.");
    }

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Chat room details fetched successfully", chatRoomAggregation[0]);
});



exports.sendMessage = catchAsyncError(async (req, res) => {
    const { roomId, message } = req.body;

    const sender = req.user.id;

    if (!message || !roomId) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'roomId and message are required');
    }

    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Chat room not found');
    }
    chatRoom.messages.push({ sender, message });
    await chatRoom.save();
    return response.responseHandlerWithMessage(res, true, statusCode.UPDATED, 'Message sent');
})

exports.addPersonToGroup = catchAsyncError(async (req, res) => {
    const { roomId, person } = req.body;

    if (!person || !roomId) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Person ID and room ID is required');
    }

    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Chat room not found');
    }

    const isAlreadyParticipant = chatRoom.participants.some(p => p.person.toString() === person);
    if (isAlreadyParticipant) {
        return response.responseHandlerWithMessage(res, false, statusCode.CONFLICT, 'Person is already a participant');
    }

    const creator = chatRoom.creator;
    const loggedInUser = req.user.id

    const isFollowing = await Friend.findOne({
        $or: [
            { userId: creator, friendId: person },
            { userId: person, friendId: creator },
            { userId: loggedInUser, friendId: person },
            { userId: person, friendId: loggedInUser }
        ]
    });

    let participantStatus = isFollowing ? "active" : "inactive";

    chatRoom.participants.push({ person, status: participantStatus });
    await chatRoom.save();

    if (!isFollowing) {
        await ChatRequest.create({
            senderId: creator,
            receiverId: person,
            chatRoomId: roomId,
            requestType: "group",
            status: "pending"
        });
    }

    return response.responseHandlerWithMessage(res, true, statusCode.UPDATED, 'Participant added successfully');
});


// exports.deleteSingleMessage = catchAsyncError(async (req, res) => {
//     const { messageId, deleteType } = req.query; 
//     // deleteType = "forMe" | "forEveryone"

//     if (!messageId || !deleteType) {
//         return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Invalid request');
//     }

//     const loggedInUser = new mongoose.Types.ObjectId(req.user.id || req.user.data.id);

//     const message = await Message.findById(messageId);

//     if (!message) {
//         return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Message not found');
//     }

//     if (deleteType === "forEveryone") {
//         if (!message.senderId.equals(loggedInUser)) {
//             return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, 'You are not allowed to delete this message for everyone.');
//         }

//         await Message.updateOne({ _id: messageId }, { $set: { status: "deleted" } });
//         return response.responseHandlerWithMessage(res, true, statusCode.UPDATED, 'Message deleted for everyone.');

//     } else if (deleteType === "forMe") {
//         if (!message.deletedBy.includes(loggedInUser)) {
//             await Message.updateOne(
//                 { _id: messageId },
//                 { $addToSet: { deletedBy: loggedInUser } }
//             );
//         }

//         return response.responseHandlerWithMessage(res, true, statusCode.UPDATED, 'Message deleted for you only.');
//     }

//     return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Invalid delete type.');
// });


exports.deleteSingleMessage = catchAsyncError(async (req, res) => {
    const { messageId } = req.query;

    if (!messageId) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Invalid request');
    }

    const loggedInUser = new mongoose.Types.ObjectId(req.user.id || req.user.data.id);

    const message = await Message.findById(messageId);

    if (!message) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Message not found');
    }

    // if (!message.senderId.equals(loggedInUser)) {

    //     if (!message.deletedBy.includes(loggedInUser)) {
    //         await Message.updateOne(
    //             { _id: messageId },
    //             { $addToSet: { deletedBy: loggedInUser } }
    //         );
    //     }

    // }else{
    //     await Message.updateOne({ _id: messageId }, { $set: { status: "deleted" } });
    // }

    if (message.senderId.equals(loggedInUser)) {
        await Message.updateOne({ _id: messageId }, { $set: { status: "deleted" } });
    } else {
        await Message.updateOne(
            { _id: messageId, deletedBy: { $ne: loggedInUser } },
            { $addToSet: { deletedBy: loggedInUser } }
        );
    }

    return response.responseHandlerWithMessage(res, true, statusCode.UPDATED, 'Message deleted successfully.');
});


exports.clearChat = catchAsyncError(async (req, res) => {
    const { chatRoomId } = req.query;
    const loggedInUser = new mongoose.Types.ObjectId(req.user.id || req.user.data.id);

    if (!chatRoomId) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Chat room ID is required');
    }

    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Chat room not found');
    }

    await ChatRoom.updateOne(
        { _id: chatRoomId, "participants.person": loggedInUser },
        {
            $set: {
                "participants.$.clearedAt": new Date(),
                "participants.$.status": "cleared"
            }
        }
    );

    return response.responseHandlerWithMessage(res, true, statusCode.UPDATED, "Chat cleared for you only.");
});

exports.deleteChatRoomByParticipent = catchAsyncError(async (req, res) => {
    const { chatRoomId } = req.query;
    const loggedInUser = new mongoose.Types.ObjectId(req.user.id || req.user.data.id);

    if (!chatRoomId) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Chat room ID is required');
    }

    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Chat room not found');
    }

    await ChatRoom.updateOne(
        { _id: chatRoomId, "participants.person": loggedInUser },
        {
            $set: {
                "participants.$.clearedAt": new Date(),
                "participants.$.status": "deleted"
            }
        }
    );

    return response.responseHandlerWithMessage(res, true, statusCode.UPDATED, 'Chat room deleted successfully');
});


exports.getUsersForChat = catchAsyncError(async (req, res) => {
    const {
        limit = 10,
        pageNo = 1,
        search = "",
        sortBy = "createdAt",
        order = "desc",
        chatRoomId,
    } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);
    const sortOrder = order === "asc" ? 1 : -1;

    const userId = req.user.id;

    const loggedInUser = await User.findById(userId).select(["hiddenPosts", "blockedUsers"]);
    const blockedUsersByAdmin = await User.find({ status: "blocked" }).lean().select(["_id"]);
    const blockedUsersByAdminIds = blockedUsersByAdmin.map(b => b._id);

    let matchStage = {
        status: "active"
    };

    if (loggedInUser) {
        const toHideUsers = [...loggedInUser.blockedUsers, new mongoose.Types.ObjectId(userId), ...blockedUsersByAdminIds];
        matchStage._id = { $nin: toHideUsers };
    }

    if (search) {
        const searchTerms = search.trim().split(/\s+/);
        matchStage.$or = searchTerms.map(term => ({
            $or: [
                { name: { $regex: term, $options: "i" } },
                { businessName: { $regex: term, $options: "i" } },
                { username: { $regex: term, $options: "i" } },
                { email: { $regex: term, $options: "i" } }
            ]
        })).flat();
    }

    let alreadyParticipantIds = [];
    if (chatRoomId) {
        const chatRoom = await ChatRoom.findById(chatRoomId).select("participants").lean();
        if (chatRoom) {
            alreadyParticipantIds = chatRoom.participants
                .filter(p => p.status === "active")
                .map(p => p.person.toString());
        }
    }

    const usersAggregation = await User.aggregate([
        { $match: matchStage },
        {
            $lookup: {
                from: "chatrequests",
                let: { userId: "$_id", chatRoomId: new mongoose.Types.ObjectId(chatRoomId) },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$receiverId", "$$userId"] },
                                    { $eq: ["$status", "pending"] },
                                    {
                                        $or: [
                                            {
                                                $and: [
                                                    { $eq: ["$requestType", "oneToOne"] },
                                                    { $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] }
                                                ]
                                            },
                                            {
                                                $and: [
                                                    { $eq: ["$requestType", "group"] },
                                                    { $eq: ["$chatRoomId", "$$chatRoomId"] }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    { $limit: 1 }
                ],
                as: "chatRequest"
            }
        },
        {
            $lookup: {
                from: "friends",
                let: { userId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$userId", "$$userId"] },
                                    { $eq: ["$status", "active"] }
                                ]
                            }
                        }
                    }
                ],
                as: "followers"
            }
        },
        {
            $lookup: {
                from: "users",
                let: { userId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$_id", "$$userId"] }
                        }
                    },
                    {
                        $project: {
                            isLoggedUserBlocked: {
                                $in: [new mongoose.Types.ObjectId(userId), "$blockedUsers"]
                            }
                        }
                    }
                ],
                as: "blockCheck"
            }
        },
        { $sort: { [sortBy]: sortOrder } },
        { $skip: offset },
        { $limit: pageLimit },
        {
            $project: {
                _id: 1,
                name: 1,
                businessName: 1,
                username: 1,
                profileImage: 1,
                accountType: 1,
                email: 1,
                phoneNumber: 1,
                status: 1,
                createdAt: 1,
                description: 1,
                shortBio: 1,
                blueTick: 1,
                isParticipant: {
                    $in: [{ $toString: "$_id" }, alreadyParticipantIds] // Check if user is already in chat room
                },
                isRequestSent: { $gt: [{ $size: "$chatRequest" }, 0] },
                followers: 1,
                isLoggedUserBlocked: {
                    $arrayElemAt: ["$blockCheck.isLoggedUserBlocked", 0]
                }
            }
        }
    ]);

    const totalCountAggregation = await User.aggregate([
        { $match: matchStage },
        { $count: "totalCount" }
    ]);
    const totalCount = totalCountAggregation.length > 0 ? totalCountAggregation[0].totalCount : 0;
    const totalPages = Math.ceil(totalCount / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Users fetched successfully.", {
        totalUsers: totalCount,
        totalUserInAPage: usersAggregation.length,
        currentPage: page,
        totalPages: totalPages,
        nextPage: nextPage,
        prevPage: prevPage,
        users: await Promise.all(usersAggregation.map(async (user) => {

            const isConnected = await Friend.exists({
                $or: [
                    { userId: loggedInUser, friendId: user._id },
                    { userId: user._id, friendId: loggedInUser }
                ]
            });

            return {
                _id: user._id,
                name: user.name,
                businessName: user.businessName,
                username: user.username,
                profileImage: user.profileImage,
                accountType: user.accountType,
                email: user.email,
                phoneNumber: user.phoneNumber,
                status: user.status,
                shortBio: user.shortBio,
                description: user.description,
                createdAt: user.createdAt,
                blueTick: user.blueTick,
                commonDescription: user.description ? user.description : user.shortBio,
                isParticipant: user.isParticipant,
                isRequestSent: user.isRequestSent,
                followers: user.followers.length,
                isConnected: !!isConnected,
                isLoggedUserBlocked: user.isLoggedUserBlocked
            };
        }))
    });
});


exports.getMessageRequests = catchAsyncError(async (req, res) => {
    const loggedInUser = req.user.id;

    const { limit = 10, pageNo = 1 } = req.query;
    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);

    const chatRequests = await ChatRequest.aggregate([
        {
            $match: {
                receiverId: new mongoose.Types.ObjectId(loggedInUser),
                status: "pending"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "senderId",
                foreignField: "_id",
                as: "sender",
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
        {
            $lookup: {
                from: "chatrooms",
                localField: "chatRoomId",
                foreignField: "_id",
                as: "chatRoomDetails",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            groupImage: 1,
                            groupName: 1,
                            groupDescription: 1,
                        }
                    }
                ]
            }
        },
        {
            $project: {
                _id: 1,
                sender: 1,
                chatRoomId: 1,
                chatRoomDetails: 1,
                requestType: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1
            }
        },
        { $sort: { updatedAt: -1 } },
        { $skip: offset },
        { $limit: pageLimit }
    ]);

    const totalCountAggregation = await ChatRequest.aggregate([
        {
            $match: {
                receiverId: new mongoose.Types.ObjectId(loggedInUser),
                status: "pending"
            }
        },
        { $count: "totalCount" }
    ]);

    const totalCount = totalCountAggregation.length > 0 ? totalCountAggregation[0].totalCount : 0;
    const totalPages = Math.ceil(totalCount / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Message requests fetched successfully.", {
        totalRequests: totalCount,
        totalRequestsInPage: chatRequests.length,
        currentPage: page,
        totalPages: totalPages,
        nextPage: nextPage,
        prevPage: prevPage,
        requests: chatRequests
    });
});

exports.actionOnMessageRequest = catchAsyncError(async (req, res) => {

    const { messageRequestId, actionType } = req.body;

    if (!messageRequestId || !actionType) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Message request ID and action type are required');
    }

    if (!["accept", "reject"].includes(actionType)) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Invalid action type');
    }

    const messageRequest = await ChatRequest.findById(messageRequestId);

    if (!messageRequest) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Message request not found');
    }

    if (messageRequest.status !== "pending") {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Request is already processed');
    }

    messageRequest.status = actionType === "accept" ? "accepted" : "rejected";
    await messageRequest.save();

    if (actionType === "accept") {
        const chatRoom = await ChatRoom.findById(messageRequest.chatRoomId);
        if (!chatRoom) {
            return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Chat room not found');
        }

        const participant = chatRoom.participants.find(p => p.person.toString() === messageRequest.receiverId.toString());

        if (participant) {
            participant.status = "active";
        } else {
            chatRoom.participants.push({ person: messageRequest.receiverId, status: "active" });
        }

        await chatRoom.save();
    }

    return response.responseHandlerWithMessage(res, true, statusCode.UPDATED, `Message request ${actionType}ed successfully`, messageRequest);
});


// exports.leaveChatGroup = catchAsyncError(async (req, res) => {
//     const { chatRoomId, leaveTo, userId } = req.body;
//     const loggedInUserId = new mongoose.Types.ObjectId(req.user.id || req.user.data.id);
//     const io = req.app.get('socket');

//     if (!["self", "other"].includes(leaveTo)) {
//         return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Invalid leaveTo value. It must be "self" or "other".');
//     }

//     const chatGroup = await ChatRoom.findOne({ _id: chatRoomId, type: "group" });

//     if (!chatGroup) {
//         return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Chat group not found.');
//     }

//     const targetUserId = leaveTo === "self" ? loggedInUserId : new mongoose.Types.ObjectId(userId);

//     if (leaveTo === "other") {
//         const isAdmin = chatGroup.participants.some(participant =>
//             participant.person.equals(loggedInUserId) && participant.isAdmin
//         );

//         if (!isAdmin) {
//             return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, 'Only an admin can remove other users.');
//         }
//     }

//     const participant = chatGroup.participants.find(p => p.person.equals(targetUserId));

//     if (!participant) {
//         return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'User is not a participant in this group.');
//     }

//     const totalAdmins = chatGroup.participants.filter(p => p.isAdmin).length;
//     if (participant.isAdmin && totalAdmins === 1) {
//         return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, 'Cannot leave or remove the only admin. Assign another admin first.');
//     }

//     await ChatRoom.updateOne(
//         { _id: chatRoomId },
//         { $pull: { participants: { person: targetUserId } } }
//     );

//     const userDetail = await User.findById(targetUserId).select(["name", "businessName"]).lean();
//     const loggedInUserDetail = await User.findById(loggedInUserId).select(["name", "businessName"]).lean();

//     const messageContent = leaveTo === "self"
//         ? `${userDetail?.name ?? userDetail?.businessName ?? "Unknown User"} left the group.`
//         : `${userDetail?.name ?? userDetail?.businessName ?? "Unknown User"} was removed from the group by ${loggedInUserDetail?.name ?? loggedInUserDetail?.businessName ?? "Unknown User"}.`;


//     const systemMessage = new Message({
//         chatRoomId,
//         senderId: loggedInUserId,
//         messageType: "groupInfo",
//         message: messageContent,
//         status: "active"
//     });

//     await systemMessage.save();

//     io.to(chatRoomId.toString()).emit("rev-msg", {
//         chatRoomId: chatRoomId.toString(),
//         message: systemMessage
//     });

//     return response.responseHandlerWithMessage(res, true, statusCode.UPDATED, 'User removed from chat group successfully.');
// });


exports.leaveChatGroup = catchAsyncError(async (req, res) => {
    const { chatRoomId, leaveTo, userId } = req.body;
    const loggedInUserId = new mongoose.Types.ObjectId(req.user.id || req.user.data.id);
    const io = req.app.get('socket');

    if (!["self", "other"].includes(leaveTo)) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Invalid leaveTo value. It must be "self" or "other".');
    }

    const chatGroup = await ChatRoom.findOne({ _id: chatRoomId, type: "group" });

    if (!chatGroup) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Chat group not found.');
    }

    const targetUserId = leaveTo === "self" ? loggedInUserId : new mongoose.Types.ObjectId(userId);

    if (leaveTo === "other") {
        const isAdmin = chatGroup.participants.some(participant =>
            participant.person.equals(loggedInUserId) && participant.isAdmin
        );

        if (!isAdmin) {
            return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, 'Only an admin can remove other users.');
        }
    }

    const participantIndex = chatGroup.participants.findIndex(p => p.person.equals(targetUserId));
    if (participantIndex === -1) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'User is not a participant in this group.');
    }

    const participant = chatGroup.participants[participantIndex];

    const totalAdmins = chatGroup.participants.filter(p => p.isAdmin && p.status !== 'removed').length;
    if (participant.isAdmin && totalAdmins === 1) {
        return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, 'Cannot leave or remove the only admin. Assign another admin first.');
    }

    chatGroup.participants[participantIndex].status = 'removed';
    chatGroup.participants[participantIndex].removedAt = new Date();

    await chatGroup.save();

    const userDetail = await User.findById(targetUserId).select(["name", "businessName"]).lean();
    const loggedInUserDetail = await User.findById(loggedInUserId).select(["name", "businessName"]).lean();

    const messageContent = leaveTo === "self"
        ? `${userDetail?.name ?? userDetail?.businessName ?? "Unknown User"} left the group.`
        : `${userDetail?.name ?? userDetail?.businessName ?? "Unknown User"} was removed from the group by ${loggedInUserDetail?.name ?? loggedInUserDetail?.businessName ?? "Unknown User"}.`;

    const systemMessage = new Message({
        chatRoomId,
        senderId: loggedInUserId,
        messageType: "groupInfo",
        textMessage: messageContent,
        status: "active"
    });

    await systemMessage.save();

    io.to(chatRoomId.toString()).emit("rev-msg", {
        chatRoomId: chatRoomId.toString(),
        message: systemMessage
    });

    return response.responseHandlerWithMessage(res, true, statusCode.UPDATED, 'User removed from chat group successfully.');
});



exports.getPaticipentList = catchAsyncError(async (req, res) => {
    const { chatRoomId, pageNo = 1, limit = 10, search = "" } = req.query;

    if (!chatRoomId) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Chat RoomId is required');
    }

    const chatGroup = await ChatRoom.findOne({ _id: chatRoomId, type: "group" }).lean();

    if (!chatGroup) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Chat group not found');
    }

    const startIndex = (pageNo - 1) * limit;

    // const participantData = await ChatRoom.aggregate([
    //     { 
    //         $match: { 
    //             _id: new mongoose.Types.ObjectId(chatRoomId), 
    //             type: "group"
    //         }
    //     },
    //     { $unwind: "$participants" },
    //     {
    //         $lookup: {
    //             from: "users",
    //             localField: "participants.person",
    //             foreignField: "_id",
    //             as: "participantDetails",
    //             pipeline: [
    //                 {
    //                     $match: {
    //                         $or: [
    //                             { name: { $regex: search, $options: "i" } },
    //                             { businessName: { $regex: search, $options: "i" } },
    //                             { username: { $regex: search, $options: "i" } }
    //                         ]
    //                     }
    //                 },
    //                 {
    //                     $project: {
    //                         _id: 1,
    //                         name: 1,
    //                         businessName: 1,
    //                         profileImage: 1,
    //                         shortBio: 1,
    //                         description: 1,
    //                         username: 1,
    //                         blueTick: 1,
    //                         accountType: 1,
    //                         occupationTitle: 1,
    //                         occupationSector: 1,
    //                         workExperience: 1,
    //                         companyName: 1,
    //                         expertise: 1
    //                     }
    //                 }
    //             ]
    //         }
    //     },
    //     {
    //         $match: {
    //             "participantDetails": { $ne: [] },
    //             "participantDetails.status": { $nin: ["inactive", "removed"] }
    //         }
    //     },
    //     { $sort: { "participants.joinedAt": -1 } },
    //     { $skip: startIndex },
    //     { $limit: parseInt(limit) },
    //     {
    //         $project: {
    //             _id: 0,
    //             participant: "$participants",
    //             participantDetails: { $arrayElemAt: ["$participantDetails", 0] }
    //         }
    //     }
    // ]);


    const participantData = await ChatRoom.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(chatRoomId),
            type: "group"
          }
        },
        { $unwind: "$participants" },
      
        {
          $match: {
            "participants.status": { $nin: ["inactive", "removed"] }
          }
        },
      
        {
          $lookup: {
            from: "users",
            localField: "participants.person",
            foreignField: "_id",
            as: "participantDetails",
            pipeline: [
              {
                $match: {
                  $or: [
                    { name: { $regex: search, $options: "i" } },
                    { businessName: { $regex: search, $options: "i" } },
                    { username: { $regex: search, $options: "i" } }
                  ]
                }
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  businessName: 1,
                  profileImage: 1,
                  shortBio: 1,
                  description: 1,
                  username: 1,
                  blueTick: 1,
                  accountType: 1,
                  occupationTitle: 1,
                  occupationSector: 1,
                  workExperience: 1,
                  companyName: 1,
                  expertise: 1
                }
              }
            ]
          }
        },
      
        // ✅ This now just checks if there's a matching user
        {
          $match: {
            participantDetails: { $ne: [] }
          }
        },
      
        { $sort: { "participants.joinedAt": -1 } },
        { $skip: startIndex },
        { $limit: parseInt(limit) },
      
        {
          $project: {
            _id: 0,
            participant: "$participants",
            participantDetails: { $arrayElemAt: ["$participantDetails", 0] }
          }
        }
      ]);      

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'Participant list fetched successfully', participantData);
});

exports.sendGroupInvite = catchAsyncError(async (req, res) => {
    const { chatRoomId, inviteUsers } = req.body;
    const loggedInUser = req.user.id;

    if (!chatRoomId || !Array.isArray(inviteUsers) || inviteUsers.length === 0) {
        return response.responseHandlerWithError(res, false, statusCode.DATAMISSING, 'chatRoomId and inviteUsers are required');
    }

    const chatRoom = await ChatRoom.findOne({ _id: chatRoomId, type: "group" });

    if (!chatRoom) {
        return response.responseHandlerWithError(res, false, statusCode.RESULTNOTFOUND, 'Chat room not found');
    }

    const requestingUser = chatRoom.participants.find(p => p.person.toString() === loggedInUser);
    if (!requestingUser || !requestingUser.isAdmin) {
        return response.responseHandlerWithError(res, false, statusCode.FORBIDDEN, 'Only admins can send group invites.');
    }

    const newParticipants = [];
    const newRequests = [];
    let participantsModified = false;

    for (const userId of inviteUsers) {
        const existingParticipant = chatRoom.participants.find(p => p.person.toString() === userId);
        const existingRequest = await ChatRequest.findOne({ chatRoomId, receiverId: userId, requestType: "group" }).sort({ createdAt: -1 });

        if (existingParticipant) {
            if (["active", "inactive", "cleared"].includes(existingParticipant.status)) {
                if (!existingRequest || existingRequest.status !== "rejected") {
                    // Already participant & no rejected request => skip
                    continue;
                }
            }

            if (existingParticipant.status === "removed") {
                // Re-invite removed user
                existingParticipant.status = "inactive";
                existingParticipant.joinedAt = new Date();
                participantsModified = true;

                newRequests.push({
                    senderId: loggedInUser,
                    receiverId: userId,
                    chatRoomId: chatRoomId,
                    status: "pending",
                    requestType: "group"
                });

            }

        } else {
            // Not a participant at all
            newParticipants.push({
                person: userId,
                status: "inactive",
                joinedAt: new Date()
            });
            participantsModified = true;

        }

        // Handle ChatRequest creation or update
        if (existingRequest) {
            if (existingRequest.status === "rejected") {

                console.log("Rejectedddddddd");

                existingRequest.status = "pending";
                await existingRequest.save();
            }
        } else {
            newRequests.push({
                senderId: loggedInUser,
                receiverId: userId,
                chatRoomId: chatRoomId,
                status: "pending",
                requestType: "group"
            });
        }
    }

    if (newParticipants.length > 0) {
        chatRoom.participants.push(...newParticipants);
    }

    if (participantsModified || newParticipants.length > 0) {

        await chatRoom.save();
    }

    if (newRequests.length > 0) {
        await ChatRequest.insertMany(newRequests);
    }

    return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, 'Group invite sent successfully.');
});

exports.toggleMuteChatNotification = catchAsyncError(async (req, res) => {

    const { chatRoomId, muteType } = req.query;
    const userId = req.user.id;

    if (!chatRoomId) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "chatRoomId is required in query params");
    }
    if (muteType !== "true" && muteType !== "false") {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "muteType must be 'true' or 'false'");
    }

    const muteStatus = muteType === "true";

    const chatRoom = await ChatRoom.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(chatRoomId),
            "participants.person": new mongoose.Types.ObjectId(userId)
        },
        {
            $set: { "participants.$.muteNotifications": muteStatus }
        },
        { new: true }
    );

    if (!chatRoom) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "ChatRoom not found or user is not a participant");
    }

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Mute status updated successfully", { muteNotifications: muteStatus });
});

exports.getUnseenChatRoomsCount = catchAsyncError(async (req, res) => {

   const userId = req.user.id;

   const userChatRooms = await ChatRoom.find({
    "participants.person": userId,
    "participants.status": "active",
  }).select('_id').lean();

  if (!userChatRooms.length) return 0;

  const chatRoomIds = userChatRooms.map(room => room._id);

  const unseenMessages = await Message.aggregate([
    {
      $match: {
        chatRoomId: { $in: chatRoomIds },
        seenBy: { $ne: new mongoose.Types.ObjectId(userId) },
        deletedBy: { $ne: new mongoose.Types.ObjectId(userId) }
      }
    },
    {
      $group: { _id: "$chatRoomId" }
    }
  ]);

   return response.responseHandlerWithData(
    res,
    true,
    statusCode.SUCCESS,
    `Unseen Chat Rooms Count fetched successfully.`,
    unseenMessages.length
);
});