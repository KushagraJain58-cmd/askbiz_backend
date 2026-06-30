let Post = require('../../../models/post');
let Community = require('../../../models/community');
let CommunityMember = require('../../../models/communityMembers');
let Report = require('../../../models/report');
let Comment = require('../../../models/comment');
let Reply = require('../../../models/reply');
let Like = require('../../../models/like');
let User = require('../../../models/users');
let { catchAsyncError } = require('../../../../utils/constants/generateError');
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes')
let mongoose = require('mongoose');
let Friend = require('../../../models/follow').Friend
let Tag = require('../../../models/tags');
const Review = require('../../../models/review');
const Interaction = require('../../../models/interaction');
const Interest = require("../../../models/interest");
const { sendOneToOneNotification, sendUserBulkNotifications } = require("../../../../utils/helpers/notificationUtils")


exports.createPost = catchAsyncError(async (req, res) => {

  const userId = req.user.id;

  if (req.body.communityId) {
    const isCommunityExists = await Community.findOne({
      _id: req.body.communityId
    })
    if (!isCommunityExists) {
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Community not found")
    }

    const isCommunityMember = await CommunityMember.findOne({
      communityId: new mongoose.Types.ObjectId(req.body.communityId),
      memberId: new mongoose.Types.ObjectId(userId),
    });

    if (!isCommunityMember) {
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "You are not a active member of this community")
    }

  }

  const tags = req.body.description ? req.body?.description.match(/#[a-zA-Z0-9_]+/g) : [];

  if (tags && tags.length > 0) {

    tags.map(async (tag) => {

      const tagExist = await Tag.findOne({ tagName: tag });
      if (!tagExist) {
        const newTag = new Tag({ tagName: tag, tagUsedCount: 1 });
        await newTag.save();
      } else {
        tagExist.tagUsedCount += 1;
        await tagExist.save();
      }
    })
  }

  if (req.body.interest && req.body.interest.length > 0) {

    const allInterestValues = req.body.interest.flatMap((interest) => interest.value);

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

  const newPost = new Post({
    userId: userId,
    title: req.body?.title,
    interest: req.body?.interest,
    description: req.body?.description,
    postType: req.body?.postType,
    imagesOrVideos: req.body?.imagesOrVideos,
    audienceSelection: req.body?.audienceSelection !== "" ? req.body?.audienceSelection : "public",
    communityId: req.body?.communityId,
    mentionPeople: req.body?.mentionPeople,
    location: {
      type: 'Point',
      coordinates: (typeof req.body?.location?.longitude === 'number' && typeof req.body?.location?.latitude === 'number')
        ? [req.body.location.longitude, req.body.location.latitude]
        : (function () {
          console.warn('Invalid coordinates:', req.body?.location);
          return [0, 0];
        })(),
      cityName: req.body.location && req.body.location?.cityName !== "" ? req.body?.location.cityName : null
    },
    hideLikeAndViewCounts: req.body?.hideLikeAndViewCounts,
    turnOffCommenting: req.body?.turnOffCommenting,
    makePostAsQuery: req.body?.makePostAsQuery,
    tags: tags,
    maxMediaRatio : req.body?.maxMediaRatio,
    postLink : req.body?.postLink,
  });
 
  const savedPost = await newPost.save();

  if (req.body.mentionPeople && req.body.mentionPeople.length > 0) {

    if(req.body?.communityId){

      const communityDetail = await Community.findById(req.body?.communityId).select("communityName")
      
      const notificationMessage = `${req.user.data.name || req.user.data.businesssName} tagged you in a post of ${communityDetail.communityName} community.`;
      const payload = { postId: savedPost._id.toString(), type: "mention", communityId: communityDetail._id.toString() };

      await sendUserBulkNotifications(userId, req.body.mentionPeople, "tag", notificationMessage, payload, req.body.communityId);

    }else{
      const notificationMessage = `${req.user.data.name || req.user.data.businesssName} mentioned you in a post`;
      const payload = { postId: savedPost._id.toString(), type: "mention" };

      await sendUserBulkNotifications(userId, req.body.mentionPeople, "tag", notificationMessage, payload);
    }
  }

  return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Post created successfuly", savedPost);

})

exports.likeToggle = catchAsyncError(async (req, res) => {
  const { postId, commentId, replyId, reviewId } = req.body;
  const isLiked = req.body.toggleLike;
  const userId = req.user.id;

  let itemId;
  let itemType;

  if (postId) {
    itemId = postId;
    itemType = "Post";
  } else if (commentId) {
    itemId = commentId;
    itemType = "Comment";
  } else if (replyId) {
    itemId = replyId;
    itemType = "Reply";
  } else if (reviewId) {
    itemId = reviewId;
    itemType = "Review";
  } else {
    return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Please provide a postId, commentId, or replyId to like.");
  }

  const existingLike = await Like.findOne({ itemId, itemType, userId });
  let message = "";

  if (existingLike) {
    if (isLiked) {
      message = `You have already liked this ${itemType.toLowerCase()}.`;
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, message);
    } else {
      await Like.findByIdAndDelete(existingLike._id);
      message = `${itemType} unliked successfully!`;
    }
  } else {
    if (isLiked) {
      await Like.create({ itemId, itemType, userId, isLiked: true });
      message = `${itemType} liked successfully!`;

      let recipientId;
      if (itemType === "Post") {

        const post = await Post.findById(itemId).select("userId");
        recipientId = post?.userId;

        await Interaction.create({ userId, postId, type: "like", status: "active" });

      } else if (itemType === "Comment") {

        const comment = await Comment.findById(itemId).select("userId postId");
        recipientId = comment?.userId;

        const getPostId = await Comment.findById(itemId).select("postId").lean();

        await Interaction.create({ userId, postId: getPostId.postId, type: "like", status: "active" });

      } else if (itemType === "Reply") {

        const reply = await Reply.findById(itemId).select("userId commentId");
        recipientId = reply?.userId;

        let getCommentId = await Reply.findById(itemId).select("commentId").lean();

        let getPostId = await Comment.findById(getCommentId.commentId).select("postId").lean();

        await Interaction.create({ userId, postId: getPostId.postId, type: "like", status: "active" });
      }

      if (recipientId && recipientId.toString() !== userId.toString()) {
        const senderUser = await User.findById(userId).lean().select(["name", "businessName", "username"]);

        await sendOneToOneNotification(
          userId,
          recipientId,
          "New Like",
          `${senderUser?.name || senderUser?.businessName || "Unknown User"} liked your ${itemType.toLowerCase()}!`,
          {
            type: "like",
            referenceId: itemId,
            referenceType: itemType,
            senderName: senderUser?.name || senderUser?.businessName,
          }
        );
      }
    } else {
      message = `You have to like first before unliking this ${itemType.toLowerCase()}.`;
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, message);
    }
  }

  let itemModel;
  switch (itemType) {
    case "Post":
      itemModel = Post;
      break;
    case "Comment":
      itemModel = Comment;
      break;
    case "Reply":
      itemModel = Reply;
      break;
    case "Review":
      itemModel = Review;
      break;
    default:
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Invalid item type.");
  }

  const currentItem = await itemModel.findById(itemId).select('likeCount');

  if (!currentItem) {
    return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, `${itemType} not found.`);
  }

  let newLikeCount = currentItem.likeCount + (isLiked ? 1 : -1);
  if (newLikeCount < 0) {
    newLikeCount = 0;
  }

  await itemModel.findByIdAndUpdate(itemId, { likeCount: newLikeCount }, { new: true });
  return response.responseHandlerWithData(res, true, statusCode.SUCCESS, message, { itemType, likeCount: newLikeCount });
});

exports.postActions = catchAsyncError(async (req, res) => {
  const { postId, actionType } = req.body;

  let updatedUser;

  let currentUser = await User.findById(req.user.id);

  if (!currentUser) {
    return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User not found")
  }

  const isPostExist = await Post.findById(postId);

  if (!isPostExist) {
    return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Post not found")
  }

  switch (actionType) {
    case "hide":

      if (currentUser.hiddenPosts.includes(postId)) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User already hide this post")
      }

      updatedUser = await User.findOneAndUpdate(
        { _id: req.user.id },
        {
          $push: {
            hiddenPosts: postId
          }
        },
        { new: true, select: 'hiddenPosts' }
      );

      if (!updatedUser) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Fail to hide post.")
      }
      break;

    case "bookmark":

      if (currentUser.bookmarkPosts.includes(postId)) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User already Bookmark this post")
      }

      updatedUser = await User.findOneAndUpdate(
        { _id: req.user.id },
        {
          $push: {
            bookmarkPosts: postId
          }
        },
        { new: true, select: 'bookmarkPosts' }
      );

      if (!updatedUser) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Fail to bookmark post.")
      }
      break;

    default:
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Invalid action type");
  }
  return response.responseHandlerWithData(res, true, statusCode.SUCCESS, `This post is successfully ${actionType}`, updatedUser)
});


// const buildFilters = async (req, user) => {
//   let {
//     by,
//     location,
//     bussinessExpert,
//     bussinessAccount,
//     fromDate,
//     toDate = new Date(),
//     postMadeOn,
//     filterInterests,
//     queryFeed,
//     postType,
//   } = req.body;

//   if (!postType) {
//     postType = "all";
//   }

//   const [blockedUsers, blockedCommunities, expertAndBusinessUsers] = await Promise.all([
//     User.distinct("_id", { status: "blocked" }),
//     CommunityMember.distinct("communityId", {
//       status: "block",
//       memberId: new mongoose.Types.ObjectId(user._id),
//     }),
//     Promise.all([
//       bussinessExpert ? User.distinct("_id", { accountType: "Expert" }) : [],
//       bussinessAccount ? User.distinct("_id", { accountType: "Bussiness" }) : [],
//     ]).then((results) => results.flat()),
//   ]);

//   const matchFilters = {
//     userId: { $nin: [...blockedUsers, ...user.blockedUsers] },
//     _id: { $nin: user.hiddenPosts },
//     communityId: { $nin: blockedCommunities },
//   };

//   const communityJoined = await CommunityMember.distinct("communityId", {
//     status: "active",
//     memberId: new mongoose.Types.ObjectId(user._id),
//   });

//   console.log("byyyyyy---",by)

//   if (by) {
//     const searchTerms = by.trim().split(/\s+/);
//     const searchConditions = searchTerms.map((term) => ({
//       $or: [
//         { title: { $regex: term, $options: "i" } },
//         { description: { $regex: term, $options: "i" } },
//         { "location.cityName": { $regex: term, $options: "i" } },
//       ],
//     }));

//     console.log("searchConditions",searchConditions)

//     matchFilters.$and = [
//       {
//         $or: searchConditions,
//       },
//       {
//         $or: [
//           {
//             postType: "community",
//             "community.communityType": "private",
//             communityId: { $in: communityJoined },
//           },
//           {
//             postType: "community",
//             "community.communityType": "public",
//           },
//         ],
//       },
//     ];
//   }


//   if (location) {
//     try {
//       const cityNames = location.map((loc) => loc.cityName).filter(Boolean);
//       if (cityNames.length) matchFilters["location.cityName"] = { $in: cityNames };
//     } catch {
//       throw new Error("Invalid location format.");
//     }
//   }

//   if (fromDate || toDate) {
//     matchFilters.createdAt = {
//       ...(fromDate && { $gte: new Date(fromDate) }),
//       ...(toDate && { $lte: new Date(toDate) }),
//     };
//   }

//   const relativeDateFilter = {
//     today: {
//       $gte: new Date(new Date().setHours(0, 0, 0, 0)),
//       $lt: new Date(new Date().setHours(23, 59, 59, 999))
//     },
//     weekAgo: { $gte: new Date().setDate(new Date().getDate() - 7) },
//     monthAgo: { $gte: new Date().setMonth(new Date().getMonth() - 1) },
//     yearAgo: { $gte: new Date().setFullYear(new Date().getFullYear() - 1) },
//   };
//   if (postMadeOn && relativeDateFilter[postMadeOn]) {
//     matchFilters.createdAt = relativeDateFilter[postMadeOn];
//   }

//   if (filterInterests) {
//     const interests = filterInterests.map((interest) => interest.trim());
//     if (interests.length)
//       matchFilters.interest = { $elemMatch: { value: { $in: interests } } };
//   }

//   if (queryFeed) matchFilters.makePostAsQuery = true;


//   if (bussinessExpert || bussinessAccount) {
//     matchFilters.userId.$in = expertAndBusinessUsers;
//   }

//   if (postType === "followers") {
//     const followerIds = await Friend.distinct("friendId", {
//       userId: user._id,
//       status: "active",
//     });
//     matchFilters.userId = { $in: followerIds };
//   } else {

//     if (postType === "community") {
//       matchFilters.postType = "community";
//       matchFilters.communityId = { $in: communityJoined };
//     } else if (postType === "normal") {
//       matchFilters.postType = "normal";
//     } else if (postType === "all") {

//       const postTypeOrConditions = [
//         { postType: "normal" },
//         { postType: "community", communityId: { $in: communityJoined } },
//         { "community.communityType": "public" },
//       ];
//       matchFilters.$or = matchFilters.$or ? matchFilters.$or : postTypeOrConditions;

//     }
//   }

//   console.log("matchFilters",matchFilters)

//   return matchFilters;
// };

const buildFilters = async (req, user) => {
  const {
    by,
    location,
    bussinessExpert,
    bussinessAccount,
    fromDate,
    toDate = new Date(),
    postMadeOn,
    filterInterests,
    queryFeed,
    postType = "all", // Default value
  } = req.body;

  const [blockedUsers, blockedCommunities, expertAndBusinessUsers, communityJoined] = await Promise.all([
    User.distinct("_id", { status: "blocked" }),
    CommunityMember.distinct("communityId", {
      status: "block",
      memberId: user._id,
    }),
    Promise.all([
      bussinessExpert ? User.distinct("_id", { accountType: "Expert" }) : [],
      bussinessAccount ? User.distinct("_id", { accountType: "Bussiness" }) : [],
    ]).then(results => results.flat()),
    CommunityMember.distinct("communityId", {
      status: "active",
      memberId: user._id,
    }),
  ]);

  const matchFilters = {
    userId: { $nin: [...blockedUsers, ...(user.blockedUsers || [])] },
    _id: { $nin: user.hiddenPosts || [] },
    communityId: { $nin: blockedCommunities },
  };

  if (by) {
    const searchTerms = by.trim().split(/\s+/).filter(term => term.length > 0);
    
    if (searchTerms.length > 0) {
      const textSearchConditions = searchTerms.map(term => ({
        $or: [
          { "postCreator.name": { $regex: term, $options: "i" } },
          { "postCreator.businessName": { $regex: term, $options: "i" } },
          { "postCreator.username": { $regex: term, $options: "i" } },
          { title: { $regex: term, $options: "i" } },
          { description: { $regex: term, $options: "i" } },
          { "community.communityName" : { $regex: term, $options: "i" } },
          { "location.cityName": { $regex: term, $options: "i" } },
        ]
      }));

      matchFilters.$and = [
        searchTerms.length > 1 ? { $and: textSearchConditions } : textSearchConditions[0],
        { 
          $or: [
            { postType: "normal" },
            { 
              postType: "community",
              $or: [
                { "community.communityType": "public" },
                { 
                  "community.communityType": "private",
                  communityId: { $in: communityJoined }
                }
              ]
            }
          ]
        }
      ];
    }
  }

  // Location filter
  if (location && Array.isArray(location)) {
    const cityNames = location.map(loc => loc?.cityName).filter(Boolean);
    if (cityNames.length > 0) {
      matchFilters["location.cityName"] = { $in: cityNames };
    }
  }

  // Date range filter
  if (fromDate || toDate) {
    matchFilters.createdAt = {
      ...(fromDate && { $gte: new Date(fromDate) }),
      ...(toDate && { $lte: new Date(toDate) }),
    };
  }

  // Relative date filter
  const relativeDateFilter = {
    today: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lt: new Date(new Date().setHours(23, 59, 59, 999))
    },
    weekAgo: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    monthAgo: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    yearAgo: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
  };
  
  if (postMadeOn && relativeDateFilter[postMadeOn]) {
    matchFilters.createdAt = relativeDateFilter[postMadeOn];
  }

  // Interests filter
  if (filterInterests && Array.isArray(filterInterests)) {
    const interests = filterInterests.map(interest => interest?.trim()).filter(Boolean);
    if (interests.length > 0) {
      matchFilters.interest = { $elemMatch: { value: { $in: interests } } };
    }
  }

  // Query feed filter
  if (queryFeed) {
    matchFilters.makePostAsQuery = true;
  }

  // Business/Expert filter
  if (bussinessExpert || bussinessAccount) {
    matchFilters.userId.$in = expertAndBusinessUsers;
  }

  // Post type filters
  // if (postType === "followers") {
  //   const followerIds = await Friend.distinct("friendId", {
  //     userId: user._id,
  //     status: "active",
  //   });
  //   matchFilters.userId = { $in: followerIds };
  // } else {
  //   switch (postType) {
  //     case "community":
  //       matchFilters.postType = "community";
  //       matchFilters.communityId = { $in: communityJoined };
  //       break;
  //     case "normal":
  //       matchFilters.postType = "normal";
  //       break;
  //     case "all":
  //     default:
  //       matchFilters.$or = [
  //         { postType: "normal" },
  //         { 
  //           postType: "community",
  //           $or: [
  //             { communityId: { $in: communityJoined } },
  //             { "community.communityType": "public" }
  //           ]
  //         }
  //       ];
  //       break;
  //   }
  // }

  if (postType === "followers") {
    const followerIds = await Friend.distinct("friendId", {
      userId: user._id,
      status: "active",
    });
    matchFilters.userId = { $in: followerIds };
  } else {

    if (postType === "community") {
      matchFilters.postType = "community";
      matchFilters.communityId = { $in: communityJoined };
    } else if (postType === "normal") {
      matchFilters.postType = "normal";
    } else if (postType === "all") {

      const postTypeOrConditions = [
        { postType: "normal" },
        { postType: "community", communityId: { $in: communityJoined } },
        { "community.communityType": "public" },
      ];
      matchFilters.$or = matchFilters.$or ? matchFilters.$or : postTypeOrConditions;

    }
  }

  return matchFilters;
};

exports.getPosts = catchAsyncError(async (req, res) => {
  const userId = req.user.id;

  let { limit = 10, pageNo = 1, order = "desc", sortBy = "priorityScore" } = req.body;

  const pageLimit = parseInt(limit, 10);
  const page = parseInt(pageNo, 10);
  const offset = pageLimit * (page - 1);

  const sortOrder = order === "asc" ? 1 : -1;

  if (!sortBy) {
    sortBy = "priorityScore"
  }

  let matchFilters ={};

  const user = await User.findById(userId).select([
    "_id",
    "interest",
    "hiddenPosts",
    "blockedUsers",
    "location",
  ]);

  try {
    matchFilters = await buildFilters(req, user);
  } catch (error) {
    return response.responseHandlerWithMessage(res, false, 400, error.message);
  }

  const recentInteractions = await Interaction.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("postId", "interest tags");

  const interactedInterests = recentInteractions
    .map((interaction) => {
      return interaction.postId?.interest.map((interestItem) => interestItem.value).flat();
    }).flat();

  const interactedTags = recentInteractions
    .map((interaction) => interaction.postId?.tags || [])
    .flat();

  const userInterests = user.interest.map(interest => interest.value).flat();


  const postsPipeline = [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [user.location.coordinates[0], user.location.coordinates[1]] },
        distanceField: "distance",
        spherical: true,
      }
    },
    {
      $lookup: {
        from: "communities",
        localField: "communityId",
        foreignField: "_id",
        as: "community",
        pipeline: [
          {
            $project: {
              _id: 1,
              userId: 1,
              logo: 1,
              communityName: 1,
              communityUsername: 1,
              communityType: 1,
              description: 1,
              status: 1,
              createdAt: 1,
            }
          }
        ]
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "userId",
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
    { $match: matchFilters },
    {
      $addFields: {
        interactionMatchScore: {
          $sum: [
            {
              $size: {
                $filter: {
                  input: {
                    $reduce: {
                      input: "$interest",
                      initialValue: [],
                      in: { $concatArrays: ["$$value", "$$this.value"] },
                    },
                  },
                  as: "flatInterest",
                  cond: { $in: ["$$flatInterest", interactedInterests] },
                },
              },
            },
            {
              $size: {
                $filter: {
                  input: { $ifNull: ["$tags", []] },
                  as: "tag",
                  cond: { $in: ["$$tag", interactedTags] },
                },
              },
            }
          ],
        },
      },
    },
    {
      $lookup: {
        from: "communities",
        localField: "communityId",
        foreignField: "_id",
        as: "community",
        pipeline: [
          {
            $project: {
              _id: 1,
              userId: 1,
              logo: 1,
              communityName: 1,
              communityUsername: 1,
              communityType: 1,
              description: 1,
              status: 1,
              createdAt: 1,
            }
          }
        ]
      },
    },
    {
      $lookup: {
        from: "communitymembers",
        localField: "communityId",
        foreignField: "communityId",
        as: "members",
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "postId",
        as: "comments",
      },
    },
    {
      $lookup: {
        from: "replies",
        localField: "comments._id",
        foreignField: "commentId",
        as: "commentReplies",
      }
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "itemId",
        as: "likes",
        pipeline: [{ $match: { itemType: "Post", isLiked: true } }],
      },
    },
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
        from: "likes",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$itemId", "$$postId"] },
                  { $eq: ["$itemType", "Post"] },
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
      $lookup: {
        from: "users",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", new mongoose.Types.ObjectId(userId)] },
                  { $in: ["$$postId", { $ifNull: ["$bookmarkPosts", []] }] }
                ]
              }
            }
          }
        ],
        as: "userBookmarkInfo"
      }
    },
    {
      $lookup: {
        from: "users",
        let: { userId: "$userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: ["$$userId", { $ifNull: ["$mutedUsers", []] }]
              }
            }
          }
        ],
        as: "userMuteInfo"
      }
    },
    {
      $lookup: {
        from: "friends",
        let: { postCreatorId: "$userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$postCreatorId"] },
                  { $eq: ["$friendId", new mongoose.Types.ObjectId(userId)] },
                  { $eq: ["$status", "active"] }
                ]
              }
            }
          }
        ],
        as: "followingToPostCreatorInfo"
      }
    },
    {
      $lookup: {
        from: "friendrequests",
        let: { postCreatorId: "$userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] },
                  { $eq: ["$receiverId", "$$postCreatorId"] },
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
      $lookup: {
        from: "communitymembers",
        let: { communityId: "$communityId", userId: new mongoose.Types.ObjectId(userId) },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$communityId", "$$communityId"] },
                  { $eq: ["$memberId", "$$userId"] },
                ],
              },
            },
          },
          {
            $project: {
              _id: 0,
              communityRole: 1, // Include only the communityRole field
            },
          },
        ],
        as: "membershipInfo",
      },
    },
    {
      $lookup: {
        from: "communityrequests",
        let: { communityId: "$communityId", userId: new mongoose.Types.ObjectId(userId) },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$sendTo.id", "$$communityId"] },
                  { $eq: ["$sendBy.id", "$$userId"] },
                  { $eq: ["$status", "pending"] },
                ],
              },
            },
          },
          {
            $project: {
              _id: 0,
            },
          },
        ],
        as: "requestInfo",
      },
    },
    {
      $addFields: {
        userCommunityRole: {
          $cond: [
            { $ifNull: ["$communityId", false] },
            {
              $cond: [
                { $gt: [{ $size: "$membershipInfo" }, 0] },
                { $arrayElemAt: ["$membershipInfo.communityRole", 0] },
                {
                  $cond: [
                    { $gt: [{ $size: "$requestInfo" }, 0] },
                    "pending",
                    "notJoined",
                  ],
                },
              ],
            },
            null
          ],
        },
      },
    },
    {
      $addFields: {
        communityFollowingScore: {
          $cond: [
            {
              $or: [
                { $eq: ["$userCommunityRole", "member"] },
                { $eq: ["$userCommunityRole", "admin"] },
                { $eq: ["$userCommunityRole", "moderator"] }
              ]
            },
            1,
            0
          ]
        }
      }
    },
    {
      $addFields: {
        totalComments: {
          $sum: [
            { $size: "$comments" },
            { $size: "$commentReplies" },
          ],
        },
        totalMembers: { $size: "$members" },
        interestMatchScore: {
          $size: {
            $filter: {
              input: {
                $reduce: {
                  input: "$interest",
                  initialValue: [],
                  in: { $concatArrays: ["$$value", "$$this.value"] },
                },
              },
              as: "flatInterest",
              cond: { $in: ["$$flatInterest", userInterests] },
            },
          },
        },
      },
    },
    {
      $addFields: {
        recencyMultiplier: {
          $switch: {
            branches: [
              {
                case: {
                  $lte: [
                    { $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "hour" } },
                    6,
                  ],
                },
                then: 1.5,
              },
              {
                case: {
                  $lte: [
                    { $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "hour" } },
                    24,
                  ],
                },
                then: 1.3,
              },
              {
                case: {
                  $lte: [
                    { $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "day" } },
                    3,
                  ],
                },
                then: 1.1,
              },
              {
                case: {
                  $lte: [
                    { $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "day" } },
                    7,
                  ],
                },
                then: 1.0,
              },
              {
                case: {
                  $lte: [
                    { $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "day" } },
                    30,
                  ],
                },
                then: 0.7,
              }
            ],
            default: 0.5,
          },
        },
      },
    },

    {
      $addFields: {
        recencyMultiplier: {
          $switch: {
            branches: [
              { case: { $lte: [{ $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "hour" } }, 1] }, then: 2.0 },
              { case: { $lte: [{ $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "hour" } }, 6] }, then: 1.5 },
              { case: { $lte: [{ $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "hour" } }, 24] }, then: 1.3 },
              { case: { $lte: [{ $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "day" } }, 3] }, then: 1.1 },
              { case: { $lte: [{ $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "day" } }, 7] }, then: 1.0 },
              { case: { $lte: [{ $dateDiff: { startDate: "$createdAt", endDate: new Date(), unit: "day" } }, 30] }, then: 0.7 }
            ],
            default: 0.5
          }
        }
      }
    },

    {
      $addFields: {
        isLiked: { $gt: [{ $size: "$userLikeInfo" }, 0] },
        isBookMarked: { $gt: [{ $size: "$userBookmarkInfo" }, 0] },
        isMute: { $gt: [{ $size: "$userMuteInfo" }, 0] },
        isFollowingToPostCreator: {
          $cond: [
            { $gt: [{ $size: "$followingToPostCreatorInfo" }, 0] },
            "accepted",
            {
              $cond: [
                { $gt: [{ $size: "$friendShipStatus" }, 0] },
                "requested",
                "notFollow"
              ]
            }
          ]
        },
        popularityScore: {
          $add: [
            { $multiply: ["$likeCount", 0.6] },
            { $multiply: ["$totalComments", 0.4] },
          ],
        },
      }
    },
    {
      $addFields: {
        followingCreatorScore: {
          $cond: [{ $eq: ["$isFollowingToPostCreator", "accepted"] }, 10, 0]
        }
      }
    },
    // {
    //   $addFields: {
    //     priorityScore: {
    //       $round: [
    //         {
    //           $add: [
    //             { $multiply: [{ $ifNull: ["$interactionMatchScore", 0] },"$recencyMultiplier", 3] },
    //             { $multiply: [{ $ifNull: ["$interestMatchScore", 0] },"$recencyMultiplier", 2] },
    //             { $multiply: [{ $ifNull: ["$totalLikes", 0] },"$recencyMultiplier", 1.6] },
    //             { $multiply: [{ $ifNull: ["$communityFollowingScore", 0] },"$recencyMultiplier", 1.5] },
    //             { $multiply: [{ $ifNull: ["$totalComments", 0] },"$recencyMultiplier", 1.4] },
    //             { $multiply: [{ $ifNull: ["$totalMembers", 0] },"$recencyMultiplier", 1.2] },
    //             { $multiply: [{ $ifNull: ["$shareCount", 0] },"$recencyMultiplier",  1.4] },
    //             { $multiply: [{ $ifNull: ["$distance", 0] }, -0.5, "$recencyMultiplier"] },
    //           ],
    //         },
    //         2,
    //       ],
    //     },
    //   },
    // },
    {
      $addFields: {
        priorityScore: {
          $round: [
            {
              $add: [
                { $multiply: [{ $ifNull: ["$interactionMatchScore", 0] }, "$recencyMultiplier", 4] },
                { $multiply: [{ $ifNull: ["$interestMatchScore", 0] }, "$recencyMultiplier", 3] },
                { $multiply: [{ $ifNull: ["$likeCount", 0] }, "$recencyMultiplier", 1.5] },
                { $multiply: [{ $ifNull: ["$communityFollowingScore", 0] }, "$recencyMultiplier", 2] },
                { $multiply: [{ $ifNull: ["$totalComments", 0] }, "$recencyMultiplier", 1.5] },
                { $multiply: [{ $ifNull: ["$shareCount", 0] }, "$recencyMultiplier", 2] },
                { $multiply: [{ $ifNull: ["$followingCreatorScore", 0] }, "$recencyMultiplier", 2.5] },
                { $multiply: [{ $divide: [{ $ifNull: ["$distance", 0] }, 1000] }, -1, "$recencyMultiplier"] },
                { $multiply: [{ $toDouble: { $toLong: "$createdAt" } }, 0.0000000001] }
              ]
            },
            2
          ]
        }
      }
    },
    {
      $sort: {
        [sortBy]: sortOrder,
        _id: sortOrder
      },
    },
    { $skip: offset },
    { $limit: pageLimit },
    {
      $project: {
        _id: 1,
        userId: 1,
        communityId: 1,
        title: 1,
        description: 1,
        createdAt: 1,
        postType: 1,
        audienceSelection: 1,
        mentionPeopleDetails: 1,
        communityId: 1,
        community: 1,
        userCommunityRole: 1,
        imagesOrVideos: 1,
        location: 1,
        hideLikeAndViewCounts: 1,
        turnOffCommenting: 1,
        makePostAsQuery: 1,
        postCreator: 1,
        totalComments: { $ifNull: ["$totalComments", 0] },
        likeCount: 1,
        createdAt: 1,
        shareCount: 1,
        isLiked: 1,
        isBookMarked: 1,
        isMute: 1,
        isFollowingToPostCreator: 1,
        maxMediaRatio : 1,
        postLink : 1
      },
    },
  ];

  const countPipeline = [{ $count: "total" }];
  const [posts, countResult] = await Promise.all([
    Post.aggregate(postsPipeline),
    Post.aggregate([...postsPipeline.slice(0, 1), ...countPipeline]),
  ]);

  const totalPostsCount = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalPostsCount / pageLimit);

  return response.responseHandlerWithData(res, true, 200, "Feed Posts retrieved successfully", {
    currentPage: page,
    totalPages,
    totalPostsCount,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
    posts,
  });
});

exports.deletePost = catchAsyncError(async (req, res) => {

  const { postId, communityId } = req.query;
  const userId = req.user.id;

  const query = communityId
    ? { _id: postId, communityId: communityId }
    : { _id: postId, userId: new mongoose.Types.ObjectId(userId) };

  const post = await Post.findOne(query);

  if (!post) {
    return response.responseHandlerWithMessage(
      res,
      false,
      statusCode.SUCCESS,
      "No posts found to delete"
    );
  }

  const comments = await Comment.find({ postId }).select('_id');
  const commentIds = comments.map(comment => comment._id);

  await Reply.deleteMany({ commentId: { $in: commentIds } });
  await Comment.deleteMany({ postId });

  const replyIds = await Reply.find({ commentId: { $in: commentIds } }).select('_id');
  const replyIdList = replyIds.map(reply => reply._id);

  await Like.deleteMany({
    $or: [
      { itemId: postId, itemType: 'Post' },
      { itemId: { $in: commentIds }, itemType: 'Comment' },
      { itemId: { $in: replyIdList }, itemType: 'Reply' }
    ]
  });

  await Interaction.deleteMany({ postId });

  const reportQuery = communityId
    ? { postId, reportToCommunityPost: new mongoose.Types.ObjectId(communityId) }
    : { postId, postByUserId: new mongoose.Types.ObjectId(userId) };

  await Report.deleteMany(reportQuery);


  await Post.deleteOne(query);

  return response.responseHandlerWithMessage(
    res,
    true,
    statusCode.SUCCESS,
    "Post and all associated data deleted successfully"
  );
});


exports.updatePost = catchAsyncError(async (req, res) => {
  const { postId } = req.body;

  const userId = req.user.id

  const existingPost = await Post.findById(postId).lean();
  if (!existingPost) {
    return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Post not found");
  }

  if (existingPost.userId.toString() !== req.user.id) {
    return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, "You are not authorized to update this post");
  }

  if (req.body.communityId) {

    const isCommunityExists = await Community.findOne({
      _id: req.body.communityId
    })
    if (!isCommunityExists) {
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Community not found")
    }

    const isCommunityMember = await CommunityMember.findOne({
      communityId: new mongoose.Types.ObjectId(req.body.communityId),
      memberId: new mongoose.Types.ObjectId(userId),
    });

    if (!isCommunityMember) {
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "You are not a active member of this community")
    }

  }

  const tags = req.body.description ? req.body?.description.match(/#[a-zA-Z0-9_]+/g) : [];

  if (tags && tags.length > 0) {

    tags.map(async (tag) => {

      const tagExist = await Tag.findOne({ tagName: tag });
      if (!tagExist) {
        const newTag = new Tag({ tagName: tag, createdBy: req.user.id, tagUsedCount: 1 });
        await newTag.save();
      } else {
        tagExist.tagUsedCount += 1;
        await tagExist.save();
      }
    })
  }

  const { _id, ...updatedPostData } = {
    title: req.body?.title,
    interest: req.body?.interest,
    description: req.body?.description,
    postType: req.body?.postType,
    imagesOrVideos: req.body?.imagesOrVideos,
    audienceSelection: req.body?.audienceSelection !== "" ? req.body?.audienceSelection : "public",
    communityId: req.body?.communityId,
    mentionPeople: req.body?.mentionPeople,
    location: {
      type: 'Point',
      coordinates: (typeof req.body?.location?.longitude === 'number' && typeof req.body?.location?.latitude === 'number')
        ? [req.body.location.longitude, req.body.location.latitude]
        : [0, 0],
      cityName: req.body.location && req.body.location?.cityName !== "" ? req.body?.location.cityName : null
    },
    hideLikeAndViewCounts: req.body?.hideLikeAndViewCounts,
    turnOffCommenting: req.body?.turnOffCommenting,
    makePostAsQuery: req.body?.makePostAsQuery,
    tags: tags,
    coverImage: req.body?.coverImage,
    maxMediaRatio : req.body?.maxMediaRatio,
    postLink : req.body?.postLink
  };

  const result = await Post.updateOne(
    {
      userId: userId,
      _id: new mongoose.Types.ObjectId(postId),

    },
    { $set: updatedPostData }
  );

  if (result.matchedCount === 0) {
    return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "No post found to update");
  }

  return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, "Post updated successfully");
});


exports.getOwnPosts = catchAsyncError(async (req, res) => {
  const userId = req.query.userId || req.user.id;
  const {
    limit = 10,
    pageNo = 1,
    sortBy = "createdAt",
    order = "desc",
    onlyMedia = false
  } = req.query;

  const pageLimit = parseInt(limit, 10);
  const page = parseInt(pageNo, 10);
  const offset = pageLimit * (page - 1);
  const sortOrder = order === "asc" ? 1 : -1;

  let matchStage = {
    userId: new mongoose.Types.ObjectId(userId),
    postType: "normal"
  };

  if (onlyMedia === 'true') {
    matchStage.imagesOrVideos = { $elemMatch: { uri: { $exists: true } } };
  }

  const postsAggregation = await Post.aggregate([
    { $match: matchStage },
    { $sort: { [sortBy]: sortOrder } },
    { $skip: offset },
    { $limit: pageLimit },

    // Look for comments
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "postId",
        as: "comments",
      }
    },
    {
      $lookup: {
        from: "replies",
        localField: "comments._id",
        foreignField: "commentId",
        as: "commentReplies",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "postCreator",
      }
    },
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
        from: "likes",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$itemId", "$$postId"] },
                  { $eq: ["$itemType", "Post"] },
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
      $lookup: {
        from: "users",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", new mongoose.Types.ObjectId(userId)] },
                  { $in: ["$$postId", { $ifNull: ["$bookmarkPosts", []] }] }
                ]
              }
            }
          }
        ],
        as: "userBookmarkInfo"
      }
    },
    {
      $lookup: {
        from: "friends",
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", new mongoose.Types.ObjectId(userId)] },
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
      $addFields: {
        isLiked: { $gt: [{ $size: "$userLikeInfo" }, 0] },
        isBookMarked: { $gt: [{ $size: "$userBookmarkInfo" }, 0] },
        totalFollowers: { $size: "$followers" },
        totalComments: {
          $sum: [
            { $size: { $ifNull: ["$comments", []] } },
            { $size: { $ifNull: ["$commentReplies", []] } },
          ],
        }
      }
    },
    {
      $project: {
        userId: 1,
        title: 1,
        description: 1,
        interest: 1,
        postType: 1,
        communityId: 1,
        imagesOrVideos: 1,
        audienceSelection: 1,
        location: 1,
        hideLikeAndViewCounts: 1,
        turnOffCommenting: 1,
        makePostAsQuery: 1,
        createdAt: 1,
        likeCount: 1,
        shareCount: 1,
        totalComments: 1,
        isLiked: 1,
        isBookMarked: 1,
        mentionPeopleDetails: 1,
        totalFollowers: 1,
        maxMediaRatio : 1,
        postLink : 1,
        'postCreator._id': 1,
        'postCreator.name': 1,
        'postCreator.businessName': 1,
        'postCreator.email': 1,
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
        'postCreator.blueTick': 1
      }
    }
  ]);


  const totalCount = await Post.countDocuments(matchStage);
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
    totalPostsInPage: postsAggregation.length,
    currentPage: page,
    totalPages: totalPages,
    nextPage: nextPage,
    prevPage: prevPage,
    nextLink: nextLink,
    prevLink: prevLink,
    posts: postsAggregation
  });
});


exports.toggleBookmark = catchAsyncError(async (req, res) => {
  const { postId, toggleBookmark } = req.body;
  const userId = req.user.id;

  const user = await User.findById(userId);

  if (!user) {
    return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User not found");
  }

  if (toggleBookmark) {
    if (user.bookmarkPosts.includes(postId)) {
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User has already bookmarked that post")
    } else {
      user.bookmarkPosts.push(postId);

      await Interaction.create({
        userId: userId,
        postId: postId,
        type: "bookmark"
      })
    }
  } else {
    if (!user.bookmarkPosts.includes(postId)) {
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User has not bookmarked that post")
    } else {
      user.bookmarkPosts = user.bookmarkPosts.filter(id => id.toString() !== postId);

      await Interaction.deleteOne({ userId: userId, postId: postId, type: "bookmark" });
    }
  }

  await user.save();

  return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Bookmark toggled successfully", {
    bookmarkPosts: user.bookmarkPosts
  });
});


exports.getBookmarks = catchAsyncError(async (req, res) => {

  const userId = req.user.id;

  let bookmarkAggregate = await User.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(userId) }
    },
    {
      $unwind: "$bookmarkPosts"
    },
    {
      $lookup: {
        from: "posts",
        localField: "bookmarkPosts",
        foreignField: "_id",
        as: "bookmarkPost"
      }
    },
    {
      $unwind: "$bookmarkPost"
    },
    {
      $lookup: {
        from: "users",
        localField: "bookmarkPost.userId",
        foreignField: "_id",
        as: "postCreator"
      }
    },
    {
      $lookup: {
        from: "comments",
        localField: "bookmarkPost._id",
        foreignField: "postId",
        as: "comments"
      }
    },
    {
      $lookup: {
        from: "replies",
        localField: "comments._id",
        foreignField: "commentId",
        as: "commentReplies",
      },
    },
    {
      $addFields: {
        totalComments: {
          $sum: [
            { $size: "$comments" },
            { $size: "$commentReplies" },
          ],
        }
      }
    },
    {
      $lookup: {
        from: "likes",
        let: { postId: "$bookmarkPost._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$itemId", "$$postId"] },
                  { $eq: ["$itemType", "Post"] },
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
      $lookup: {
        from: "friend",
        let: { postCreatorId: "$bookmarkPost.userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$postCreatorId"] },
                  { $eq: ["$friendId", new mongoose.Types.ObjectId(userId)] },
                  { $eq: ["$status", "active"] }
                ]
              }
            }
          }
        ],
        as: "followingToPostCreatorInfo"
      }
    },
    {
      $addFields: {
        isLiked: { $gt: [{ $size: "$userLikeInfo" }, 0] },
        isFollowingToPostCreator: { $gt: [{ $size: "$followingToPostCreatorInfo" }, 0] },
        isBookMarked: true
      }
    },
    {
      $lookup: {
        from: "users",
        let: { mentionPeopleIds: "$bookmarkPost.mentionPeople" }, // Adjusted to pull from bookmarkPost
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
        as: "bookmarkPost.mentionPeopleDetails" // Nested assignment within bookmarkPost
      }
    },
    {
      $project: {
        "bookmarkPost._id": 1,
        "bookmarkPost.userId": 1,
        "bookmarkPost.title": 1,
        "bookmarkPost.description": 1,
        "bookmarkPost.interest": 1,
        "bookmarkPost.postType": 1,
        "bookmarkPost.audienceSelection": 1,
        "bookmarkPost.communityId": 1,
        "bookmarkPost.imagesOrVideos": 1,
        "bookmarkPost.mentionPeopleDetails": 1,
        "bookmarkPost.location": 1,
        "bookmarkPost.hideLikeComments": 1,
        "bookmarkPost.hideLikeAndViewCounts": 1,
        "bookmarkPost.turnOffCommenting": 1,
        "bookmarkPost.makePostAsQuery": 1,
        "bookmarkPost.createdAt": 1,
        "bookmarkPost.likeCount": 1,
        "bookmarkPost.maxMediaRatio": 1,
        "bookmarkPost.postLink": 1,
        totalComments: { $ifNull: ["$totalComments", 0] },
        isLiked: 1,
        isFollowingToPostCreator: 1,
        isBookMarked: 1,
        postCreator: {
          name: { $arrayElemAt: ["$postCreator.name", 0] },
          businessName: { $arrayElemAt: ["$postCreator.businessName", 0] },
          username: { $arrayElemAt: ["$postCreator.username", 0] },
          profileImage: { $arrayElemAt: ["$postCreator.profileImage", 0] },
          accountType: { $arrayElemAt: ["$postCreator.accountType", 0] },
          shortBio: { $arrayElemAt: ["$postCreator.shortBio", 0] },
          occupationTitle: { $arrayElemAt: ["$postCreator.occupationTitle", 0] },
          occupationSector: { $arrayElemAt: ["$postCreator.occupationSector", 0] },
          workExperience: { $arrayElemAt: ["$postCreator.workExperience", 0] },
          description: { $arrayElemAt: ["$postCreator.description", 0] },
          companyName: { $arrayElemAt: ["$postCreator.companyName", 0] },
          expertise: { $arrayElemAt: ["$postCreator.expertise", 0] },
          blueTick: { $arrayElemAt: ["$postCreator.blueTick", 0] }
        }
      }
    }
  ]);

  return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "All bookmarked posts fetched successfully.", {
    bookmarkPosts: bookmarkAggregate
  });
});

const managePostView = async (postId, userId) => {
  try {
    const postViewsDetail = await Post.findById(postId)
      .select("viewCount viewerId")
      .lean();


    if (!postViewsDetail) {
      return { success: false, message: "Post not found" };
    }

    const hasViewed = postViewsDetail.viewerId.some(
      (viewer) => viewer.toString() === userId.toString()
    );

    if (!hasViewed) {

      console.log("hasViewed");
      await Post.findByIdAndUpdate(
        postId,
        {
          $addToSet: { viewerId: userId },
          $inc: { viewCount: 1 },
        },
        { new: true }
      );
      return { success: true, message: "View count updated successfully" };
    } else {
      console.log("DDDDDDD");
      return { success: true, message: "User already viewed this post" };
    }
  } catch (error) {
    console.error("Error managing post view:", error);
    return { success: false, message: "An error occurred" };
  }
};

exports.getParticularPostById = catchAsyncError(async (req, res) => {

  const { postId } = req.query;
  const userId = req.user.id;

  if (!postId) {
    return response.responseHandlerWithData(res, false, statusCode.DATAMISSING, "Post ID is required");
  }

  const postDetails = await Post.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(postId) },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'postCreator',
      }
    },
    {
      $lookup: {
        from: 'comments',
        localField: '_id',
        foreignField: 'postId',
        as: 'comments',
      }
    },
    {
      $lookup: {
        from: "replies",
        localField: "comments._id",
        foreignField: "commentId",
        as: "commentReplies",
      },
    },
    {
      $lookup: {
        from: "likes",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$itemId", "$$postId"] },
                  { $eq: ["$itemType", "Post"] },
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
      $lookup: {
        from: 'users',
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              _id: new mongoose.Types.ObjectId(userId),
            }
          },
          {
            $project: {
              isBookmarked: {
                $in: ["$$postId", "$bookmarkPosts"]
              }
            }
          }
        ],
        as: 'bookmarkInfo'
      }
    },
    {
      $addFields: {
        totalComments: {
          $sum: [
            { $size: "$comments" },
            { $size: "$commentReplies" },
          ],
        },
        isLiked: { $gt: [{ $size: { $ifNull: ["$userLikeInfo", []] } }, 0] }, // Compute if user has liked the post
        isBookMarked: { $arrayElemAt: ["$bookmarkInfo.isBookmarked", 0] } // Get the boolean value for bookmark status
      }
    },
    {
      $project: {
        userId: 1,
        title: 1,
        description: 1,
        imagesOrVideos: 1,
        interest: 1,
        postType: 1,
        audienceSelection: 1,
        createdAt: 1,
        comments: 1,
        likeCount: 1,
        totalComments: { $ifNull: ["$totalComments", 0] },
        isLiked: 1,
        isFollowingToPostCreator: 1,
        isBookMarked: 1,
        shareCount: 1,
        hideLikeAndViewCounts: 1,
        turnOffCommenting: 1,
        maxMediaRatio : 1,
        postLink : 1,
        'postCreator.name': 1,
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
        'postCreator.blueTick': 1
      }
    }
  ]);

  if (postDetails.length === 0) {
    return response.responseHandlerWithData(res, false, statusCode.FORBIDDEN, "Post not found");
  }

  const viewResponse = await managePostView(postId, userId)

  if (!viewResponse.success) {
    return response.responseHandlerWithMessage(res, false, statusCode.FORBIDDEN, viewResponse.message)
  }

  return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Post fetched successfully", postDetails[0]);
});




