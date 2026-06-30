let Report = require('../../../models/report');
let { catchAsyncError } = require('../../../../utils/constants/generateError')
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes');
const Configuration = require('../../../models/configuration');
let Tag = require('../../../models/tags');
const { uploadToAws } = require('../../../config/multer');
const Post = require('../../../models/post');
const Reply = require('../../../models/reply');
const Comment = require('../../../models/comment');
const User = require('../../../models/users');
const Like = require('../../../models/like');
const ChatRoom = require('../../../models/chat');
const Message = require('../../../models/message');

let mongoose = require('mongoose');


exports.blockUser = catchAsyncError(async (req, res) => {

    const { blockUserId, toggleBlockUser } = req.body;

    const isBlockUserExists = await User.findById(blockUserId);

    if (!isBlockUserExists) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User not found");
    }

    if (blockUserId == req.user.id) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "You can't block yourself.");
    }

    const user = await User.findById(req.user.id);

    if (toggleBlockUser) {
        if (user.blockedUsers.includes(blockUserId)) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User is already blocked");
        } else {
            user.blockedUsers.push(blockUserId);
        }
    } else {
        if (!user.blockedUsers.includes(blockUserId)) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User is not blocked");
        } else {
            user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== blockUserId);
        }
    }
    await user.save();

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Block User toggled successfully", {
        blockedUsers: user.blockedUsers
    });
});

exports.muteUser = catchAsyncError(async (req, res) => {

    const { muteUserId, toggleMuteUser } = req.body;

    const user = await User.findById(req.user.id);

    if (toggleMuteUser) {
        if (user.mutedUsers.includes(muteUserId)) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "you have already mute that user")
        } else {
            user.mutedUsers.push(muteUserId);
        }
    } else {
        if (!user.mutedUsers.includes(muteUserId)) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Mute first to unMute user.")
        } else {
            user.mutedUsers = user.mutedUsers.filter(id => id.toString() !== muteUserId);
        }
    }
    
    await user.save();

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Mute User toggled successfully", {
        mutedUsers: user.mutedUsers
    });

});

exports.addReport = catchAsyncError(async (req, res) => {

    const userId = req.user.id;

    const { reportType, reportToUser, postId, reportNameId, communityId, reportReason } = req.body;

    const isReportNameExist = await Configuration.findOne({ reports: { $elemMatch: { _id: reportNameId } } })

    if (!isReportNameExist) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Report Name Id doesn't exists.");
    }

    let addReport;

    if (reportType == "individualPost") {

        const post = await Post.findOne({ _id: postId, postType: "normal" }).select('userId').lean();

        if (!post) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Post not found")
        }

        const isAlreadyReported = await Report.findOne({ reportBy: userId, postId: postId, reportType: "individualPost" })

        if (isAlreadyReported) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "You have already reported this post")
        }

        const reportDetails = {
            reportType,
            postId: post._id,
            postByUserId: post.userId,
            reportNameId,
            reportBy: userId
        }

        addReport = new Report(reportDetails);
        await addReport.save();

    } else if (reportType == "user") {

        const user = await User.findById(reportToUser).lean();

        if (!user) {
            return res.status(200).json({ success: false, message: "User not found" });
        }

        const isAlreadyReported = await Report.findOne({ reportBy: userId, reportToUser: reportToUser, reportType: "user" })

        if (isAlreadyReported) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "You have already reported this user")
        }

        const reportDetail = {
            reportType,
            reportToUser: user._id,
            reportNameId,
            reportBy: userId,
            reportReason: reportReason ? reportReason : null
        }
        addReport = new Report(reportDetail);
        await addReport.save();

    } else if (reportType == "communityPost") {

        const communityPost = await Post.findOne({ _id: postId, postType: "community", communityId }).select('userId').lean();

        if (!communityPost) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Community post not found")
        }

        const isAlreadyReported = await Report.findOne({ reportBy: new mongoose.Types.ObjectId(userId), postId: new mongoose.Types.ObjectId(postId), reportType: "communityPost", reportToCommunityPost: new mongoose.Types.ObjectId(communityId) })

        if (isAlreadyReported) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "You have already reported this community Post.")
        }

        const reportDetails = {
            reportType,
            postId: communityPost._id,
            postByUserId: communityPost.userId,
            reportNameId,
            reportBy: userId,
            reportToCommunityPost: communityId,
            reportReason: reportReason ? reportReason : null
        }

        addReport = new Report(reportDetails);
        await addReport.save();

    } else {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Invalid report type");
    }
    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Report added successfully", addReport);
})

exports.saveImageuploadImageToAws = catchAsyncError(async (req, res) => {

    uploadToAws.single('image')(req, res, (err) => {
        if (err) {
            return response.responseHandlerWithMessage(res, false, statusCode.ERROR, `Error uploading image to AWS S3 - ${err}`)
        }
        if (!req.file) {
            return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "No image provided")
        }
        return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Image uploaded to AWS S3 successfully", req.file.location);
    });

});

exports.getTags = catchAsyncError(async (req, res) => {

    const {
        limit = 10,
        pageNo = 1,
        by = "",
        sortBy = "createdAt",
        order = "desc",
    } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);
    const sortOrder = order === "asc" ? 1 : -1;

    let matchStage = {};

    if (by) {
        matchStage.$or = [
            { tagName: { $regex: by, $options: "i" } },
        ]
    }

    const tagsAggregation = await Tag.aggregate([
        { $match: matchStage },
        { $sort: { [sortBy]: sortOrder } },
        { $skip: offset },
        { $limit: pageLimit },
    ])

    tagsAggregation.sort((a, b) => b.tagUsedCount - a.tagUsedCount)

    const totalCount = await Tag.countDocuments(matchStage);
    const totalPages = Math.ceil(totalCount / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    const baseUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
    const nextLink = nextPage ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&by=${by}&sortBy=${sortBy}&order=${order}` : null;
    const prevLink = prevPage ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&by=${by}&sortBy=${sortBy}&order=${order}` : null;

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Tags fetched successfully", {
        totalCount,
        totalPages,
        nextPage,
        prevPage,
        nextLink,
        prevLink,
        tagsAggregation
    });
})

exports.getConfiguration = catchAsyncError(async (req, res) => {
    try {
        const { configType, by } = req.query;

        if (!configType || !["interests", "reports", "education", "businessCategory", "areaOfExpertise"].includes(configType)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Invalid configuration type provided."
            );
        }

        const matchCondition = by ? {
            $or: [
                { [`${configType}.name`]: { $regex: by, $options: "i" } },
                { [`${configType}.description`]: { $regex: by, $options: "i" } },
            ],
        } : {};

        const configAggregation = await Configuration.aggregate([
            { $match: {} },
            { $unwind: `$${configType}` },
            { $match: matchCondition },
            { $sort: { [`${configType}.createdAt`]: -1 } },
            {
                $group: {
                    _id: null,
                    items: { $push: `$${configType}` },
                },
            },
            { $project: { _id: 0, items: 1 } },
        ]);

        if (!configAggregation || configAggregation.length === 0) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                `No ${configType} configuration found.`
            );
        }

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            `${configType} configuration fetched successfully.`,
            configAggregation[0].items
        );
    } catch (error) {
        console.error("Error fetching configuration:", error);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.ERROR,
            "Failed to fetch configuration."
        );
    }
});

exports.deleteUser = catchAsyncError(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Missing parameter: 'email' is required."
        );
    }

    try {
        const userDelete = await User.findOneAndDelete({ email: email });

        if (!userDelete) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                `User with email ${email} not found.`
            );
        }

        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            `User with email ${email} deleted successfully.`
        );
    } catch (error) {
        console.error("Error deleting user:", error);
        return response.responseHandlerWithError(
            res,
            false,
            statusCode.ERROR,
            "An error occurred while deleting the user."
        );
    }
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
        seenBy: { $ne: new mongoose.Types.ObjectId(userId) }
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


// exports.likeToggle = catchAsyncError(async (req, res) => {
//     const { postId, commentId, replyId, reviewId } = req.body;
//     const isLiked = req.body.toggleLike;
//     const userId = req.user.id;

//     let itemId;
//     let itemType;

//     if (postId) {
//         itemId = postId;
//         itemType = "Post";
//     } else if (commentId) {
//         itemId = commentId;
//         itemType = "Comment";
//     } else if (replyId) {
//         itemId = replyId;
//         itemType = "Reply";
//     } else if (reviewId) {
//         itemId = reviewId;
//         itemType = "Review";
//     } else {
//         return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Please provide a postId, commentId, or replyId to like.")
//     }

//     const existingLike = await Like.findOne({
//         itemId,
//         itemType,
//         userId
//     });

//     let message = "";

//     if (existingLike) {
//         if (isLiked) {
//             message = `You have already liked this ${itemType.toLowerCase()}.`;
//             return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, message)

//         } else {
//             await Like.findByIdAndDelete(existingLike._id);
//             message = `${itemType} unliked successfully!`;
//         }
//     } else {
//         if (isLiked) {
//             await Like.create({ itemId, itemType, userId, isLiked: true });
//             message = `${itemType} liked successfully!`;
//         } else {
//             message = `You have to like first before unlike this ${itemType.toLowerCase()}.`;
//             return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, message);
//         }
//     }

//     let itemModel;

//     switch (itemType) {
//         case "Post":
//             itemModel = Post;
//             break;
//         case "Comment":
//             itemModel = Comment;
//             break;
//         case "Reply":
//             itemModel = Reply;
//             break;
//         case "Review":
//             itemModel = Review;
//             break;
//         default:
//             return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Invalid item type.");
//     }

//     const currentItem = await itemModel.findById(itemId).select('likeCount');

//     if (!currentItem) {
//         return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, `${itemType} not found.`);
//     }

//     let newLikeCount = currentItem.likeCount + (isLiked ? 1 : -1);

//     if (newLikeCount < 0) {
//         newLikeCount = 0;
//     }

//     await itemModel.findByIdAndUpdate(itemId, { likeCount: newLikeCount }, { new: true });

//     return response.responseHandlerWithData(res, true, statusCode.SUCCESS, message, { itemType, likeCount: newLikeCount });
// });