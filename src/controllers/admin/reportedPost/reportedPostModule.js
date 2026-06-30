const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
let Report = require("../../../models/report")
let Post = require("../../../models/post")
let Like = require("../../../models/like")
let Comment = require("../../../models/comment")
let Reply = require("../../../models/reply")
let mongoose = require("mongoose");


exports.getAllReportedPosts = catchAsyncError(async (req, res) => {
    const {
        limit = 10,
        pageNo = 1,
        sortBy = "createdAt",
        order = "desc",
        communityId,
        postType = "all",
    } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);
    const sortOrder = order === "asc" ? 1 : -1;

    const userId = req.query.userId;

    let matchStage = {};

    if (userId) {
        matchStage.postByUserId = new mongoose.Types.ObjectId(userId);
    }

    if (communityId) {
        matchStage.reportToCommunityPost = new mongoose.Types.ObjectId(communityId);
    }

    if (postType === "all") {
        matchStage.reportType = { $in: ["individualPost", "communityPost"] };
    } else if (postType === "individualPost") {
        matchStage.reportType = "individualPost";
    } else if (postType === "communityPost") {
        matchStage.reportType = "communityPost";
    }

    // const reportPostsAggregation = await Report.aggregate([
    //     { $match: matchStage }, 
    //     {
    //         $lookup: {
    //             from: "posts",
    //             localField: "postId",
    //             foreignField: "_id",
    //             as: "reportedToPost",
    //         },
    //     },
    //     {
    //         $unwind: {
    //             path: "$reportedToPost",
    //             preserveNullAndEmptyArrays: true,
    //         },
    //     },

    //     {
    //         $lookup: {
    //             from: "users",
    //             localField: "postByUserId",
    //             foreignField: "_id",
    //             as: "postCreator",
    //             pipeline: [
    //                 {
    //                     $lookup: {
    //                         from: "friends",
    //                         localField: "_id",
    //                         foreignField: "userId",
    //                         as: "followers",
    //                     }
    //                 },
    //                 { $addFields: { numberOfFollowers: { $size: "$followers" } } },
    //                 {
    //                     $project: {
    //                         username: 1,
    //                         name: 1,
    //                         businessName: 1,
    //                         phoneNumber: 1,
    //                         email: 1,
    //                         profileImage: 1,
    //                         location: 1,
    //                         numberOfFollowers: 1,
    //                     },
    //                 },
    //             ],
    //         },
    //     },
    //     {
    //         $unwind: {
    //             path: "$postCreator",
    //             preserveNullAndEmptyArrays: true,
    //         },
    //     },

    //     { $sort: { [sortBy]: sortOrder } },
    //     { $skip: offset },
    //     { $limit: pageLimit },
    // ]);

    // const totalCountAggregation = await Report.aggregate([
    //     { $match: matchStage },
    //     { $count: "totalCount" },
    // ]);


    const reportPostsAggregation = await Report.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: "$postId", // Group by postId
                latestReport: { $first: "$$ROOT" }, // Keep the first report in the group
            },
        },
        {
            $replaceRoot: { newRoot: "$latestReport" }, // Replace root with the latest report
        },
        {
            $lookup: {
                from: "posts",
                localField: "postId",
                foreignField: "_id",
                as: "reportedToPost",
            },
        },
        {
            $unwind: {
                path: "$reportedToPost",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "postByUserId",
                foreignField: "_id",
                as: "postCreator",
                pipeline: [
                    {
                        $lookup: {
                            from: "friends",
                            localField: "_id",
                            foreignField: "userId",
                            as: "followers",
                        },
                    },
                    { $addFields: { numberOfFollowers: { $size: "$followers" } } },
                    {
                        $project: {
                            username: 1,
                            name: 1,
                            businessName: 1,
                            phoneNumber: 1,
                            email: 1,
                            profileImage: 1,
                            location: 1,
                            numberOfFollowers: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$postCreator",
                preserveNullAndEmptyArrays: true,
            },
        },
        { $sort: { [sortBy]: sortOrder } },
        { $skip: offset },
        { $limit: pageLimit },
    ]);

    const totalCountAggregation = await Report.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: "$postId", // Group by postId to count unique posts
            },
        },
        { $count: "totalCount" },
    ]);

    const totalCount = totalCountAggregation[0]?.totalCount || 0;
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
        totalPosts: totalCount,
        totalPostsInPage: reportPostsAggregation.length,
        currentPage: page,
        totalPages: totalPages,
        nextPage: nextPage,
        prevPage: prevPage,
        nextLink: nextLink,
        prevLink: prevLink,
        reportedPosts: reportPostsAggregation.map((post) => ({
            postId: post.postId,
            reportedToPost: post.reportedToPost,
            postByUserId: post.postByUserId,
            postCreator: post.postCreator || null, // Ensure postCreator is always included, even if null
            totalFollowers: post.postCreator.numberOfFollowers
        })),
    });
});


exports.deletePost = catchAsyncError(async (req, res) => {
    const { postId } = req.query;

    if (!postId) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "Post ID is required.");
    }

    const deletedPost = await Post.findByIdAndDelete(postId);

    if (!deletedPost) {
        return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, "Couldn't delete post.");
    }

    const comments = await Comment.find({ postId });

    for (const comment of comments) {
        const replies = await Reply.find({ commentId: comment._id });

        for (const reply of replies) {
            await Like.deleteMany({ itemId: reply._id, itemType: 'Reply' });
            console.log(`Deleted likes for reply: ${reply._id}`);
        }

        await Reply.deleteMany({ commentId: comment._id });
        console.log(`Deleted replies for comment: ${comment._id}`);

        await Like.deleteMany({ itemId: comment._id, itemType: 'Comment' });
        console.log(`Deleted likes for comment: ${comment._id}`);

        await Comment.findByIdAndDelete(comment._id);
        console.log(`Deleted comment: ${comment._id}`);
    }

    await Like.deleteMany({ itemId: postId, itemType: 'Post' });
    console.log(`Deleted likes for post: ${postId}`);

    await Report.deleteMany({ postId: postId });

    return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, "Post and associated data deleted successfully.");
});

exports.getReportedBy = catchAsyncError(async (req, res) => {
    const postId = req.params.postId;

    if (!postId) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Post ID is required.");
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

    const reportPostsAggregation = await Report.aggregate([
        {
            $match: {
                postId: new mongoose.Types.ObjectId(postId)
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
                            description: "$reports.description"
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
        postId,
    },
    {
        $set: {
            reportSeen: true
        }
    })

    const totalCount = await Report.countDocuments({ postId }) || 0;
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
        totalPosts: totalCount,
        totalPostsInPage: reportPostsAggregation.length,
        currentPage: page,
        totalPages: totalPages,
        nextPage: nextPage,
        prevPage: prevPage,
        nextLink: nextLink,
        prevLink: prevLink,
        reportedPosts: reportPostsAggregation
    });
});