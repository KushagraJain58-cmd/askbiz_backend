const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
let Report = require("../../../models/report")
let Post = require("../../../models/post")
let User = require("../../../models/users")
let Friend = require("../../../models/follow").Friend
let FriendRequest = require("../../../models/follow").FriendRequest
let CommunityMember = require("../../../models/communityMembers");
let CommunityRequest = require("../../../models/chatRequests");
let Community = require("../../../models/community");
let ChatRoom = require("../../../models/chat")
const Comment = require('../../../models/comment');
const Reply = require('../../../models/reply');
const Interaction = require('../../../models/interaction');
const Like = require('../../../models/like');
const UserNotification = require("../../../models/userNotification") 

let mongoose = require("mongoose");


exports.getUsers = catchAsyncError(async (req, res) => {
    const {
        limit = 10,
        pageNo = 1,
        by = "",
        sortBy = "createdAt",
        order = "desc",
        status = "",
        accountType = "",
        followersDeepSearch = "",
        postsDeepSearch = "",
        fromDate = "",
        toDate = new Date()
    } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);
    const sortOrder = order === "asc" ? 1 : -1;

    const loggedInUser = await User.findById(req.user.id).select(["interest", "hiddenPosts", "blockedUsers", "location"]);

    const blockedUsersByAdmin = await User.find({ status: "blocked" }).lean().select(["_id", "status"])

    const blockedUsersByAdminIds = blockedUsersByAdmin.map(b => b._id);

    let matchStage = {};

    if (loggedInUser) {
        const toHideUsers = [...loggedInUser.blockedUsers, new mongoose.Types.ObjectId(req.user.id), ...blockedUsersByAdminIds]

        matchStage._id = { $nin: toHideUsers };
    }

    if (by) {
        const searchTerms = by.trim().split(/\s+/);
        matchStage.$or = searchTerms.map(term => ({
            $or: [
                { name: { $regex: term, $options: "i" } },
                { businessName: { $regex: term, $options: "i" } },
                { username: { $regex: term, $options: "i" } },
                { accountType: { $regex: term, $options: "i" } },
                { email: { $regex: term, $options: "i" } },
                { phoneNumber: { $regex: term, $options: "i" } },
                { status: { $regex: term, $options: "i" } },
            ]
        })).flat();
    }

    if (status) {
        matchStage.status = status;
    }

    if (accountType) {
        matchStage.accountType = accountType;
    }

    if (fromDate && toDate) {

        const fromDateParsed = new Date(fromDate);
        const toDateParsed = new Date(toDate);

        toDateParsed.setHours(23, 59, 59, 999);

        matchStage.createdAt = {
            $gte: fromDateParsed,
            $lte: toDateParsed
        };
    }

    let deepMatch = {};

    if (followersDeepSearch) {
        const [comparison, value] = followersDeepSearch.split(',');
        const followersValue = parseInt(value, 10);
        deepMatch.numberOfFollowers = comparison === 'moreThan'
            ? { $gt: followersValue }
            : { $lt: followersValue };
    }

    if (postsDeepSearch) {
        const [comparison, value] = postsDeepSearch.split(',');
        const postsValue = parseInt(value, 10);
        deepMatch.numberOfPosts = comparison === 'moreThan'
            ? { $gt: postsValue }
            : { $lt: postsValue };
    }

    const usersAggregation = await User.aggregate([
        { $match: matchStage },
        {
            $lookup: {
                from: 'posts',
                localField: '_id',
                foreignField: 'userId',
                as: 'posts',
            },
        },
        { $addFields: { numberOfPosts: { $size: '$posts' } } },

        {
            $lookup: {
                from: 'friends',
                localField: '_id',
                foreignField: 'userId',
                as: 'followers',
            },
        },
        { $addFields: { numberOfFollowers: { $size: '$followers' } } },
        {
            $lookup: {
                from: 'reports',
                let: { userId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$status', 'active'] },
                                    {
                                        $or: [
                                            { $eq: ['$reportToUser', '$$userId'] },
                                            { $eq: ['$postByUserId', '$$userId'] }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                ],
                as: 'reports',
            },
        },
        { $addFields: { numberOfReports: { $size: '$reports' } } },
        {
            $lookup: {
                from: 'reports',
                let: { userId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$status', 'active'] },
                                    { $eq: ['$reportSeen', false] },
                                    {
                                        $eq: ['$reportToUser', '$$userId'],
                                    }
                                ]
                            }
                        }
                    }
                ],
                as: 'unseenReports',
            },
        },
        { $addFields: { unseenReportsCount: { $size: '$unseenReports' } } },

        { $match: deepMatch },

        {
            $sort: {
                [sortBy === 'posts' ? 'numberOfPosts' :
                    sortBy === 'followers' ? 'numberOfFollowers' :
                        sortBy === 'reports' ? 'numberOfReports' : 'createdAt']: sortOrder
            }
        },
        { $skip: offset },
        { $limit: pageLimit },

        {
            $project: {
                id: 1,
                name: 1,
                businessName: 1,
                username: 1,
                profileImage: 1,
                accountType: 1,
                email: 1,
                phoneNumber: 1,
                status: 1,
                createdAt: 1,
                numberOfPosts: 1,
                numberOfFollowers: 1,
                numberOfReports: 1,
                unseenReportsCount: 1,
                description: 1,
                shortBio: 1,
            }
        },
    ]);

    const totalCount = await User.countDocuments(matchStage);
    const totalPages = Math.ceil(totalCount / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    const baseUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
    const nextLink = nextPage ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&by=${by}&sortBy=${sortBy}&order=${order}&status=${status}&accountType=${accountType}&followersDeepSearch=${followersDeepSearch}&postsDeepSearch=${postsDeepSearch}&fromDate=${fromDate}&toDate=${toDate}` : null;
    const prevLink = prevPage ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&by=${by}&sortBy=${sortBy}&order=${order}&status=${status}&accountType=${accountType}&followersDeepSearch=${followersDeepSearch}&postsDeepSearch=${postsDeepSearch}&fromDate=${fromDate}&toDate=${toDate}` : null;

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Users fetched successfully.", {
        totalUsers: totalCount,
        totalUserInAPage: usersAggregation.length,
        currentPage: page,
        totalPages: totalPages,
        nextPage: nextPage,
        prevPage: prevPage,
        nextLink: nextLink,
        prevLink: prevLink,
        users: usersAggregation.map((user) => {
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
                numberOfPosts: user.numberOfPosts,
                numberOfFollowers: user.numberOfFollowers,
                numberOfReports: user.numberOfReports,
                unseenReportsCount: user.unseenReportsCount,
                commonDescription: user.description ? user.description : user.shortBio
            }
        })
    })

})

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) return res.status(200).json({ success: false, message: "User not found to delete" });

    const posts = await Post.find({ userId }, { _id: 1 });
    const postIds = posts.map(p => p._id);

    const comments = await Comment.find({ postId: { $in: postIds } }, { _id: 1 });
    const commentIds = comments.map(c => c._id);

    await Promise.all([
      Post.deleteMany({ _id: { $in: postIds } }),
      Comment.deleteMany({ postId: { $in: postIds } }),
      Like.deleteMany({ postId: { $in: postIds } }),
      Interaction.deleteMany({ postId: { $in: postIds } }),

      Reply.deleteMany({ $or: [{ commentId: { $in: commentIds } }] }),
    ]);

    await Promise.all([
      Interaction.deleteMany({ userId }),
      Like.deleteMany({ userId }),
      UserNotification.deleteMany({ $or: [{ senderId: userId }, { recipientId: userId }] }),
      Friend.deleteMany({ $or: [{ userId }, { friendId: userId }] }),
      FriendRequest.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] }),
      CommunityMember.deleteMany({ memberId: userId }),
      CommunityRequest.deleteMany({ $or: [{ "sendBy.id": userId }, { "sendTo.id": userId }] }),
      ChatRoom.updateMany({ "participants.person": userId }, { $pull: { participants: { person: userId } } })
    ]);

    return res.status(200).json({ success: true, message: "User and all related data deleted successfully" });

  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getUserById = async (req, res) => {
    try {
        const userId = req.query.userId;

        const userData = await User.findById(userId).select(['-accessToken', '-deviceToken', '-deviceType', '-hiddenPosts', '-blockedUsers', '-emailVerified', '-phoneNumberVerified', '-emailOtpTimeStampAt', '-emailOtp', '-phoneOtpTimeStampAt', '-phoneOtp', '-password']).lean()

        if (!userData) {
            return res.status(200).json({ success: false, message: "User not found" });
        }

        const postCount = await Post.countDocuments({ userId });

        const followerCount = await Friend.countDocuments({ userId, status: "active" });

        const CommunityCount = await CommunityMember.countDocuments({ memberId: userId })

        const postReports = await Report.find({ 'reportToPost.postByUserId': userId, reportType: "post" }).populate('reportBy').lean()

        const accountReports = await Report.find({ reportToUser: userId, reportType: "user" }).populate('reportBy').lean()

        return res.status(200).json({
            success: true,
            message: "User data fetched successfully",
            data: {
                ...userData,
                postCount,
                followerCount,
                CommunityCount,
                postReports,
                accountReports
            },
        });

    } catch (error) {
        console.error("Error on fetching user details:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};

exports.updateUserStatus = catchAsyncError(async (req, res) => {
    const { status, userId } = req.body;
    const user = await User.findById(userId);

    if (!user) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, `User Not Found`)
    }

    user.status = status;

    await user.save();

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, `User status updated successfully`, { status: user.status })

})



exports.getAccountReportedBy = catchAsyncError(async (req, res) => {
    const {userId} = req.query;

    if (!userId) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "user ID is required.");
    }

    const {
        limit = 10,
        pageNo = 1,
        sortBy = "createdAt",
        order = "desc",
    } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);
    const sortOrder = order === "asc" ? 1 : -1;

    const reportedAccountsAggregation = await Report.aggregate([
        {
            $match: {
                reportToUser: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "reportBy",
                foreignField: "_id",
                as: "reportedBy",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            name: 1,
                            businessName: 1,
                            phoneNumber: 1,
                            profileImage: 1,
                            email: 1,
                            profilePic: 1,
                            location: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "configurations",
                let: { reportId: "$reportNameId" },
                pipeline: [
                    { $unwind: "$reports" },
                    {
                        $match: {
                            $expr: { $eq: ["$reports._id", "$$reportId"] }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            reportName: "$reports.reportName",
                            description: "$reports.description",
                        }
                    }
                ],
                as: "reportNameDetails"
            }
        },
        { $sort: { [sortBy]: sortOrder } },
        { $skip: offset },
        { $limit: pageLimit }
    ]);

    await Report.updateMany({
        reportToUser : userId,
    },
    {
        $set: {
            reportSeen: true
        }
    })

    const totalCount = await Report.countDocuments({ reportToUser : userId }) || 0;
    const totalPages = Math.ceil(totalCount / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    const baseUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
    const nextLink = nextPage
        ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&sortBy=${sortBy}&order=${order}`
        : null;
    const prevLink = prevPage
        ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&sortBy=${sortBy}&order=${order}`
        : null;

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Posts fetched successfully", {
        totalReportedBy: totalCount,
        totalReportedByInPage: reportedAccountsAggregation.length,
        currentPage: page,
        totalPages: totalPages,
        nextPage: nextPage,
        prevPage: prevPage,
        nextLink: nextLink,
        prevLink: prevLink,
        reportAccountBy: reportedAccountsAggregation
    });
});