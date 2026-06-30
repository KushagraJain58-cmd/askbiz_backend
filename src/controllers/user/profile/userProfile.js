let User = require('../../../models/users');
let Bussiness = require('../../../models/users').Bussiness;
let Expert = require('../../../models/users').Expert;
let Individual = require('../../../models/users').Individual;
let Post = require('../../../models/post');
let bcrypt = require("bcrypt");
let Friend = require('../../../models/follow').Friend;
let FriendRequest = require('../../../models/follow').FriendRequest;
let { catchAsyncError } = require('../../../../utils/constants/generateError')
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes');
let mongoose = require('mongoose');
const { closing } = require('../../../../utils/workers/userBulkNotificationWorker');
let ChatRoom = require('../../../models/chat');
let ChatRequest = require('../../../models/chatRequests')


exports.updateUser = catchAsyncError(async (req, res) => {

  const userId = req.body.userId || req.user.id;

  const { password, ...rest } = req.body;

  const userData = await User.findById(userId).select(['email', 'phoneNumber', 'accountType', 'password']);

  if (!userData) {
    return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User not found")
  }

  const updates = {
    ...rest,
    updatedAt: Date.now(),
  };

  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    updates.password = hashedPassword;
  }

  let userUpdate;

  switch (userData.accountType) {
    case 'Individual':
      userUpdate = await Individual.findByIdAndUpdate(userId, { $set: updates }, { new: true });
      break;
    case 'Bussiness':
      userUpdate = await Bussiness.findByIdAndUpdate(userId, { $set: updates }, { new: true });
      break;
    case 'Expert':
      userUpdate = await Expert.findByIdAndUpdate(userId, { $set: updates }, { new: true });
      break;
    default:
      return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Invalid account type.")
  }

  if (!userUpdate) {
    return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User does not update successfully.")
  }

  return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "User updated successfully", userUpdate)

})


exports.getUserDetails = catchAsyncError(async (req, res) => {

  const userId = req.query.userId || req.user.id;

  const userData = await User.findById(userId).select(['-accessToken', '-deviceToken', '-deviceType', '-hiddenPosts', '-blockedUsers', '-password', '-tokens']).lean();

  if (!userData) {
    return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "User not found")
  }

  const postCount = await Post.countDocuments({ userId, postType: "normal" });
  const totalFollowing = await Friend.countDocuments({ friendId: userId, status: "active" });
  const totalFollower = await Friend.countDocuments({ userId: userId, status: "active" });

  let isFollow = "notFollow";
  let isBlock = false;
  let isMute = false;

  if (req.query.userId && req.query.userId !== "" && req.query.userId.toString() !== req.user.id.toString()) {
    const acceptedFollow = await Friend.findOne({
      userId: req.query.userId,
      friendId: req.user.id,
      status: "active"
    });

    const pendingFollow = !acceptedFollow && await FriendRequest.findOne({
      senderId: req.user.id,
      receiverId: req.query.userId,
      status: "pending"
    });

    if (acceptedFollow) {
      isFollow = "accepted";
    } else if (pendingFollow) {
      isFollow = "requested";
    }

    const loggedInUser = await User.findById(req.user.id).select(['mutedUsers', 'blockedUsers']);

    if (loggedInUser?.mutedUsers?.includes(req.query.userId)) {
      isMute = true;
    }

    if (loggedInUser?.blockedUsers?.includes(req.query.userId)) {
      isBlock = true;
    }

    let participantIds = [req.user.id.toString(), userId.toString()]

    let participantsKey = participantIds.join('-');
    let reverseParticipantsKey = participantIds.reverse().join('-');

    const existingChat = await ChatRoom.findOne({
      type: 'oneToOne',
      $or: [
        { participantsKey: participantsKey },
        { participantsKey: reverseParticipantsKey }
      ]
    }).lean();

    let isMessageReqSent = null;
    let alreadyMessageRequestSent = "notSent";

    if (existingChat) {
      isMessageReqSent = await ChatRequest.findOne({
        senderId: req.user.id,
        receiverId: userId,
        chatRoomId: existingChat._id
      });

      if (isMessageReqSent) {
        alreadyMessageRequestSent = isMessageReqSent.status;
      }
    }

    userData.isFollow = isFollow;
    userData.isMute = isMute;
    userData.isBlock = isBlock;
    userData.participantsKey = existingChat ? existingChat.participantsKey : null
    userData.chatRoomId = existingChat ? existingChat._id : null
    userData.alreadyMessageRequestSent = alreadyMessageRequestSent;

  }


  return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "User data fetched successfully", {
    ...userData,
    postCount,
    totalFollowing,
    totalFollower
  })
})

exports.getAllUsers = catchAsyncError(async (req, res) => {
  const {
    limit = 10,
    pageNo = 1,
    by = "",
    sortBy = "createdAt",
    order = "desc",
    communityId,
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

  if (communityId && communityId != "") {
    matchStage = {
      ...matchStage,
      "communityDetails.communityId": { $ne: new mongoose.Types.ObjectId(communityId) },
    };
  }

  if (by) {
    const searchTerms = by.trim().split(/\s+/);
    matchStage.$or = searchTerms.map(term => ({
      $or: [
        { name: { $regex: term, $options: "i" } },
        { businessName: { $regex: term, $options: "i" } },
        { username: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } }
      ]
    })).flat();
  }


  const usersAggregation = await User.aggregate([
    {
      $lookup: {
        from: "communitymembers", // The collection to join
        localField: "_id", // User ID
        foreignField: "memberId", // Member ID in the CommunityMember collection
        as: "communityDetails", // Output array field
      },
    },
    {
      $match: {
        ...matchStage, // Apply general match criteria
        ...(communityId
          ? {
            // Exclude users already in the community
            "communityDetails.communityId": { $ne: new mongoose.Types.ObjectId(communityId) },
          }
          : {}),
      },
    },
    {
      $lookup: {
        from: "posts",
        localField: "_id",
        foreignField: "userId",
        as: "posts",
      },
    },
    { $addFields: { numberOfPosts: { $size: "$posts" } } },
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
      $lookup: {
        from: "reports",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$status", "active"] },
                  { $eq: ["$reportToUser", "$$userId"] },
                ],
              },
            },
          },
        ],
        as: "reports",
      },
    },
    { $addFields: { numberOfReports: { $size: "$reports" } } },
    {
      $lookup: {
        from: "reports",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$status", "active"] },
                  { $eq: ["$reportSeen", false] },
                  { $eq: ["$reportToUser", "$$userId"] },
                ],
              },
            },
          },
        ],
        as: "unseenReports",
      },
    },
    { $addFields: { unseenReportsCount: { $size: "$unseenReports" } } },
    {
      $sort: {
        [sortBy === "posts"
          ? "numberOfPosts"
          : sortBy === "followers"
            ? "numberOfFollowers"
            : sortBy === "reports"
              ? "numberOfReports"
              : "createdAt"]: sortOrder,
      },
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
      },
    },
  ]);

  const totalCountAggregation = await User.aggregate([
    {
      $lookup: {
        from: "communitymembers", // The collection to join
        localField: "_id", // User ID
        foreignField: "memberId", // Member ID in the CommunityMember collection
        as: "communityDetails", // Output array field
      },
    },
    {
      $match: {
        ...matchStage,
        ...(communityId
          ? {
            "communityDetails.communityId": { $ne: new mongoose.Types.ObjectId(communityId) },
          }
          : {}),
      },
    },
    {
      $count: "totalCount",
    },
  ]);

  const totalCount = totalCountAggregation.length > 0 ? totalCountAggregation[0].totalCount : 0;

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

