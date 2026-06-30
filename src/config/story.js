const { catchAsyncError } = require("../../../utils/constant/generateError");
let response = require("../../../utils/constant/responseFunctions")
let statusCode = require("../../../utils/constant/responseCodes")
const Story = require("../../models/story");
const Comment = require("../../models/comment")
const User = require("../../models/user");
const mongoose = require("mongoose")


exports.uploadStory = catchAsyncError(async (req, res) => {
    const { fileUrl, textContent, type, mentionPeople, location, music } = req.body;
    const userId = req.user.id;

    if (!fileUrl || !type) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "File URL and Type are required to upload a story."
        );
    }

    if (!['image', 'video', 'text'].includes(type)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Invalid story type. Type must be one of 'image', 'video', or 'text'."
        );
    }

    if (!fileUrl || fileUrl.length === 0) {
        if (type !== 'text' || !textContent) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "For 'text' type stories, textContent is required, and fileURL should be empty."
            );
        }
    } else {
        if (!fileUrl.fileType || !['video', 'image'].includes(fileUrl.fileType)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Each file in fileURL must have a valid fileType ('video' or 'image')."
            );
        }
        // if (type === 'text') {
        //     return response.responseHandlerWithMessage(
        //         res,
        //         false,
        //         statusCode.DATAMISSING,
        //         "For 'text' type stories, fileURL must be empty."
        //     );
        // }
    }

    let locationData = null;
    if (location && location.longitude && location.latitude && location.cityName) {
        locationData = {
            type: 'Point',
            coordinates: [location.longitude, location.latitude],
            cityName: location.cityName,
        };
    }

    let musicData = null;
    if (music && music.title && music.artist && music.url) {
        musicData = {
            title: music.title,
            artist: music.artist,
            url: music.url,
        };
    }

    const newStory = await Story.create({
        userId,
        fileUrl,
        textContent,
        type,
        mentionPeople,
        location: locationData,
        music: musicData
    })

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.CREATED,
        "Story uploaded successfully.",
        newStory
    );
});



// exports.getAllStories = catchAsyncError(async (req, res) => {
//     const userId = req.user.id;
//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 10;
//     const skip = (page - 1) * limit;

//     const activeStories = await Story.aggregate([
//         {
//             $match: {
//                 status: 'active',
//                 expiryDate: { $gt: new Date() },
//             },
//         },
//         {
//             $lookup: {
//               from: "likes",
//               let: { storyId: "$_id" },
//               pipeline: [
//                 {
//                   $match: {
//                     $expr: {
//                       $and: [
//                         { $eq: ["$itemId", "$$storyId"] },
//                         { $eq: ["$itemType", "Story"] },
//                         { $eq: ["$userId", new mongoose.Types.ObjectId(userId)] }
//                       ]
//                     }
//                   }
//                 }
//               ],
//               as: "userLikeInfo"
//             }
//         },
//         {
//             $addFields: {
//                 isViewed: {
//                     $in: [new mongoose.Types.ObjectId(userId), '$views'],
//                 },
//                 isLiked: { $gt: [{ $size: "$userLikeInfo" }, 0] }
//             },
//         },
//         {
//             $lookup: {
//                 from: 'users',
//                 localField: 'userId',
//                 foreignField: '_id',
//                 as: 'userDetails',
//                 pipeline: [
//                     {
//                         $project: {
//                             _id: 1,
//                             name: 1,
//                             profileImage: 1,
//                         },
//                     },
//                 ],
//             },
//         },
//         {
//             $lookup: {
//                 from: 'users',
//                 localField: 'mentionPeople',
//                 foreignField: '_id',
//                 as: 'mentionedUsers',
//                 pipeline: [
//                     {
//                         $project: {
//                             _id: 1,
//                             name: 1,
//                             phoneNumber: 1,
//                             username: 1,
//                             gender: 1,
//                             status: 1,
//                             location: 1,
//                             profileImage: 1,
//                             coverImage: 1,
//                         },
//                     },
//                 ],
//             },
//         },
//         {
//             $unwind: '$userDetails',
//         },
//         {
//             $group: {
//                 _id: '$userId',
//                 profilePic: { $first: '$userDetails.profileImage' },
//                 name: { $first: '$userDetails.name' },
//                 stories: {
//                     $push: {
//                         _id: '$_id',
//                         createdAt: '$createdAt',
//                         isViewed: '$isViewed',
//                         isLiked : '$isLiked',
//                         mentionedUsers: "$mentionedUsers",
//                         fileUrl: "$fileUrl",
//                         textContent: "$textContent",
//                         views: '$views',
//                         location: '$location',
//                         music: '$music',
//                         likeCount: '$likeCount',
//                         commentCount : '$commentCount',
//                         flagCount : '$flagCount',
//                         status: '$status',
//                         expiryDate: '$expiryDate',
//                         createdAt: '$createdAt',
//                         updatedAt: '$updatedAt',
//                     },
//                 },
//             },
//         },
//         {
//             $sort: {
//                 'stories.createdAt': -1,
//             },
//         },
//         { $skip: skip },
//         { $limit: limit },
//     ]);

//     const loggedInUserHasStory = activeStories.some(story => story._id.toString() === userId.toString());

//      if (!loggedInUserHasStory) {
//          const user = await User.findById(userId).select('_id name profileImage');
//          if (user) {
//              activeStories.unshift({
//                  _id: user._id,
//                  profilePic: user.profileImage || '',
//                  name: user.name || '',
//                  stories: [],
//              });
//          }
//      }

//     const totalStories = await Story.countDocuments({
//         status: 'active',
//         expiryDate: { $gt: new Date() },
//     });

//     const totalPages = Math.ceil(totalStories / limit);


//     return response.responseHandlerWithData(
//         res,
//         true,
//         statusCode.SUCCESS,
//         'Your active stories fetched successfully.',
//         {
//             totalStories,
//             totalPages,
//             currentPage: page,
//             limit,
//             data: activeStories,
//         }
//     );
// });


exports.getAllStories = catchAsyncError(async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const activeStories = await Story.aggregate([
        {
            $match: {
                status: 'active',
                expiryDate: { $gt: new Date() },
            },
        },
        {
            $lookup: {
                from: "likes",
                let: { storyId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$itemId", "$$storyId"] },
                                    { $eq: ["$itemType", "Story"] },
                                    { $eq: ["$userId", new mongoose.Types.ObjectId(userId)] }
                                ]
                            }
                        }
                    }
                ],
                as: "userLikeInfo"
            }
        },
        {
            $addFields: {
                isViewed: {
                    $in: [new mongoose.Types.ObjectId(userId), '$views'],
                },
                isLiked: { $gt: [{ $size: "$userLikeInfo" }, 0] }
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userDetails',
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            profileImage: 1,
                        },
                    },
                ],
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: 'mentionPeople',
                foreignField: '_id',
                as: 'mentionedUsers',
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            phoneNumber: 1,
                            username: 1,
                            gender: 1,
                            status: 1,
                            location: 1,
                            profileImage: 1,
                            coverImage: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: '$userDetails',
        },
        {
            $group: {
                _id: '$userId',
                profilePic: { $first: '$userDetails.profileImage' },
                name: { $first: '$userDetails.name' },
                stories: {
                    $push: {
                        _id: '$_id',
                        createdAt: '$createdAt',
                        isViewed: '$isViewed',
                        isLiked: '$isLiked',
                        mentionedUsers: "$mentionedUsers",
                        fileUrl: "$fileUrl",
                        textContent: "$textContent",
                        views: '$views',
                        location: '$location',
                        music: '$music',
                        likeCount: '$likeCount',
                        commentCount: '$commentCount',
                        flagCount: '$flagCount',
                        status: '$status',
                        expiryDate: '$expiryDate',
                        createdAt: '$createdAt',
                        updatedAt: '$updatedAt',
                    },
                },
            },
        },
        {
            $sort: {
                'stories.createdAt': -1,
            },
        },
        { $skip: skip },
        { $limit: limit },
    ]);

    let loggedInUserStories = activeStories.find(story => story._id.toString() === userId.toString());
    let otherUsersStories = activeStories.filter(story => story._id.toString() !== userId.toString());

    if (loggedInUserStories) {
        loggedInUserStories.stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    otherUsersStories.sort((a, b) => {
        let latestA = Math.max(...a.stories.map(story => new Date(story.createdAt).getTime()), 0);
        let latestB = Math.max(...b.stories.map(story => new Date(story.createdAt).getTime()), 0);
        return latestB - latestA;
    });

    let sortedStories = loggedInUserStories ? [loggedInUserStories, ...otherUsersStories] : otherUsersStories;

    const paginatedStories = sortedStories.slice(skip, skip + limit);

    if (!loggedInUserStories) {
        const user = await User.findById(userId).select('_id name profileImage');
        if (user) {
            paginatedStories.unshift({
                _id: user._id,
                profilePic: user.profileImage || '',
                name: user.name || '',
                stories: [],
            });
        }
    }

    const totalStories = await Story.countDocuments({
        status: 'active',
        expiryDate: { $gt: new Date() },
    });

    const totalPages = Math.ceil(totalStories / limit);


    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        'Your active stories fetched successfully.',
        {
            totalStories,
            totalPages,
            currentPage: page,
            limit,
            data: paginatedStories,
        }
    );
});

exports.viewStory = catchAsyncError(async (req, res) => {
    const userId = req.user.id;

    const storyId = req.query.storyId;

    const storyDetail = await Story.aggregate([
        {
            $match: {
                _id : new mongoose.Types.ObjectId(storyId),
            },
        },
        {
            $addFields: {
                isViewed: {
                    $in: [new mongoose.Types.ObjectId(userId), '$views'],
                },
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userDetails',
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            profileImage: 1,
                        },
                    },
                ],
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: 'mentionPeople',
                foreignField: '_id',
                as: 'mentionedUsers',
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            phoneNumber: 1,
                            username: 1,
                            gender: 1,
                            status: 1,
                            location: 1,
                            profileImage: 1,
                            coverImage: 1,
                        },
                    },
                ],
            },
        }
    ]);

    if (!storyDetail || storyDetail.length === 0) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            'Story not found.'
        );
    }

    if(!storyDetail[0].isViewed && storyDetail[0].userId != userId){
        await Story.updateOne(
            { _id: storyId },
            {
                $addToSet: { views: new mongoose.Types.ObjectId(userId) }
            }
        );
    }

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        'Your active stories fetched successfully.',
        storyDetail
    );
});


exports.removeStory = catchAsyncError(async (req, res) => {
    const userId = req.user.id;
    const storyId = req.query.storyId;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Invalid storyId."
        );
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.UNAUTHORIZED,
            "Invalid userId."
        );
    }

    const story = await Story.findOneAndDelete({
        _id: storyId,
        userId: new mongoose.Types.ObjectId(userId),
        status: "active",
    });

    if (!story) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Story not found or not authroized to delete this story."
        );
    }

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        "Your story has been removed successfully."
    );
});

exports.addCommentOnStory = catchAsyncError(async (req, res) => {
    const { content, storyId } = req.body;

    const story = await Story.findById(storyId).exec();

    if (!story) {
        return response.responseHandlerWithError(res, false, statusCode.RESULTNOTFOUND, "Story not found");
    }

    if (story.status !== "active") {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, `Story is ${story.status}.`);
    }

    const comment = await Comment.create({
        storyId,
        userId: req.user.id,
        content,
        commentType : "story"
    });

    await Story.updateOne({ _id: storyId }, { $inc: { commentCount: 1 } });

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Comment on story added successfully", comment);
});









