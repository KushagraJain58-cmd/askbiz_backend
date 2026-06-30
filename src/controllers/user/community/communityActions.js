let Community = require('../../../models/community');
let CommunityMember = require('../../../models/communityMembers');
let CommunityRequest = require('../../../models/communityRequests');
let User = require('../../../models/users')
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes');
const { catchAsyncError } = require('../../../../utils/constants/generateError');
const mongoose = require('mongoose');
let Report = require("../../../models/report")
let Post = require("../../../models/post");
let Interest = require("../../../models/interest");
const { sendOneToOneNotification, sendUserBulkNotifications } = require("../../../../utils/helpers/notificationUtils")


exports.createCommunity = catchAsyncError(async (req, res) => {

    const { communityName, communityUsername, communityType, location, interest, logo, coverImage, description, communityLink } = req.body;

    const userId = req.user.id;

    if (!communityName || !communityUsername || !communityType) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, 'Please provide all neccessary informations.');
    }

    if (interest && interest.length > 0) {

        const allInterestValues = interest.flatMap((interest) => interest.value);

        allInterestValues.map(async (interest) => {

            const interestExist = await Interest.findOne({ interestName: interest });
            if (!interestExist) {
                const newInterest = new Interest({ interestName: interest, interestUsedCount: 1 });
                await newInterest.save();
            } else {
                interestExist.interestUsedCount += 1;
                await interestExist.save();
            }
        })
    }

    const community = new Community({
        userId: req.user.id,
        communityName,
        communityUsername,
        communityType,
        location: {
            type: "Point",
            coordinates: location?.longitude != "" && location?.latitude != "" ? [location?.longitude, location?.latitude] : [0, 0],
            cityName: location.cityName
        },
        interest,
        logo,
        coverImage,
        description,
        communityLink
    });

    await community.save();

    const communityMember = new CommunityMember({
        memberId: userId,
        communityId: community._id,
        communityRole: "admin",
        status: "active"
    });

    if (!communityMember) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, 'Failed to add member to a community as admin.');
    }

    await communityMember.save();

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'Community created successfully.', community);

});

exports.editCommunityDetails = catchAsyncError(async (req, res) => {
    const { communityId, ...updateFields } = req.body;

    if (!communityId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.BAD_REQUEST,
            'Community ID is required.'
        );
    }

    const community = await Community.findById(communityId);

    if (!community) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.NOT_FOUND,
            'Community not found.'
        );
    }

    if (String(community.userId) !== req.user.id) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.UNAUTHORIZED,
            'You are not authorized to edit this community.'
        );
    }

    Object.keys(updateFields).forEach((key) => {
        if (key === 'location') {
            community.location = {
                type: 'Point',
                coordinates:
                    updateFields.location?.longitude != "" &&
                        updateFields.location?.latitude != ""
                        ? [updateFields.location.longitude, updateFields.location.latitude]
                        : [0, 0]
            };
        } else {
            community[key] = updateFields[key];
        }
    });

    await community.save();

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        'Community details updated successfully.',
        community
    );
});

exports.sendInvites = catchAsyncError(async (req, res) => {

    const { communityId, invitingUserIds } = req.body;

    const userId = req.user.id;

    if (!invitingUserIds || invitingUserIds.length == 0) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, 'Please provide inviting users informations.');
    }

    const community = await Community.findOne({ _id: communityId }).lean();

    if (!community) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, 'Community not found or not authenticated');
    }

    for (let invitedId of invitingUserIds) {

        isAlreadyinvited = await CommunityRequest.findOne({
            sendBy: {
                id: new mongoose.Types.ObjectId(communityId),
                type: "community"
            },
            sendTo: {
                id: new mongoose.Types.ObjectId(invitedId),
                type: "user"
            },
            status: "pending"
        })

        if (isAlreadyinvited) {
            continue;
        }

        const communityRequest = new CommunityRequest({
            sendBy: {
                id: communityId,
                type: "community"
            },
            sendTo: {
                id: invitedId,
                type: "user"
            },
            communityRequesterId: new mongoose.Types.ObjectId(userId)
        });

        await communityRequest.save();

        const notificationMessage = `${req.user.data.name || req.user.data.businesssName} invites you to join ${community.communityName} community.`;
        const payload = { community: community._id.toString(), type: "community" };

        await sendUserBulkNotifications(userId, invitingUserIds, "Community Invite", notificationMessage, payload);
    }

    return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, 'Invitations sent successfully to all users.');

});

exports.getCommunityInvites = catchAsyncError(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const pageLimit = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);
    const skip = (currentPage - 1) * pageLimit;

    const invitesAggregation = await CommunityRequest.aggregate([
        {
            $match: {
                "sendTo.id": new mongoose.Types.ObjectId(userId),
                "sendTo.type": "user",
                status: 'pending',
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'sendTo.id',
                foreignField: '_id',
                as: 'userDetails',
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
                            blueTick: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'communityRequesterId',
                foreignField: '_id',
                as: 'communityRequester',
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
                            blueTick: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: '$userDetails'
        },
        {
            $lookup: {
                from: 'communities',
                localField: 'sendBy.id',
                foreignField: '_id',
                as: 'communityDetails'
            }
        },
        {
            $unwind: '$communityDetails'
        },
        {
            $project: {
                sendBy: 1,
                sendTo: 1,
                status: 1,
                communityDetails: 1,
                requestDate: 1,
                userDetails: 1,
                communityRequester: 1
            }
        },
        {
            $skip: skip
        },
        {
            $limit: pageLimit
        }
    ]);

    const totalInvites = await CommunityRequest.countDocuments({
        "sendTo.id": new mongoose.Types.ObjectId(userId),
        "sendTo.type": "user",
        status: 'pending'
    });

    const totalPages = Math.ceil(totalInvites / pageLimit);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    const baseUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
    const nextLink = hasNextPage
        ? `${baseUrl}?page=${currentPage + 1}&limit=${pageLimit}`
        : null;
    const prevLink = hasPrevPage
        ? `${baseUrl}?page=${currentPage - 1}&limit=${pageLimit}`
        : null;

    const responseData = {
        totalInvites,
        currentPage,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextLink,
        prevLink,
        invites: invitesAggregation
    };

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Community Invites fetched successfully",
        responseData
    );
});

exports.communityInviteAction = catchAsyncError(async (req, res) => {

    const { actionType, inviteId } = req.body;

    if (!['accept', 'decline'].includes(actionType)) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Invalid action type")
    }

    const communityRequest = await CommunityRequest.findOne({
        _id: inviteId,
        status: "pending"
    })

    if (!communityRequest) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Invite not found");
    }

    if (actionType === 'accept') {

        const addToCommuity = new CommunityMember({
            communityId: communityRequest.sendBy.id,
            memberId: communityRequest.sendTo.id,
            communityRole: "member",
            status: "active"
        })

        await addToCommuity.save();

        await CommunityRequest.findByIdAndUpdate({
            _id: inviteId,
            status: "pending",
        }
            , {
                status: "accepted"
            },
            { new: true }
        )

        const community = await Community.findById(communityRequest.sendBy.id);

        const adminUsers = await CommunityMember.find({
            communityId: communityRequest.sendBy.id,
            communityRole: "admin",
            status: "active"
        }).populate("memberId", "_id");

        const adminUserIds = adminUsers.map(admin => admin.memberId._id.toString());

        const notificationMessage = `${req.user.data.name || req.user.data.businessName || "A user"} joined your ${community.communityName} community via an invite.`;
        const payload = {
            communityId: community._id.toString(),
            type: "community"
        };

        await sendUserBulkNotifications(req.user.id, adminUserIds, "Community Join", notificationMessage, payload);

    }
    else if (actionType === 'decline') {

        await CommunityRequest.findByIdAndUpdate({
            _id: inviteId,
            status: "pending",
        },
            {
                status: "rejected"
            }, { new: true }
        )

    }

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Invite action performed successfully");

})

exports.getAllCommunityMembers = catchAsyncError(async (req, res) => {
    try {
        const {
            communityId,
            roleType,
            limit = 10,
            pageNo = 1,
            sortBy = "createdAt",
            order = "desc",
            search
        } = req.query;

        if (!communityId || !roleType) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Community ID and role type are required."
            );
        }

        const pageLimit = parseInt(limit, 10);
        const page = parseInt(pageNo, 10);
        const offset = pageLimit * (page - 1);
        const sortOrder = order === "asc" ? 1 : -1;

        const getCommunityRoles = await CommunityMember.aggregate([
            {
                $match: {
                    communityId: new mongoose.Types.ObjectId(communityId),
                    communityRole: roleType,
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "memberId",
                    foreignField: "_id",
                    as: "memberDetails",
                },
            },
            {
                $project: {
                    _id: 1,
                    memberId: 1,
                    communityId: 1,
                    communityRole: 1,
                    memberDetails: {
                        name: 1,
                        email: 1,
                        businessName: 1,
                        username: 1,
                        profileImage: 1,
                        accountType: 1,
                        shortBio: 1,
                        occupationTitle: 1,
                        occupationSector: 1,
                        workExperience: 1,
                        description: 1,
                        companyName: 1,
                        expertise: 1,
                        blueTick: 1,
                    },
                    status: 1,
                    updatedBy: 1,
                },
            },
            { $sort: { [sortBy]: sortOrder } },
            { $skip: offset },
            { $limit: pageLimit }
        ]);

        const totalCount = await CommunityMember.countDocuments({
            communityId: new mongoose.Types.ObjectId(communityId),
            communityRole: roleType,
        });

        const totalPages = Math.ceil(totalCount / pageLimit);
        const nextPage = page < totalPages ? page + 1 : null;
        const prevPage = page > 1 ? page - 1 : null;

        const baseUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;
        const nextLink = nextPage
            ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&sortBy=${sortBy}&order=${order}`
            : null;
        const prevLink = prevPage
            ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&sortBy=${sortBy}&order=${order}`
            : null;

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            "Community members fetched successfully.",
            {
                totalCommunityRoles: totalCount,
                totalRolesInPage: getCommunityRoles.length,
                currentPage: page,
                totalPages: totalPages,
                nextPage: nextPage,
                prevPage: prevPage,
                nextLink: nextLink,
                prevLink: prevLink,
                communityRoles: getCommunityRoles,
            }
        );
    } catch (err) {
        console.error("Error fetching community roles:", err);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.INTERNALSERVERERROR,
            "Internal Server Error"
        );
    }
});

exports.downgradeMember = catchAsyncError(async (req, res) => {

    const { communityRole, communityId, memberId } = req.body;

    if (!communityRole || !communityId || !memberId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Community role, community ID, and member ID are required."
        );
    }

    const requesterId = req.user.id;
    const requesterRole = await CommunityMember.findOne({
        communityId,
        memberId: requesterId,
    });

    if (!requesterRole || !['admin', 'moderator'].includes(requesterRole.communityRole)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "You do not have permission to remove members."
        );
    }

    if (
        requesterRole.communityRole === 'moderator' &&
        communityRole === 'admin'
    ) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Moderators cannot remove Admins."
        );
    }

    const isCommunityExists = await Community.findOne({
        _id: communityId
    }).lean()

    if (!isCommunityExists) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.NOTFOUND,
            "Community not found."
        );
    }

    if (isCommunityExists.userId == memberId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "You cannot downgrade community Creator to normal member from the community."
        );
    }

    const covertToMember = await CommunityMember.findByIdAndUpdate({
        _id: memberId,
        communityId,
    }, {
        communityRole: 'member',
    }, {
        new: true
    }
    )

    if (!covertToMember) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.NOTFOUND,
            "Member not covert to normal member in the community."
        );
    }

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        "Member downgrade successfully."
    );
})

exports.addAdminOrModerator = catchAsyncError(async (req, res) => {

    const { communityRole, communityId, memberIds } = req.body; // communityRole = admin, moderator

    if (!communityRole || !communityId || !memberIds || memberIds.length === 0) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Community role, community ID, and at least one member ID are required."
        );
    }

    if (!['admin', 'moderator'].includes(communityRole)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.UNAUTHORIZED,
            "Invalid community role. Must be 'admin' or 'moderator'."
        );
    }

    const requesterId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Community not found."
        );
    }

    const requesterRole = await CommunityMember.findOne({
        communityId,
        memberId: requesterId,
    });

    if (!requesterRole || requesterRole.communityRole !== 'admin') {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "You do not have permission to add admins or moderators."
        );
    }

    const bulkOps = memberIds.map(memberId => ({
        updateOne: {
            filter: { communityId, memberId },
            update: { communityRole, updatedBy: requesterId, status: 'active' },
            upsert: true,
        },
    }));

    const bulkWriteResult = await CommunityMember.bulkWrite(bulkOps);

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        `${communityRole.charAt(0).toUpperCase() + communityRole.slice(1)}s added/updated successfully.`
    );
});

// exports.sendJoinRequest = catchAsyncError(async (req, res) => {
//     const { communityId, toggleAction } = req.body;

//     // toggleAction = "sendRequest", "cancelRequest" ..... Only in the case of private community

//     if (!communityId) {
//         return response.responseHandlerWithMessage(
//             res,
//             false,
//             statusCode.DATAMISSING,
//             "Community ID is required."
//         );
//     }

//     const userId = req.user.id;
//     console.log("userId",userId);
//     const community = await Community.findById(communityId);

//     if (!community) {
//         return response.responseHandlerWithMessage(
//             res,
//             false,
//             statusCode.RESULTNOTFOUND,
//             "Community not found."
//         );
//     }

//     const isAlreadyMember = await CommunityMember.findOne({
//         communityId,
//         memberId: userId,
//         status: { $in: ['active', 'block'] },
//     });

//     if (isAlreadyMember) {
//         return response.responseHandlerWithMessage(
//             res,
//             false,
//             statusCode.DATAMISSING,
//             "You have already a member of this community."
//         );
//     }

//     if (community.communityType == "public") {

//         const saveMemberData = new CommunityMember({
//             communityId: new mongoose.Types.ObjectId(community._id),
//             memberId: new mongoose.Types.ObjectId(userId),
//             communityRole: "member",
//             status: "active"
//         });

//         await saveMemberData.save();

//         return response.responseHandlerWithMessage(
//             res,
//             true,
//             statusCode.SUCCESS,
//             "You have successfully joined to the community."
//         );
//     }

//     const isAlreadySendJoinRequest = await CommunityRequest.findOne({
//         "sendBy.id": new mongoose.Types.ObjectId(userId),
//         "sendTo.id": new mongoose.Types.ObjectId(communityId)
//     })

//     if (isAlreadySendJoinRequest) {
//         return response.responseHandlerWithMessage
//             (
//                 res,
//                 false,
//                 statusCode.DATAMISSING,
//                 "You have already sent a join request to this community."
//             );
//     }

//     const joinRequest = new CommunityRequest({
//         sendBy: {
//             id: new mongoose.Types.ObjectId(userId),
//             type: "user"
//         },
//         sendTo: {
//             id: new mongoose.Types.ObjectId(communityId),
//             type: "community"
//         },
//         status: 'pending',
//     });

//     await joinRequest.save();

//     return response.responseHandlerWithMessage(
//         res,
//         true,
//         statusCode.SUCCESS,
//         "Join request sent successfully."
//     );
// });

exports.sendJoinRequest = catchAsyncError(async (req, res) => {
    const { communityId, toggleAction } = req.body;

    if (!communityId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Community ID is required."
        );
    }

    if (!["sendRequest", "cancelRequest"].includes(toggleAction)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Invalid toggle action. Use 'sendRequest' or 'cancelRequest'."
        );
    }

    const userId = req.user.id;
    const community = await Community.findById(communityId);

    if (!community) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Community not found."
        );
    }

    const isAlreadyMember = await CommunityMember.findOne({
        communityId,
        memberId: userId,
        status: { $in: ['active', 'block'] },
    });

    if (isAlreadyMember) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "You are already a member of this community."
        );
    }

    if (community.communityType === "public" && toggleAction === "sendRequest") {
        const saveMemberData = new CommunityMember({
            communityId: new mongoose.Types.ObjectId(community._id),
            memberId: new mongoose.Types.ObjectId(userId),
            communityRole: "member",
            status: "active",
        });

        await saveMemberData.save();

        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            "You have successfully joined the community."
        );
    }

    const existingRequest = await CommunityRequest.findOne({
        "sendBy.id": new mongoose.Types.ObjectId(userId),
        "sendTo.id": new mongoose.Types.ObjectId(communityId),
    });

    if (toggleAction === "sendRequest") {
        if (existingRequest) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "You have already sent a join request to this community."
            );
        }

        const joinRequest = new CommunityRequest({
            sendBy: {
                id: new mongoose.Types.ObjectId(userId),
                type: "user",
            },
            sendTo: {
                id: new mongoose.Types.ObjectId(communityId),
                type: "community",
            },
            status: "pending",
        });

        await joinRequest.save();


        const admins = await CommunityMember.find({
            communityId,
            communityRole: "admin",
            status: "active",
        });
    
        const adminIds = admins.map(admin => admin.memberId.toString());
    
        if (adminIds.length > 0) {
            const notificationMessage = `${req.user.data.name || req.user.data.businessName || "A user"} has requested to join your "${community.communityName}" community.`;
            const payload = {
                communityId: community._id.toString(),
                type: "community"
            };
    
            await sendUserBulkNotifications(userId, adminIds, "Community Join Request", notificationMessage, payload);
        }

        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            "Join request sent successfully."
        );
    } else if (toggleAction === "cancelRequest") {
        if (!existingRequest) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "No join request found to cancel."
            );
        }

        await CommunityRequest.deleteOne({ _id: existingRequest._id });

        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            "Join request canceled successfully."
        );
    }
});


exports.getJoiningRequests = catchAsyncError(async (req, res) => {
    const { communityId, status = "pending", pageNo = 1, limit = 10 } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const skip = pageLimit * (page - 1);

    if (!communityId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Community ID is required."
        );
    }

    const requesterId = req.user.id;

    const requesterRole = await CommunityMember.findOne({
        communityId,
        memberId: requesterId,
    });

    if (!requesterRole || !['admin', 'moderator'].includes(requesterRole.communityRole)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "You do not have permission to view join requests."
        );
    }

    const matchQuery = {
        "sendTo.type": "community",
        "status": status,
    };

    if (communityId) {
        matchQuery["sendTo.id"] = new mongoose.Types.ObjectId(communityId);
    }

    const joinRequests = await CommunityRequest.aggregate([
        { $match: matchQuery },
        {
            $lookup: {
                from: "users",
                localField: "sendBy.id",
                foreignField: "_id",
                as: "userDetails",
            },
        },
        {
            $project: {
                sendBy: 1,
                sendTo: 1,
                status: 1,
                createdAt: 1,
                userDetails: {
                    name: 1,
                    email: 1,
                    businessName: 1,
                    username: 1,
                    profileImage: 1,
                    accountType: 1,
                    shortBio: 1,
                    occupationTitle: 1,
                    occupationSector: 1,
                    workExperience: 1,
                    description: 1,
                    companyName: 1,
                    expertise: 1,
                    blueTick: 1,
                },
            },
        },
        { $skip: skip },
        { $limit: pageLimit },
    ]);


    const totalRequests = await CommunityRequest.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalRequests / pageLimit);

    const baseUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    const nextLink = nextPage
        ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&status=${status}&communityId=${communityId}`
        : null;
    const prevLink = prevPage
        ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&status=${status}&communityId=${communityId}`
        : null;

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Join requests fetched successfully.",
        {
            joinRequests,
            currentPage: page,
            totalPages,
            totalRequests,
            nextPage,
            prevPage,
            nextLink,
            prevLink,
        }
    );
});

exports.approveOrRejectRequest = catchAsyncError(async (req, res) => {

    const { requestId, actionType } = req.body;

    const userId = req.user.id;

    const request = await CommunityRequest.findById(requestId);

    if (!request) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "Join request not found.");
    }

    const community = await Community.findById(request.sendTo.id).lean();

    if (!community) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "Community not found.");
    }

    const requesterRole = await CommunityMember.findOne({
        communityId: community.id,
        memberId: userId,
    });

    if (!requesterRole || !['admin', 'moderator'].includes(requesterRole.communityRole)) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "You do not have permission to approve or reject join requests.");
    }

    if (actionType == "approve") {

        const communityMember = await CommunityMember.findOne({ communityId: community._id, memberId: new mongoose.Types.ObjectId(request.sendBy.id) });

        if (communityMember) {
            return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "User is already a member of the community.");
        }

        const newCommunityMember = new CommunityMember({
            communityId: community.id,
            memberId: new mongoose.Types.ObjectId(request.sendBy.id),
            communityRole: "member",
            status: "active"
        });

        await newCommunityMember.save();
        await request.deleteOne();

        await sendOneToOneNotification(
            userId,
            request.sendBy.id.toString(),
            "Community Join Request Approved",
            `${req.user.data.name || req.user.data.businessName || "A admin"} approved your request to join the "${community.communityName}" community.`,
            {
                communityId: community._id.toString(),
                type: "community"
            }
        );

    } else if (actionType == "reject") {

        await request.deleteOne();
    }

    return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, "Join request approved/rejected successfully.");

})

exports.toggleBlockUserInCommunity = catchAsyncError(async (req, res) => {
    const { communityId, userId, toggleAction } = req.body;

    if (!["block", "unblock"].includes(toggleAction)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Invalid toggleAction. Allowed values are 'block' or 'unblock'."
        );
    }

    const communityMember = await CommunityMember.findOne({
        communityId,
        memberId: new mongoose.Types.ObjectId(userId),
    });

    if (!communityMember) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.NOTFOUND,
            "User is not a member of the community."
        );
    }

    const newStatus = toggleAction === "block" ? "block" : "active";

    if (communityMember.status === newStatus) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            `User is already ${newStatus === "block" ? "blocked" : "active"} in the community.`
        );
    }

    communityMember.status = newStatus;
    communityMember.updatedBy = req.user.id;
    await communityMember.save();

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        `User has been successfully ${newStatus === "block" ? "blocked" : "unblocked"} in the community.`
    );
});

exports.blockMemberList = catchAsyncError(async (req, res) => {

    const { pageNo = 1, limit = 10, communityId } = req.query;

    // Validate communityId
    if (!communityId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Community ID is required."
        );
    }

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const skip = pageLimit * (page - 1);



    const blockedMembers = await CommunityMember.aggregate([
        {
            $match: {
                communityId: new mongoose.Types.ObjectId(communityId),
                status: "block",
            },
        },
        {
            $lookup: {
                from: "users",
                let: { userId: "$memberId" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$_id", "$$userId"] },
                            status: "active",
                        },
                    },
                    {
                        $project: {
                            name: 1,
                            email: 1,
                            username: 1,
                            profileImage: 1,
                        },
                    },
                ],
                as: "userDetails",
            },
        },
        {
            $unwind: "$userDetails", // Flatten userDetails array
        },
        {
            $project: {
                communityId: 1,
                memberId: 1,
                updatedBy: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1,
                "userDetails.name": 1,
                "userDetails.email": 1,
                "userDetails.username": 1,
                "userDetails.profileImage": 1,
            },
        },
        { $skip: skip },
        { $limit: pageLimit },
    ]);

    const totalBlockedMembers = await CommunityMember.countDocuments({
        communityId: new mongoose.Types.ObjectId(communityId),
        status: "block",
    });

    const totalPages = Math.ceil(totalBlockedMembers / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;


    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Blocked members fetched successfully.",
        {
            blockedMembers,
            currentPage: page,
            totalPages,
            totalBlockedMembers,
            nextPage,
            prevPage,
        }
    );
});

exports.removeMember = catchAsyncError(async (req, res) => {

    const { communityId, userId } = req.body;

    const userToRemove = await User.findById(new mongoose.Types.ObjectId(userId));

    if (!userToRemove) {
        return response.responseHandlerWithMessage(res, false, statusCode.NOTFOUND, "User not found.");
    }

    const community = await Community.findById(communityId);

    if (!community) {
        return response.responseHandlerWithMessage(res, false, statusCode.NOTFOUND, "Community not found.");
    }

    const memberToRemove = await CommunityMember.findOne({ communityId, memberId: new mongoose.Types.ObjectId(userId) });

    if (!memberToRemove) {
        return response.responseHandlerWithMessage(res, false, statusCode.NOTFOUND, "User is not a member of the community.");
    }

    if (["admin", "moderator"].includes(memberToRemove.communityRole)) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "Admin or moderator cannot be removed from the community.");
    }

    await CommunityMember.deleteOne({ _id: memberToRemove._id });

    return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, "User removed from the community successfully.");
});

// exports.getAllCommunityReportedPosts = catchAsyncError(async (req, res) => {
//     const {
//         limit = 10,
//         pageNo = 1,
//         sortBy = "createdAt",
//         order = "desc",
//         reportName = "all" // all, Off Topic, Violation of listen, Violation of language, others
//     } = req.query;

//     const communityId = req.params.communityId;

//     const pageLimit = parseInt(limit, 10);
//     const page = parseInt(pageNo, 10);
//     const offset = pageLimit * (page - 1);
//     const sortOrder = order === "asc" ? 1 : -1;

//     let matchStage = {
//         reportType: "communityPost",
//         reportToCommunityPost: new mongoose.Types.ObjectId(communityId),
//     };

//     // Report Name filter stage
//     const reportNameFilterStage = reportName !== "all" ? {
//         $lookup: {
//             from: "configurations",
//             let: { reportId: "$reportNameId" },
//             pipeline: [
//                 { $unwind: "$reports" },
//                 {
//                     $match: {
//                         $expr: {
//                             $and: [
//                                 { $eq: ["$reports._id", "$$reportId"] },
//                                 { $eq: ["$reports.reportName", reportName] },
//                             ],
//                         },
//                     },
//                 },
//                 { $project: { _id: 0 } }, // Project only matching records
//             ],
//             as: "filteredReportDetails",
//         }
//     } : null;

//     const reportPostsAggregation = await Report.aggregate([
//         { $match: matchStage },
//         {
//             $lookup: {
//                 from: "posts",
//                 localField: "postId",
//                 foreignField: "_id",
//                 as: "reportedToPost",
//             },
//         },
//         {
//             $unwind: {
//                 path: "$reportedToPost",
//                 preserveNullAndEmptyArrays: true,
//             },
//         },
//         {
//             $lookup: {
//                 from: "users",
//                 localField: "reportBy",
//                 foreignField: "_id",
//                 as: "reportedBy",
//                 pipeline: [
//                     {
//                         $project: {
//                             _id: 1,
//                             name: 1,
//                             businessName: 1,
//                             profileImage: 1,
//                             shortBio: 1,
//                             description: 1,
//                             username: 1,
//                             blueTick: 1,
//                         },
//                     },
//                 ],
//             },
//         },
//         {
//             $unwind: {
//                 path: "$reportedBy",
//                 preserveNullAndEmptyArrays: true,
//             },
//         },
//         {
//             $lookup: {
//                 from: "users",
//                 localField: "postByUserId",
//                 foreignField: "_id",
//                 as: "postCreator",
//                 pipeline: [
//                     {
//                         $lookup: {
//                             from: "friends",
//                             localField: "_id",
//                             foreignField: "userId",
//                             as: "followers",
//                         },
//                     },
//                     { $addFields: { numberOfFollowers: { $size: "$followers" } } },
//                     {
//                         $project: {
//                             _id: 1,
//                             name: 1,
//                             businessName: 1,
//                             profileImage: 1,
//                             shortBio: 1,
//                             description: 1,
//                             username: 1,
//                             blueTick: 1,
//                             numberOfFollowers: 1,
//                         },
//                     },
//                 ],
//             },
//         },
//         {
//             $unwind: {
//                 path: "$postCreator",
//                 preserveNullAndEmptyArrays: true,
//             },
//         },
//         {
//             $lookup: {
//                 from: "configurations",
//                 let: { reportId: "$reportNameId" },
//                 pipeline: [
//                     { $unwind: "$reports" },
//                     {
//                         $match: {
//                             $expr: { $eq: ["$reports._id", "$$reportId"] },
//                         },
//                     },
//                     {
//                         $project: {
//                             _id: 0,
//                             reportName: "$reports.reportName",
//                             description: "$reports.description",
//                         },
//                     },
//                 ],
//                 as: "reportNameDetails",
//             },
//         },
//         ...(reportName !== "all" ? [reportNameFilterStage] : []), // Add filter only if not "all"
//         ...(reportName !== "all" ? [{ $match: { filteredReportDetails: { $ne: [] } } }] : []), // Filter results
//         { $sort: { [sortBy]: sortOrder } },
//         { $skip: offset },
//         { $limit: pageLimit },
//         // Final projection stage
//         {
//             $project: {
//                 postId: 1,
//                 reportedToPost: 1,
//                 reportedBy: 1,
//                 postByUserId: 1,
//                 postCreator: 1,
//                 reportNameDetails: 1,
//             },
//         },
//     ]);

//     const totalCountAggregation = await Report.aggregate([
//         { $match: matchStage },
//         ...(reportName !== "all" ? [reportNameFilterStage] : []),
//         ...(reportName !== "all" ? [{ $match: { filteredReportDetails: { $ne: [] } } }] : []),
//         { $count: "totalCount" },
//     ]);

//     const totalCount = totalCountAggregation[0]?.totalCount || 0;
//     const totalPages = Math.ceil(totalCount / pageLimit);
//     const nextPage = page < totalPages ? page + 1 : null;
//     const prevPage = page > 1 ? page - 1 : null;

//     const baseUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;
//     const nextLink = nextPage
//         ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&sortBy=${sortBy}&order=${order}&reportName=${reportName}`
//         : null;
//     const prevLink = prevPage
//         ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&sortBy=${sortBy}&order=${order}&reportName=${reportName}`
//         : null;

//     return response.responseHandlerWithData(
//         res,
//         true,
//         statusCode.SUCCESS,
//         "Posts fetched successfully",
//         {
//             totalPosts: totalCount,
//             totalPostsInPage: reportPostsAggregation.length,
//             currentPage: page,
//             totalPages: totalPages,
//             nextPage: nextPage,
//             prevPage: prevPage,
//             nextLink: nextLink,
//             prevLink: prevLink,
//             reportedPosts: reportPostsAggregation,
//         }
//     );
// });


exports.getAllCommunityReportedPosts = catchAsyncError(async (req, res) => {
    const {
        limit = 10,
        pageNo = 1,
        sortBy = "createdAt",
        order = "desc",
        reportName = "all", // all, Off Topic, Violation of listen, etc.
    } = req.query;

    const communityId = req.params.communityId;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);
    const sortOrder = order === "asc" ? 1 : -1;

    let matchStage = {
        reportType: "communityPost",
        reportToCommunityPost: new mongoose.Types.ObjectId(communityId),
    };

    const communityData = await Community.findById(communityId, "mutedMembers savedPosts").lean();

    if (!communityData) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Community not found"
        );
    }

    const { mutedMembers, savedPosts } = communityData;

    const reportNameFilterStage = reportName !== "all" ? {
        $lookup: {
            from: "configurations",
            let: { reportId: "$reportNameId" },
            pipeline: [
                { $unwind: "$reports" },
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$reports._id", "$$reportId"] },
                                { $eq: ["$reports.reportName", reportName] },
                            ],
                        },
                    },
                },
                { $project: { _id: 0 } },
            ],
            as: "filteredReportDetails",
        },
    } : null;

    const reportPostsAggregation = await Report.aggregate([
        { $match: matchStage },
        {
            $lookup: {
                from: "posts",
                localField: "postId",
                foreignField: "_id",
                as: "reportedToPost",
            },
        },
        { $unwind: { path: "$reportedToPost", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                localField: "reportBy",
                foreignField: "_id",
                as: "reportedBy",
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
                        },
                    },
                ],
            },
        },
        { $unwind: { path: "$reportedBy", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                localField: "postByUserId",
                foreignField: "_id",
                as: "postCreator",
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
                        },
                    }
                ]
            },
        },
        { $unwind: { path: "$postCreator", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "communitymembers",
                let: { communityId: "$reportToCommunityPost", postByUserId: "$postByUserId" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$communityId", "$$communityId"] },
                                    { $eq: ["$memberId", "$$postByUserId"] },
                                ],
                            },
                        },
                    },
                    { $project: { _id: 0, status: 1 } },
                ],
                as: "postCreatorStatus",
            },
        },
        {
            $addFields: {
                isPostCreatorBlocked: {
                    $cond: [
                        { $gt: [{ $size: "$postCreatorStatus" }, 0] }, // Check if postCreatorStatus is not empty
                        {
                            $in: ["block", { $map: { input: "$postCreatorStatus", as: "status", in: "$$status.status" } }]
                        },
                        false,
                    ],
                },
                isMute: { $in: ["$postByUserId", mutedMembers] },
                isSavePost: { $in: ["$postId", savedPosts] },
            },
        },
        {
            $lookup: {
                from: "configurations",
                let: { reportId: "$reportNameId" },
                pipeline: [
                    { $unwind: "$reports" },
                    {
                        $match: {
                            $expr: { $eq: ["$reports._id", "$$reportId"] },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            reportName: "$reports.reportName",
                            description: "$reports.description",
                        },
                    },
                ],
                as: "reportNameDetails",
            },
        },
        ...(reportName !== "all" ? [reportNameFilterStage] : []),
        ...(reportName !== "all" ? [{ $match: { filteredReportDetails: { $ne: [] } } }] : []),
        { $sort: { [sortBy]: sortOrder } },
        { $skip: offset },
        { $limit: pageLimit },
        {
            $project: {
                postId: 1,
                reportedToPost: 1,
                reportedBy: 1,
                postByUserId: 1,
                postCreator: 1,
                reportNameDetails: 1,
                isPostCreatorBlocked: 1, // Include the blocked status in the result
                isMute: 1,
                isSavePost: 1,
            },
        },
    ]);

    const totalCountAggregation = await Report.aggregate([
        { $match: matchStage },
        ...(reportName !== "all" ? [reportNameFilterStage] : []),
        ...(reportName !== "all" ? [{ $match: { filteredReportDetails: { $ne: [] } } }] : []),
        { $count: "totalCount" },
    ]);

    const totalCount = totalCountAggregation[0]?.totalCount || 0;
    const totalPages = Math.ceil(totalCount / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    const baseUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;
    const nextLink = nextPage
        ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&sortBy=${sortBy}&order=${order}&reportName=${reportName}`
        : null;
    const prevLink = prevPage
        ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&sortBy=${sortBy}&order=${order}&reportName=${reportName}`
        : null;

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Posts fetched successfully",
        {
            totalPosts: totalCount,
            totalPostsInPage: reportPostsAggregation.length,
            currentPage: page,
            totalPages: totalPages,
            nextPage: nextPage,
            prevPage: prevPage,
            nextLink: nextLink,
            prevLink: prevLink,
            reportedPosts: reportPostsAggregation,
        }
    );
});

exports.toggleActions = catchAsyncError(async (req, res) => {
    const { communityId, postId, memberId, toggleAction, actionType } = req.body; // Extract inputs
    const requesterId = req.user.id; // Get userId of the requester

    // Validate toggleAction and actionType
    if (!["save", "unsave", "mute", "unmute", "pin", "unpin"].includes(toggleAction)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Invalid toggleAction. Allowed values are 'save', 'unsave', 'mute', or 'unmute'."
        );
    }

    if (!["savePost", "muteMember", "pinPost"].includes(actionType)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Invalid actionType. Allowed values are 'savePost' or 'muteMember'."
        );
    }

    // Fetch Community
    const community = await Community.findById(new mongoose.Types.ObjectId(communityId));
    if (!community) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.NOTFOUND,
            "Community not found."
        );
    }

    // Action Type: savePost
    if (actionType === "savePost") {
        const isPostExist = await Post.findOne({
            _id: new mongoose.Types.ObjectId(postId),
            communityId: new mongoose.Types.ObjectId(communityId)
        });
        if (!isPostExist) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.NOTFOUND,
                "Post not found."
            );
        }

        const isAlreadySaved = community.savedPosts.includes(postId);

        if (toggleAction === "save") {
            if (isAlreadySaved) {
                return response.responseHandlerWithMessage(
                    res,
                    false,
                    statusCode.CONFLICT,
                    "Post is already saved in the community."
                );
            }
            community.savedPosts.push(postId);
        } else if (toggleAction === "unsave") {
            if (!isAlreadySaved) {
                return response.responseHandlerWithMessage(
                    res,
                    false,
                    statusCode.CONFLICT,
                    "Post is not saved in the community."
                );
            }
            community.savedPosts = community.savedPosts.filter(
                (savedPostId) => savedPostId.toString() !== postId
            );
        }

        await community.save();

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            `Post has been successfully ${toggleAction === "save" ? "saved" : "unsaved"} in the community.`,
            { savedPosts: community.savedPosts }
        );
    }
    // Action Type: muteMember
    else if (actionType === "muteMember") {
        const isMemberExist = await CommunityMember.findOne({
            communityId: new mongoose.Types.ObjectId(communityId),
            memberId: new mongoose.Types.ObjectId(memberId)
        });

        console.log("isMemberExist", isMemberExist)

        if (!isMemberExist) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.NOTFOUND,
                "Member not found."
            );
        }

        const isAlreadyMuted = community.mutedMembers.includes(memberId);

        if (toggleAction === "mute") {
            if (isAlreadyMuted) {
                return response.responseHandlerWithMessage(
                    res,
                    false,
                    statusCode.SUCCESS,
                    "Member is already muted in the community."
                );
            }
            community.mutedMembers.push(memberId);
        } else if (toggleAction === "unmute") {
            if (!isAlreadyMuted) {
                return response.responseHandlerWithMessage(
                    res,
                    false,
                    statusCode.SUCCESS,
                    "Member is not muted in the community."
                );
            }
            community.mutedMembers = community.mutedMembers.filter(
                (mutedMemberId) => mutedMemberId.toString() !== memberId
            );
        }

        await community.save();

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            `Member has been successfully ${toggleAction === "mute" ? "muted" : "unmuted"} in the community.`,
            { mutedUsers: community.mutedMembers }
        );
    } else if (actionType === "pinPost") {

        const isPostExist = await Post.findOne({
            _id: new mongoose.Types.ObjectId(postId),
            communityId: new mongoose.Types.ObjectId(communityId)
        });
        if (!isPostExist) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.NOTFOUND,
                "Post not found."
            );
        }

        const isAlreadyPinned = community.pinedPosts.includes(postId);

        if (toggleAction === "pin") {
            if (isAlreadyPinned) {
                return response.responseHandlerWithMessage(
                    res,
                    false,
                    statusCode.CONFLICT,
                    "Post is already pinned in the community."
                );
            }
            community.pinedPosts.push(postId);
        } else if (toggleAction === "unpin") {
            if (!isAlreadyPinned) {
                return response.responseHandlerWithMessage(
                    res,
                    false,
                    statusCode.CONFLICT,
                    "Post is not pinned in the community."
                );
            }
            community.pinedPosts = community.pinedPosts.filter(
                (pinedPostId) => pinedPostId.toString() !== postId
            );
        }

        await community.save();

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            `Post has been successfully ${toggleAction === "pin" ? "pinned" : "unpinned"} in the community.`,
            { pinedPosts: community.pinedPosts }
        );
    }
});

exports.muteCommunity = catchAsyncError(async (req, res) => {
    const { communityId, toggleAction } = req.body;
    const userId = req.user.id;

    if (!["mute", "unmute"].includes(toggleAction)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Invalid toggleAction. Allowed values are 'mute' or 'unmute'."
        );
    }

    if (!communityId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Community ID is required."
        );
    }

    const community = await Community.findById(new mongoose.Types.ObjectId(communityId));
    if (!community) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Community not found."
        );
    }

    const isMember = await CommunityMember.findOne({
        communityId: new mongoose.Types.ObjectId(communityId),
        memberId: new mongoose.Types.ObjectId(userId),
    });

    if (!isMember) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "You are not a member of this community."
        );
    }

    const user = await User.findById(userId);
    if (!user) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "User not found."
        );
    }

    const isCommunityMuted = user.mutedCommunities.some(
        (mutedCommunityId) => mutedCommunityId.toString() === communityId
    );

    if (toggleAction === "mute") {
        if (isCommunityMuted) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.CONFLICT,
                "Community is already muted."
            );
        }

        user.mutedCommunities.push(communityId);
    } else if (toggleAction === "unmute") {
        if (!isCommunityMuted) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.CONFLICT,
                "Community is not muted."
            );
        }

        user.mutedCommunities = user.mutedCommunities.filter(
            (mutedCommunityId) => mutedCommunityId.toString() !== communityId
        );
    }

    await user.save();

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        `Community successfully ${toggleAction === "mute" ? "muted" : "unmuted"}.`,
        { mutedCommunities: user.mutedCommunities }
    );
});


exports.leaveCommunity = catchAsyncError(async (req, res) => {

    const { communityId } = req.query;
    const userId = req.user.id;

    if (!communityId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Community ID is required."
        );
    }

    const userMembership = await CommunityMember.findOne({
        communityId: communityId,
        memberId: new mongoose.Types.ObjectId(userId),
    });

    if (!userMembership) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "User is not a member of the community."
        );
    }

    if (userMembership.communityRole === "admin") {
        const adminCount = await CommunityMember.countDocuments({
            communityId: communityId,
            communityRole: "admin",
            status: "active",
        });

        if (adminCount <= 1) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.FORBIDDEN,
                "At least one admin must remain in the community. Transfer admin rights before leaving."
            );
        }
    }

    await CommunityMember.findOneAndDelete({
        communityId: communityId,
        memberId: new mongoose.Types.ObjectId(userId)
    });

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        "You have successfully left the community."
    );
});

exports.deleteCommunity = catchAsyncError(async (req, res) => {
    const { communityId } = req.query;
    const userId = req.user.id;

    try {
        const community = await Community.findOne({ _id: communityId, userId });

        if (!community) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "Community not found or you are not authorized to delete it."
            );
        }

        community.status = 'inactive';
        community.deletionHistory.push({
            deletedBy: userId,
            deletedAt: new Date()
        });
        await community.save();

        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            "Community has been successfully deleted."
        );
    } catch (error) {
        console.error("Error deleting community:", error);
        return response.responseHandlerWithError(
            res,
            false,
            statusCode.ERROR,
            "An error occurred while deleting the community."
        );
    }
});





