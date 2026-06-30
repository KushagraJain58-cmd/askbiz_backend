let User = require('../../../models/users');
let { catchAsyncError } = require('../../../../utils/constants/generateError')
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes');
let Review = require('../../../models/review');
let { sendOneToOneNotification } = require("../../../../utils/helpers/notificationUtils")
let mongoose = require('mongoose');



exports.writeReview = catchAsyncError(async (req, res) => {

    const { reviewTo, reviewContent } = req.body;

    if (!reviewTo && !reviewContent) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Review content and review to user are required.")
    }

    const reviewBy = req.user.id;

    const reviewToUser = await User.findById(reviewTo).select('accountType').lean();

    if (!reviewToUser) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Review to user not found")
    }

    if (reviewToUser.accountType == "Individual") {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Individual user have no options to take review.")
    }

    const reviewDetails = {
        reviewBy,
        reviewTo,
        reviewContent
    }

    const addReview = new Review(reviewDetails);
    await addReview.save();

    await sendOneToOneNotification(
    req.user.id,
    reviewTo,
    "Review",
    `${ req.user.data.name || req.user.data.businessName || "Unknown User"} wrote a review on your profile!`,
    {
        senderName: req.user.data.name || req.user.data.businessName,
        type : "review"
    }
);

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Review added successfully", addReview);

})


exports.getAllReviewsOfUser = catchAsyncError(async (req, res) => {
    const viewerId = req.query.userId ||  req.user.id ; 
    const {
        limit = 10,
        pageNo = 1,
        sortBy = "createdAt",
        order = "desc"
    } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const skip = (page - 1) * pageLimit;
    const sortOrder = order === "asc" ? 1 : -1;

    // Aggregation pipeline
    const reviewsAggregate = await Review.aggregate([
        { $match: { reviewTo: new mongoose.Types.ObjectId(viewerId) } },
        { $sort: { [sortBy]: sortOrder } },
        { $skip: skip },
        { $limit: pageLimit },
        {
            $lookup: {
                from: 'users',
                localField: 'reviewTo',
                foreignField: '_id',
                as: 'reviewToDetails'
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'reviewBy',
                foreignField: '_id',
                as: 'reviewByDetails'
            }
        },
        {
            $lookup: {
                from: 'replies',
                localField: '_id',
                foreignField: 'reviewId',
                as: 'replies'
            }
        },
        {
            $lookup: {
                from: 'likes',
                let: { reviewId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $and: [{ $eq: ["$itemId", "$$reviewId"] }, { $eq: ["$itemType", "Review"] }, { $eq: ["$userId", new mongoose.Types.ObjectId(viewerId)] }] } } },
                ],
                as: 'userLikeInfo'
            }
        },
        {
            $addFields: {
                reviewTo: { $arrayElemAt: ["$reviewToDetails", 0] },
                reviewBy: { $arrayElemAt: ["$reviewByDetails", 0] },
                replyCount: { $size: "$replies" },
                isLiked: { $gt: [{ $size: "$userLikeInfo" }, 0] },
            }
        },
        {
            $project: {
                'reviewToDetails.name': 1,
                'reviewToDetails.businessName': 1,
                'reviewToDetails.username': 1,
                'reviewToDetails.profileImage': 1,
                'reviewToDetails.accountType': 1,
                'reviewToDetails.shortBio': 1,
                'reviewToDetails.occupationTitle': 1,
                'reviewToDetails.occupationSector': 1,
                'reviewToDetails.workExperience': 1,
                'reviewToDetails.description': 1,
                'reviewToDetails.companyName': 1,
                'reviewToDetails.expertise': 1,
                'reviewToDetails.blueTick': 1,

                'reviewByDetails.name': 1,
                'reviewByDetails.businessName': 1,
                'reviewByDetails.username': 1,
                'reviewByDetails.profileImage': 1,
                'reviewByDetails.accountType': 1,
                'reviewByDetails.shortBio': 1,
                'reviewByDetails.occupationTitle': 1,
                'reviewByDetails.occupationSector': 1,
                'reviewByDetails.workExperience': 1,
                'reviewByDetails.description': 1,
                'reviewByDetails.companyName': 1,
                'reviewByDetails.expertise': 1,
                'reviewByDetails.blueTick': 1,
                reviewContent: 1,
                status: 1,
                likeCount: 1,
                createdAt: 1,
                updatedAt: 1,
                replyCount: 1,
                isLiked: 1
            }
        }
    ]);

    const totalCount = await Review.countDocuments({ reviewTo: viewerId });
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

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Reviews fetched successfully", {
        reviews: reviewsAggregate,
        totalReviews: totalCount,
        totalPages,
        currentPage: page,
        nextPage,
        prevPage,
        nextLink,
        prevLink,
    });
});