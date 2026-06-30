let Post = require('../../../models/post');
let Comment = require('../../../models/comment');
let Reply = require('../../../models/reply');
let Like = require('../../../models/like');
let User = require('../../../models/users');
let { catchAsyncError } = require('../../../../utils/constants/generateError');
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes')
let mongoose = require('mongoose');
const Review = require('../../../models/review');
const Interaction = require('../../../models/interaction');
const { sendOneToOneNotification, sendUserBulkNotifications } = require("../../../../utils/helpers/notificationUtils")

exports.addComment = catchAsyncError(async (req, res) => {

    const { postId } = req.params;

    const { fileURL, content, mentionPeople } = req.body;

    const post = await Post.findById(postId).lean();

    if (!post) {
        return response.responseHandlerWithError(res, false, statusCode.FORBIDDEN, "Post not found")
    }

    if (post.turnOffCommenting === true) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Comments are turned off for this post.")
    }

    const newComment = {
        postId: postId,
        userId: req.user.id,
        fileURL,
        content,
        mentionPeople
    }

    const comment = new Comment(newComment);

    await comment.save();

    await Interaction.create({
        type: "comment",
        postId: postId,
        userId: req.user.id
    })

    const senderName = req.user.data.name || req.user.data.businessName || "Someone";

    if (req.user.id !== String(post.userId)) {
        await sendOneToOneNotification(
            req.user.id,
            post.userId,
            "New Comment",
            `${senderName} commented on your post!`,
            {
                senderName,
                type: "comment"
            }
        );
    }

    if (mentionPeople && Array.isArray(mentionPeople) && mentionPeople.length > 0) {

        await sendUserBulkNotifications(req.user.id, mentionPeople, "You were mentioned", `${senderName} mentioned you in a comment.`, {
            senderName,
            type: "mention"
        })
    }

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Comment added successfully", newComment);

})

// exports.addReply = catchAsyncError(async (req, res) => {
//     const { commentId, reviewId } = req.query;

//     if (!commentId && !reviewId) {
//         return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, "Comment Id or reviewId is required.");
//     }

//     let parentEntity;

//     if (commentId) {
//         parentEntity = await Comment.findById(commentId);
//         if (!parentEntity) {
//             return response.responseHandlerWithError(res, false, statusCode.FORBIDDEN, "Comment not found");
//         }
//     } else if (reviewId) {
//         parentEntity = await Review.findById(reviewId);
//         if (!parentEntity) {
//             return response.responseHandlerWithError(res, false, statusCode.FORBIDDEN, "Review not found");
//         }
//     }

//     const { fileURL, content, mentionPeople } = req.body;

//     const newReply = {
//         commentId: commentId || null,
//         reviewId: reviewId || null,
//         userId: req.user.id,
//         fileURL,
//         content,
//         mentionPeople
//     };

//     const reply = new Reply(newReply);
//     await reply.save();

//     const postCreatorNotiMessage = `${req.user.data.name || req.user.data.businesssName} replied on ${comment}`
//     const commentCreatorNotiMessage = `${req.user.data.name || req.user.data.businesssName} replied on your comment.`

//     await sendOneToOneNotification(
//         req.user.id,
//         comment.userId,
//         "Reply",
//         `${ req.user.data.name || req.user.data.businessName || "Unknown User"} commented on your post!`,
//         {
//             senderName: req.user.data.name || req.user.data.businessName
//         }
//     );

//     await sendOneToOneNotification(
//         req.user.id,
//         post.userId,
//         "Reply",
//         `${ req.user.data.name || req.user.data.businessName || "Unknown User"} commented on your post!`,
//         {
//             senderName: req.user.data.name || req.user.data.businessName
//         }
//     );

//     return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Reply added successfully.", reply);
// });

exports.addReply = catchAsyncError(async (req, res) => {
    const { commentId, reviewId } = req.query;

    if (!commentId && !reviewId) {
        return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, "Comment Id or reviewId is required.");
    }

    let parentEntity;
    let parentType;

    if (commentId) {
        parentEntity = await Comment.findById(commentId).lean();
        if (!parentEntity) {
            return response.responseHandlerWithError(res, false, statusCode.FORBIDDEN, "Comment not found");
        }
        parentType = 'comment';
    } else if (reviewId) {
        parentEntity = await Review.findById(reviewId).lean();
        if (!parentEntity) {
            return response.responseHandlerWithError(res, false, statusCode.FORBIDDEN, "Review not found");
        }
        parentType = 'review';
    }

    const { fileURL, content, mentionPeople } = req.body;

    const newReply = {
        commentId: commentId || null,
        reviewId: reviewId || null,
        userId: req.user.id,
        fileURL,
        content,
        mentionPeople
    };

    const reply = new Reply(newReply);
    await reply.save();

    const senderName = req.user.data.name || req.user.data.businessName || "Someone";
    const notiMessage = `${senderName} replied to your ${parentType}.`;

    await sendOneToOneNotification(
        req.user.id,
        parentEntity.userId.toString(),
        "Reply",
        notiMessage,
        {
            senderName,
            type : "reply"
        }
    );

    if (commentId && parentEntity.postId) {
        const post = await Post.findById(parentEntity.postId).lean();
        if (post && post.userId.toString() !== parentEntity.userId.toString()) {
            const postOwnerNotiMessage = `${senderName} replied to a comment on your post.`;
            await sendOneToOneNotification(
                req.user.id,
                post.userId.toString(),
                "Reply",
                postOwnerNotiMessage,
                { senderName, type : "reply" }
            );
        }
    }

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Reply added successfully.", reply);
});

exports.getCommentsByPostId = catchAsyncError(async (req, res) => {
    const { postId } = req.query;
    const userId = req.user.id;

    const user = await User.findById(userId).select(["interest", "hiddenPosts", "blockedUsers", "location"]);

    const userBlockedUsers = user.blockedUsers;

    const blockedUsersByAdmin = await User.find({ status: "blocked" }).lean().select(["_id", "status"])

    const blockedUsersByAdminIds = blockedUsersByAdmin.map(b => b._id);


    const commentsWithRepliesAndLikes = await Comment.aggregate([
        {
            $match: {
                postId: new mongoose.Types.ObjectId(postId),
                userId: { $nin: [...userBlockedUsers, ...blockedUsersByAdminIds] }
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userDetails'
            }
        },
        { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                let: { mentionPeopleIds: "$mentionPeople" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $in: ["$_id", "$$mentionPeopleIds"] }
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
                            blueTick: 1
                        }
                    }
                ],
                as: "mentionPeopleDetails"
            }
        },
        {
            $lookup: {
                from: 'replies', // Reply collection
                let: { commentId: '$_id' }, // Pass the current comment's _id to the lookup
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$commentId', '$$commentId'] }, // Match replies for the current comment
                                    { $not: { $in: ['$userId', userBlockedUsers] } } // Exclude replies from blocked users
                                ]
                            }
                        }
                    }
                ],
                as: 'replies'
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'replies.userId',
                foreignField: '_id',
                as: 'replyUserDetails'
            }
        },

        {
            $lookup: {
                from: 'users',
                localField: 'replies.mentionPeople',
                foreignField: '_id',
                as: 'replyMentionPersonDetails'
            }
        },
        {
            $lookup: {
                from: 'likes',
                let: { commentId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$itemId', '$$commentId'] },
                                    { $eq: ['$itemType', 'Comment'] },
                                    { $eq: ['$userId', new mongoose.Types.ObjectId(userId)] }
                                ]
                            }
                        }
                    },
                    { $project: { _id: 0, isLiked: 1 } }
                ],
                as: 'commentLikes'
            }
        },

        {
            $addFields: {
                isLiked: { $cond: [{ $gt: [{ $size: '$commentLikes' }, 0] }, true, false] }
            }
        },
        {
            $lookup: {
                from: 'likes',
                let: { replyIds: '$replies._id' }, // references replies' _id
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $in: ['$itemId', '$$replyIds'] }, // Match likes where itemId is a reply's _id
                                    { $eq: ['$itemType', 'Reply'] }, // Ensure it's a like for a reply
                                    { $eq: ['$userId', new mongoose.Types.ObjectId(userId)] } // Match the logged-in user
                                ]
                            }
                        }
                    },
                    {
                        $project: { _id: 1, itemId: 1, userId: 1, isLiked: 1 } // Ensure we include itemId for matching with replies
                    }
                ],
                as: 'replyLikes'
            }
        },
        {
            $addFields: {
                replies: {
                    $map: {
                        input: { $ifNull: ['$replies', []] },
                        as: 'reply',
                        in: {
                            $mergeObjects: [
                                '$$reply',
                                {
                                    userDetails: {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: '$replyUserDetails',
                                                    as: 'user',
                                                    cond: { $eq: ['$$user._id', '$$reply.userId'] }
                                                }
                                            },
                                            0
                                        ]
                                    },
                                    mentionPersonDetails: {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: '$replyMentionPersonDetails',
                                                    as: 'mention',
                                                    cond: { $eq: ['$$mention._id', '$$reply.mentionPerson'] }
                                                }
                                            },
                                            0
                                        ]
                                    },
                                    isLiked: {
                                        $cond: [
                                            {
                                                $gt: [
                                                    {
                                                        $size: {
                                                            $filter: {
                                                                input: '$replyLikes',
                                                                as: 'like',
                                                                cond: { $eq: ['$$like.itemId', '$$reply._id'] } // Match the reply _id to the like's itemId
                                                            }
                                                        }
                                                    },
                                                    0
                                                ]
                                            },
                                            true,
                                            false
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        },
        {
            $project: {
                postId: 1,
                content: 1,
                fileURL: 1,
                likeCount: 1,
                createdAt: 1,
                updatedAt: 1,
                isLiked: 1,
                'userDetails._id': 1,
                'userDetails.name': 1,
                'userDetails.businessName': 1,
                'userDetails.username': 1,
                'userDetails.profileImage': 1,
                'userDetails.accountType': 1,
                'userDetails.shortBio': 1,
                'userDetails.occupationTitle': 1,
                'userDetails.occupationSector': 1,
                'userDetails.workExperience': 1,
                'userDetails.description': 1,
                'userDetails.companyName': 1,
                'userDetails.expertise': 1,
                'userDetails.blueTick': 1,
                'mentionPeopleDetails._id': 1,
                'mentionPeopleDetails.name': 1,
                'mentionPeopleDetails.businessName': 1,
                'mentionPeopleDetails.username': 1,
                'mentionPeopleDetails.profileImage': 1,
                'mentionPeopleDetails.accountType': 1,
                'mentionPeopleDetails.shortBio': 1,
                'mentionPeopleDetails.occupationTitle': 1,
                'mentionPeopleDetails.occupationSector': 1,
                'mentionPeopleDetails.workExperience': 1,
                'mentionPeopleDetails.description': 1,
                'mentionPeopleDetails.companyName': 1,
                'mentionPeopleDetails.expertise': 1,
                'mentionPeopleDetails.blueTick': 1,

                // Project necessary fields for enriched replies
                'replies._id': 1,
                'replies.commentId': 1,
                'replies.content': 1,
                'replies.fileURL': 1,
                'replies.likeCount': 1,
                'replies.createdAt': 1,
                'replies.updatedAt': 1,
                'replies.userDetails._id': 1,
                'replies.userDetails.name': 1,
                'replies.userDetails.businessName': 1,
                'replies.userDetails.username': 1,
                'replies.userDetails.profileImage': 1,
                'replies.userDetails.accountType': 1,
                'replies.userDetails.shortBio': 1,
                'replies.userDetails.occupationTitle': 1,
                'replies.userDetails.occupationSector': 1,
                'replies.userDetails.workExperience': 1,
                'replies.userDetails.description': 1,
                'replies.userDetails.companyName': 1,
                'replies.userDetails.expertise': 1,
                'replies.userDetails.blueTick': 1,
                'replies.mentionPeopleDetails._id': 1,
                'replies.mentionPeopleDetails.name': 1,
                'replies.mentionPeopleDetails.businessName': 1,
                'replies.mentionPeopleDetails.username': 1,
                'replies.mentionPeopleDetails.profileImage': 1,
                'replies.mentionPeopleDetails.accountType': 1,
                'replies.mentionPeopleDetails.shortBio': 1,
                'replies.mentionPeopleDetails.occupationTitle': 1,
                'replies.mentionPeopleDetails.occupationSector': 1,
                'replies.mentionPeopleDetails.workExperience': 1,
                'replies.mentionPeopleDetails.description': 1,
                'replies.mentionPeopleDetails.companyName': 1,
                'replies.mentionPeopleDetails.expertise': 1,
                'replies.mentionPeopleDetails.blueTick': 1,
                'replies.isLiked': 1
            }
        },

        // Add totalReplies count
        {
            $addFields: {
                totalReplies: { $size: '$replies' }
            }
        }
    ]);

    if (!commentsWithRepliesAndLikes || commentsWithRepliesAndLikes.length === 0) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.SUCCESS,
            'Comments not found for this post.'
        );
    }

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        'Comments, replies, and likes fetched successfully',
        commentsWithRepliesAndLikes
    );
});

exports.getUserCommentsAndReplies = catchAsyncError(async (req, res) => {

    const profileUserId = req.query.userId || req.user.id;

    const userId = req.query.userId

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

    // Fetch comments made by the user
    const commentsAggregation = await Comment.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(profileUserId) } },
        { $sort: { [sortBy]: sortOrder } },
        { $skip: offset },
        { $limit: pageLimit },
        {
            $lookup: {
                from: "posts",
                localField: "postId",
                foreignField: "_id",
                as: "postDetails",
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "userId", // user who made the comment
                foreignField: "_id",
                as: "userDetails",  // This will give the user who created the comment/reply
            },
        },
        {
            $lookup: {
                from: "replies",
                localField: "_id",
                foreignField: "commentId",
                as: "replies",
                pipeline : [
                    {
                        $match: {
                            userId: new mongoose.Types.ObjectId(profileUserId),
                        }
                    }
                ]
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "postDetails.userId",  // The user who created the post
                foreignField: "_id",
                as: "postCreator",  // This will give the user who created the post
            },
        },
        {
            $lookup: {
                from: "likes",
                let: { postId: "$postDetails._id", userId: new mongoose.Types.ObjectId(userId) },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$itemId", "$$postId"] },
                                    { $eq: ["$itemType", "Post"] },
                                    { $eq: ["$userId", "$$userId"] }
                                ]
                            }
                        }
                    }
                ],
                as: "userPostLikeInfo"
            }
        },
        {
            $lookup: {
                from: "likes",
                let: { commentId: "$_id", userId: new mongoose.Types.ObjectId(userId) },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$itemId", "$$commentId"] },
                                    { $eq: ["$itemType", "Comment"] },
                                    { $eq: ["$userId", "$$userId"] }
                                ]
                            }
                        }
                    }
                ],
                as: "userCommentLikeInfo"
            }
        },
        {
            $addFields: {
                'postDetails.isPostLiked': { $gt: [{ $size: "$userPostLikeInfo" }, 0] },
                isCommentLiked: { $gt: [{ $size: "$userCommentLikeInfo" }, 0] }
            }
        },
        {
            $lookup: {
                from: "comments", // This lookup is to count comments for the post
                localField: "postDetails._id",
                foreignField: "postId",
                as: "commentsCount",
            }
        },
        {
            $lookup: {
                from: "replies",
                localField: "commentsCount._id",
                foreignField: "commentId",
                as: "commentReplies",
            },
        },
        {
            $addFields: {
                'postDetails.totalComments': {
                    $sum: [
                        { $size: "$commentsCount" },
                        { $size: "$commentReplies" },
                    ],
                },  
            }
        },
        {
            $project: {
                _id: 1,
                content: 1,
                fileURL: 1,
                likeCount: 1,
                createdAt: 1,
                updatedAt: 1,
                postDetails: { $arrayElemAt: ["$postDetails", 0] },
                isCommentLiked: 1,
                'userDetails.name': 1,
                'userDetails.email': 1,
                'userDetails.businessName': 1,
                'userDetails.username': 1,
                'userDetails.profileImage': 1,
                'userDetails.accountType': 1,
                'userDetails.shortBio': 1,
                'userDetails.occupationTitle': 1,
                'userDetails.occupationSector': 1,
                'userDetails.workExperience': 1,
                'userDetails.description': 1,
                'userDetails.companyName': 1,
                'userDetails.expertise': 1,
                'userDetails.blueTick': 1,
                replies: 1,
                'postCreator.name': 1,
                'postCreator.email': 1,
                'postCreator.businessName': 1,
                'postCreator.username': 1,
                'postCreator.profileImage': 1,
                'postCreator.accountType': 1,
                'postCreator.shortBio': 1,
                'postCreator.occupationTitle': 1,
                'postCreator.occupationSector': 1,
                'postCreator.workExperience': 1,
                'postCreator.description': 1,
                'postCreator.companyName': 1,
                'postCreator.expertise': 1,
                'postCreator.blueTick': 1,
                itemType: "Comment",  // Add a field to differentiate between comments and replies
            },
        },
    ]);

    // Fetch replies made by the user
    const repliesAggregation = await Reply.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(profileUserId) } },
        { $sort: { [sortBy]: sortOrder } },
        { $skip: offset },
        { $limit: pageLimit },
        {
            $lookup: {
                from: "comments",
                localField: "commentId",
                foreignField: "_id",
                as: "commentDetails",
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "commentDetails.userId",
                foreignField: "_id",
                as: "commentCeator",
                pipeline: [
                    {
                        $project: {
                            name: 1,
                            email: 1,
                            businessName: 1,
                            username: 1,
                            profileImage: 1,
                            accountType: 1,
                            blueTick: 1,
                            shortBio: 1,
                            occupationTitle: 1,
                            occupationSector: 1,
                            workExperience: 1,
                            description: 1,
                        }
                    }
                ]
            },   
        },
        {
            $lookup: {
                from: "posts",
                localField: "commentDetails.postId",
                foreignField: "_id",
                as: "postDetails",
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "userId", // user who created the comment
                foreignField: "_id",
                as: "userDetails", // This will give the user who created the comment/reply
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "postDetails.userId",
                foreignField: "_id",
                as: "postCreator",
            },
        },
        {
            $lookup: {
                from: "comments", // This lookup is to count comments for the post
                localField: "postDetails._id",
                foreignField: "postId",
                as: "commentsCount",
            }
        },
        {
            $lookup: {
                from: "replies",
                localField: "commentsCount._id",
                foreignField: "commentId",
                as: "commentReplies",
            },
        },
        {
            $addFields: {
                'postDetails.totalComments': {
                    $sum: [
                        { $size: "$commentsCount" },
                        { $size: "$commentReplies" },
                    ],
                },  
            }
        },
        {
            $project: {
                _id: 1,
                content: 1,
                likeCount: 1,
                createdAt: 1,
                updatedAt: 1,
                commentDetails: { $arrayElemAt: ["$commentDetails", 0] },
                postDetails: { $arrayElemAt: ["$postDetails", 0] },
                'userDetails.name': 1,
                'userDetails.email': 1,
                'userDetails.businessName': 1,
                'userDetails.username': 1,
                'userDetails.profileImage': 1,
                'userDetails.accountType': 1,
                'userDetails.shortBio': 1,
                'userDetails.occupationTitle': 1,
                'userDetails.occupationSector': 1,
                'userDetails.workExperience': 1,
                'userDetails.description': 1,
                'userDetails.companyName': 1,
                'userDetails.expertise': 1,
                'userDetails.blueTick': 1,
                'postCreator.name': 1,
                'postCreator.email': 1,
                'postCreator.businessName': 1,
                'postCreator.username': 1,
                'postCreator.profileImage': 1,
                'postCreator.accountType': 1,
                'postCreator.shortBio': 1,
                'postCreator.occupationTitle': 1,
                'postCreator.occupationSector': 1,
                'postCreator.workExperience': 1,
                'postCreator.description': 1,
                'postCreator.companyName': 1,
                'postCreator.expertise': 1,
                'postCreator.blueTick': 1,
                commentCeator : 1,
                itemType: "Reply",  // Add a field to differentiate between comments and replies
            },
        },
    ]);

    const combinedData = [...commentsAggregation, ...repliesAggregation];

    combinedData.sort((a, b) => {
        return sortOrder * (new Date(a.createdAt) - new Date(b.createdAt));
    });

    const paginatedData = combinedData.slice(offset, offset + pageLimit);

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "User comments and replies fetched and sorted successfully", {
        totalItems: commentsAggregation.length,
        totalItemsInPage: paginatedData.length,
        currentPage: page,
        combinedData: paginatedData,
    });
});

// exports.getUserCommentsAndReplies = catchAsyncError(async (req, res) => {
//     const profileUserId = req.query.userId || req.user.id;
//     const userId = req.query.userId;

//     const {
//         limit = 10,
//         pageNo = 1,
//         sortBy = "createdAt",
//         order = "desc",
//     } = req.query;

//     const pageLimit = parseInt(limit, 10);
//     const page = parseInt(pageNo, 10);
//     const offset = pageLimit * (page - 1);
//     const sortOrder = order === "asc" ? 1 : -1;

//     // Fetch posts along with comments and replies made by the user
//     const postsAggregation = await Post.aggregate([
//         { $sort: { [sortBy]: sortOrder } },
//         { $skip: offset },
//         { $limit: pageLimit },
//         {
//             $lookup: {
//                 from: "comments",
//                 localField: "_id",
//                 foreignField: "postId",
//                 as: "comments",
//                 pipeline: [
//                     {
//                         $match: {
//                             userId: new mongoose.Types.ObjectId(profileUserId), // Match comments by the user
//                         },
//                     },
//                     {
//                         $lookup: {
//                             from: "users",
//                             localField: "userId",
//                             foreignField: "_id",
//                             as: "userDetails",
//                         },
//                     },
//                     {
//                         $lookup: {
//                             from: "likes",
//                             let: { commentId: "$_id", userId: new mongoose.Types.ObjectId(userId) },
//                             pipeline: [
//                                 {
//                                     $match: {
//                                         $expr: {
//                                             $and: [
//                                                 { $eq: ["$itemId", "$$commentId"] },
//                                                 { $eq: ["$itemType", "Comment"] },
//                                                 { $eq: ["$userId", "$$userId"] }
//                                             ]
//                                         }
//                                     }
//                                 }
//                             ],
//                             as: "userCommentLikeInfo"
//                         }
//                     },
//                     {
//                         $addFields: {
//                             isCommentLiked: { $gt: [{ $size: "$userCommentLikeInfo" }, 0] }
//                         }
//                     },
//                     {
//                         $lookup: {
//                             from: "replies",
//                             localField: "_id",
//                             foreignField: "commentId",
//                             as: "replies",
//                             pipeline: [
//                                 {
//                                     $match: {
//                                         userId: new mongoose.Types.ObjectId(profileUserId),
//                                     },
//                                 },
//                             ],
//                         },
//                     },
//                 ],
//             },
//         },
//         {
//             $lookup: {
//                 from: "users",
//                 localField: "userId",
//                 foreignField: "_id",
//                 as: "postCreator",
//             },
//         },
//         {
//             $lookup: {
//                 from: "likes",
//                 let: { postId: "$_id", userId: new mongoose.Types.ObjectId(userId) },
//                 pipeline: [
//                     {
//                         $match: {
//                             $expr: {
//                                 $and: [
//                                     { $eq: ["$itemId", "$$postId"] },
//                                     { $eq: ["$itemType", "Post"] },
//                                     { $eq: ["$userId", "$$userId"] }
//                                 ]
//                             }
//                         }
//                     }
//                 ],
//                 as: "userPostLikeInfo"
//             }
//         },
//         {
//             $lookup: {
//                 from: "bookmarks",
//                 let: { postId: "$_id", userId: new mongoose.Types.ObjectId(userId) },
//                 pipeline: [
//                     {
//                         $match: {
//                             $expr: {
//                                 $and: [
//                                     { $eq: ["$itemId", "$$postId"] },
//                                     { $eq: ["$itemType", "Post"] },
//                                     { $eq: ["$userId", "$$userId"] }
//                                 ]
//                             }
//                         }
//                     }
//                 ],
//                 as: "userPostBookmarkInfo"
//             }
//         },
//         {
//             $lookup: {
//                 from: "follows",
//                 let: { userId: new mongoose.Types.ObjectId(userId), postOwnerId: "$userId" },
//                 pipeline: [
//                     {
//                         $match: {
//                             $expr: {
//                                 $and: [
//                                     { $eq: ["$followerId", "$$userId"] },
//                                     { $eq: ["$followingId", "$$postOwnerId"] }
//                                 ]
//                             }
//                         }
//                     }
//                 ],
//                 as: "userFollowInfo"
//             }
//         },
//         {
//             $addFields: {
//                 isPostLiked: { $gt: [{ $size: "$userPostLikeInfo" }, 0] },
//                 isPostBookmarked: { $gt: [{ $size: "$userPostBookmarkInfo" }, 0] },
//                 isFollowed: { $gt: [{ $size: "$userFollowInfo" }, 0] },
//             },
//         },
//         {
//             $project: {
//                 _id: 1,
//                 content: 1,
//                 likeCount: 1,
//                 createdAt: 1,
//                 updatedAt: 1,
//                 postCreator: { $arrayElemAt: ["$postCreator", 0] },
//                 isPostLiked: 1,
//                 isPostBookmarked: 1,
//                 isFollowed: 1,
//                 comments: 1,
//                 itemType: "Post",  // To differentiate between post, comment, and reply
//             },
//         },
//     ]);

//     // Flatten the result to include comments with the required info
//     const combinedData = postsAggregation.map(post => {
//         post.comments = post.comments.map(comment => ({
//             ...comment,
//             postDetails: post, // Attach the post details to each comment
//             itemType: "Comment",  // Mark itemType as comment
//         }));

//         // Flatten replies within comments
//         post.comments.forEach(comment => {
//             comment.replies = comment.replies.map(reply => ({
//                 ...reply,
//                 commentDetails: comment, // Attach comment details to each reply
//                 itemType: "Reply",  // Mark itemType as reply
//             }));
//         });

//         return post;
//     });

//     // Combine all comments and replies across posts
//     const allCommentsAndReplies = combinedData.flatMap(post => [
//         ...post.comments,
//         ...post.comments.flatMap(comment => comment.replies),
//     ]);

//     // Sort and paginate data
//     allCommentsAndReplies.sort((a, b) => {
//         return sortOrder * (new Date(a.createdAt) - new Date(b.createdAt));
//     });

//     const paginatedData = allCommentsAndReplies.slice(offset, offset + pageLimit);

//     return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "User comments and replies fetched and sorted successfully", {
//         totalItems: allCommentsAndReplies.length,
//         totalItemsInPage: paginatedData.length,
//         currentPage: page,
//         combinedData: paginatedData,
//     });
// });


exports.deleteCommentOrReply = catchAsyncError(async (req, res) => {
    const { deleteType, deleteTypeId } = req.body; // deleteType = "comment", "reply"
    const userId = req.user.id;

    if (!['comment', 'reply'].includes(deleteType)) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, `Invalid deleteType: ${deleteType}`);
    }

    let deletedItem;
    if (deleteType === 'comment') {

        deletedItem = await Comment.findOneAndDelete({ _id: deleteTypeId, userId });
        if (!deletedItem) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, 'Comment not found or unauthorized');
        }

        await Like.deleteMany({ itemId: deleteTypeId, itemType: 'Comment' });

        const replies = await Reply.find({ commentId: deleteTypeId });
        const replyIds = replies.map(reply => reply._id);
        await Reply.deleteMany({ commentId: deleteTypeId });
        await Like.deleteMany({ itemId: { $in: replyIds }, itemType: 'Reply' });

    } else if (deleteType === 'reply') {

        deletedItem = await Reply.findOneAndDelete({ _id: deleteTypeId, userId });
        if (!deletedItem) {
            return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, 'Reply not found or unauthorized');
        }

        await Like.deleteMany({ itemId: deleteTypeId, itemType: 'Reply' });
    }

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        `${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} deleted successfully.`
    );
});