let Community = require('../../../models/community');
let CommunityMember = require('../../../models/communityMembers');
let CommunityRequest = require('../../../models/communityRequests');
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes');
const { catchAsyncError } = require('../../../../utils/constants/generateError');
const mongoose = require('mongoose');
let Post = require('../../../models/post');
let Comment = require('../../../models/comment');
let Like = require('../../../models/like');
let Reply = require('../../../models/reply');
let Friend = require('../../../models/follow').Friend;
let FriendRequest = require('../../../models/follow').FriendRequest;
let User = require('../../../models/users')
let Interaction = require('../../../models/interaction');


exports.getCommunitiesGrouped = catchAsyncError(async (req, res) => {
 
  const userId = req.user.id;

  const {
    limit = 10,
    pageNo = 1,
    lookingFor = "all",
    search = ""
  } = req.query;

  const pageLimit = parseInt(limit, 10);
  const page = parseInt(pageNo, 10);
  const offset = pageLimit * (page - 1);

  const matchStages = {
    suggested: {
      $and: [
        { status: "active" },
        {
          members: {
            $not: {
              $elemMatch: {
                memberId: new mongoose.Types.ObjectId(userId),
              },
            },
          },
        },
        {
          memberRequests: {
            $not: {
              $elemMatch: {
                status: "pending",
              },
            },
          },
        },
      ],
    },
    explore: {
      $and: [
        { status: "active" },
        {
          members: {
            $not: {
              $elemMatch: {
                memberId: new mongoose.Types.ObjectId(userId),
              },
            },
          },
        },
        {
          memberRequests: {
            $not: {
              $elemMatch: {
                status: "pending",
              },
            },
          },
        },
      ],
    },
    my: {
      $and: [
        { status: "active" },
        {
          members: {
            $elemMatch: {
              memberId: new mongoose.Types.ObjectId(userId),
              status: "active"
            },
          },
        },
      ],
    },
    joined: {
      $and: [
        { status: "active" },
        {
          members: {
            $elemMatch: {
              memberId: new mongoose.Types.ObjectId(userId),
              status: "active",
              communityRole: "member",
            },
          },
        },
      ],
    },
    managed: {
      $and: [
        { status: "active" },
        {
          members: {
            $elemMatch: {
              memberId: new mongoose.Types.ObjectId(userId),
              communityRole: { $ne: "member" },
            },
          },
        },
      ],
    },
    requested: {
      $and: [
        { status: "active" },
        {
          memberRequests: {
            $elemMatch: {
              "sendBy.id": new mongoose.Types.ObjectId(userId),
              "sendBy.type": "user",
              status: "pending",
            },
          },
        },
      ],
    }
  };

  let aggregationResults = {};

  const fetchGroupData = async (groupName) => {
    const user = await User.findById(userId).lean();
    const userInterests = user?.interest?.flatMap((interest) => interest.value) || [];

    console.log("userInterests",userInterests);

    const recentInteractions = await Interaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("postId", "interest tags communityId postType");  // Populate communityId to know which community the post belongs to

    const interactedInterests = [];

    for (const interaction of recentInteractions) {
      if (interaction.postId.postType === 'community' && interaction.postId.communityId) {
        const community = await Community.findById(interaction.postId.communityId).lean();
        
        const communityInterests = community?.interest?.flatMap((interest) => interest.value) || [];
        
        interactedInterests.push(...communityInterests);
      }
    }

    const groupData = await Community.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "communitymembers",
          localField: "_id",
          foreignField: "communityId",
          as: "members",
        },
      },
      {
        $lookup: {
          from: "communityrequests",
          localField: "_id",
          foreignField: "sendTo.id",
          as: "memberRequests",
        },
      },
      {
        $lookup: {
          from: "posts",
          localField: "_id",
          foreignField: "communityId",
          as: "posts",
        },
      },
      {
        $lookup: {
          from: "comments",
          localField: "posts._id",
          foreignField: "postId",
          as: "comments",
        },
      },
      {
        $addFields: {
          totalMembers: { $size: "$members" },
          totalPosts: { $size: "$posts" },
          totalLikes: { $sum: { $ifNull: ["$posts.likeCount", 0] } },
          totalComments: { $size: "$comments" },
          totalShares: { $sum: { $ifNull: ["$posts.shareCount", 0] } },
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
          interactionMatchScore: {
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
          }
        },
      },
      {
        $addFields: {
          priorityScore: {
            $round: [
              {
                $add: [
                  { $multiply: [{ $ifNull: ["$interactionMatchScore", 0] }, 0.30] }, // 30% for interaction match
                  { $multiply: [{ $ifNull: ["$interestMatchScore", 0] }, 0.25] },     // 25% for interest match
                  { $multiply: [{ $ifNull: ["$totalLikes", 0] }, 0.20] },               // 20% for likes
                  { $multiply: [{ $ifNull: ["$totalComments", 0] }, 0.15] },            // 15% for comments
                  { $multiply: [{ $ifNull: ["$totalShares", 0] }, 0.05] },              // 5% for shares
                  { $multiply: [{ $ifNull: ["$totalMembers", 0] }, 0.05] }, 
                ],
              },
              2,
            ],
          },
        },
      },
      {
        $match: {
          ...matchStages[groupName],
          ...(groupName === "explore" && {
            $expr: {
              $not: {
                $anyElementTrue: {
                  $map: {
                    input: "$interest",
                    as: "communityInterest",
                    in: {
                      $anyElementTrue: {
                        $map: {
                          input: "$$communityInterest.value",
                          as: "communityInterestValue",
                          in: { $in: ["$$communityInterestValue", userInterests] },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          ...(groupName === "suggested" && {
            $expr: {
              $or: [
                {
                  $anyElementTrue: {
                    $map: {
                      input: "$interest",
                      as: "communityInterest",
                      in: {
                        $anyElementTrue: {
                          $map: {
                            input: "$$communityInterest.value",
                            as: "communityInterestValue",
                            in: { $in: ["$$communityInterestValue", interactedInterests] },
                          },
                        },
                      },
                    },
                  },
                },
                {
                  $anyElementTrue: {
                    $map: {
                      input: "$interest",
                      as: "communityInterest",
                      in: {
                        $anyElementTrue: {
                          $map: {
                            input: "$$communityInterest.value",
                            as: "communityInterestValue",
                            in: { $in: ["$$communityInterestValue", userInterests] },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          }),
          $or: [
            { communityName: { $regex: search, $options: "i" } },
            { communityUsername: { $regex: search, $options: "i" } },
          ],
        },
      },
      {
        $sort: { priorityScore: -1 },
      },
      {
        $project: {
          _id: 1,
          communityName: 1,
          communityType: 1,
          totalMembers: 1,
          totalPosts: 1,
          totalLikes: 1,
          totalComments: 1,
          totalShares: 1,
          interestMatchScore: 1,
          priorityScore: 1,
          logo: 1,
          description: 1,
          interactionMatchScore: 1,
          interestMatchScore: 1,
          communityLink : 1
        },
      },
      { $skip: offset },
      { $limit: pageLimit },
    ]);

    for (const community of groupData) {

      const userCommunityMembership = await CommunityMember.findOne({
        communityId: new mongoose.Types.ObjectId(community._id),
        memberId: new mongoose.Types.ObjectId(userId),
      });
    
      const isRequestedToCommunity = await CommunityRequest.findOne({
        sendBy: {
          id: new mongoose.Types.ObjectId(userId),
          type: "user"
        },
        sendTo: {
          id: new mongoose.Types.ObjectId(community._id),
          type: "community"
        },
        status: "pending"
      })
    
      community.joinStatus = userCommunityMembership?.communityRole ? userCommunityMembership?.communityRole : isRequestedToCommunity ? "pending" : "notJoined";

    }

    const totalCountAggregation = await Community.aggregate([
      {
        $lookup: {
          from: "communitymembers",
          localField: "_id",
          foreignField: "communityId",
          as: "members",
        },
      },
      {
        $lookup: {
          from: "communityrequests",
          localField: "_id",
          foreignField: "sendTo.id",
          as: "memberRequests",
        },
      },
      {
        $addFields: {
          totalMembers: { $size: "$members" }, // Count members
        },
      },
      {
        $match: {
          ...matchStages[groupName],
          ...(groupName === "explore" && {
            $expr: {
              $not: {
                $anyElementTrue: {
                  $map: {
                    input: "$interest",
                    as: "communityInterest",
                    in: {
                      $anyElementTrue: {
                        $map: {
                          input: "$$communityInterest.value",
                          as: "communityInterestValue",
                          in: { $in: ["$$communityInterestValue", userInterests] },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          ...(groupName === "suggested" && {
            $expr: {
              $or: [
                {
                  $anyElementTrue: {
                    $map: {
                      input: "$interest",
                      as: "communityInterest",
                      in: {
                        $anyElementTrue: {
                          $map: {
                            input: "$$communityInterest.value",
                            as: "communityInterestValue",
                            in: { $in: ["$$communityInterestValue", interactedInterests] },
                          },
                        },
                      },
                    },
                  },
                },
                {
                  $anyElementTrue: {
                    $map: {
                      input: "$interest",
                      as: "communityInterest",
                      in: {
                        $anyElementTrue: {
                          $map: {
                            input: "$$communityInterest.value",
                            as: "communityInterestValue",
                            in: { $in: ["$$communityInterestValue", userInterests] },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          }),
          $or: [
            { communityName: { $regex: search, $options: "i" } },
            { communityUsername: { $regex: search, $options: "i" } },
          ],
        },
      },
      {
        $count: "totalCount",
      },
    ]);

    const totalCount = totalCountAggregation[0]?.totalCount || 0;
    const totalPages = Math.ceil(totalCount / pageLimit);

    aggregationResults = {
      totalCount,
      totalPages,
      currentPage: page,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      communities: groupData
    };
  };

  const tasks = [];
  const groupsToFetch = lookingFor == "all" ? Object.keys(matchStages) : [lookingFor];

  groupsToFetch.forEach((group) => {
    tasks.push(fetchGroupData(group));
  });

  await Promise.all(tasks);

  return response.responseHandlerWithData(
    res,
    true,
    statusCode.SUCCESS,
    "Communities grouped successfully",
    aggregationResults
  );
});



// exports.getCommunitiesGrouped = catchAsyncError(async (req, res) => {
//   const userId = req.user.id;
//   const {
//     limit = 10,
//     pageNo = 1,
//     lookingFor = "all",
//     search = ""
//   } = req.query;

//   const pageLimit = parseInt(limit, 10);
//   const page = parseInt(pageNo, 10);
//   const offset = pageLimit * (page - 1);

//   const matchStages = {
//     suggested: {
//       $and: [
//         { status: "active" },
//         { "members.memberId": { $ne: new mongoose.Types.ObjectId(userId) } }, // Exclude user's joined communities
//       ],
//     },
//     explore: { status: "active" }, // All active communities
//     my: {
//       userId: new mongoose.Types.ObjectId(userId)
//     },
//     joined: {
//       $and: [
//         { "members.memberId": new mongoose.Types.ObjectId(userId) },
//         { "members.status": "active" },
//         { "members.communityRole": { $nin: ["admin", "moderator"] } },
//       ],
//     },
//     managed: {
//       $and: [
//         { "members.memberId": new mongoose.Types.ObjectId(userId) },
//         { "members.communityRole": { $in: ["admin", "moderator"] } },
//       ]
//     },
//     requested:{
//       $and: [
//         { "members.memberId": new mongoose.Types.ObjectId(userId) },
//         { "members.communityRole": { $in: ["admin", "moderator"] } },
//       ]
//     }
//   };

//   let aggregationResults = {};

//   const fetchGroupData = async (groupName) => {

//     const user = await User.findById(userId).lean();
//     const userInterests = user?.interest?.flatMap((interest) => interest.value) || [];

//     const groupData = await Community.aggregate([
//       {
//         $lookup: {
//           from: "communitymembers",
//           localField: "_id",
//           foreignField: "communityId",
//           as: "members",
//         },
//       },
//       {
//         $lookup: {
//           from: "posts",
//           localField: "_id",
//           foreignField: "communityId",
//           as: "posts",
//         },
//       },
//       {
//         $lookup: {
//           from: "comments",
//           localField: "posts._id",
//           foreignField: "postId",
//           as: "comments",
//         },
//       },
//       {
//         $addFields: {
//           totalMembers: { $size: "$members" },
//           totalPosts: { $size: "$posts" },
//           totalLikes: { $sum: "$posts.likeCount" },
//           totalComments: { $size: "$comments" },
//           totalShares: { $sum: "$posts.shareCount" },
//           interestMatchScore: {
//             $size: {
//               $filter: {
//                 input: { $reduce: { 
//                   input: "$posts.interests",
//                   initialValue: [],
//                   in: { $concatArrays: ["$$value", "$$this.value"] } // Flatten all `value` arrays
//                 }},
//                 as: "flatInterest",
//                 cond: { $in: ["$$flatInterest", userInterests] }, // Match flattened interests against `userInterests`
//               },
//             },
//           },
//           priorityScore: {
//             $add: [
//               { $multiply: ["$totalLikes", 1.5] },
//               { $multiply: ["$totalComments", 1.2] },
//               "$totalShares",
//               "$interestMatchScore",
//               { $multiply: ["$totalMembers", 0.8] },
//             ],
//           },
//           loggedInUserRole: {
//             $arrayElemAt: [
//               {
//                 $filter: {
//                   input: "$members",
//                   as: "member",
//                   cond: { $eq: ["$$member.memberId", new mongoose.Types.ObjectId(userId)] },
//                 },
//               },
//               0,
//             ],
//           },
//         },
//       },
//       {
//         $match: {
//           ...matchStages[groupName],
//           $or: [
//             { communityName: { $regex: search, $options: "i" } },
//             { communityUsername: { $regex: search, $options: "i" } },
//           ],
//         },
//       },
//       {
//         $sort: { priorityScore: -1 }, // Sort by highest priority score
//       },
//       {
//         $project: {
//           _id: 1,
//           communityName: 1,
//           communityType: 1,
//           totalMembers: 1,
//           totalPosts: 1,
//           totalLikes: 1,
//           totalComments: 1,
//           totalShares: 1,
//           interestMatchScore: 1,
//           priorityScore: 1,
//           logo: 1,
//           description: 1,
//           loggedInUserRole: "$loggedInUserRole.communityRole",
//         },
//       },
//       { $skip: offset },
//       { $limit: pageLimit },
//     ]);

//     for (const community of groupData) {
//       const joinRequest = await CommunityRequest.findOne({
//         "sendBy.id": new mongoose.Types.ObjectId(userId),
//         "sendTo.id": new mongoose.Types.ObjectId(community._id),
//         status: "pending"
//       });

//       const isJoined = await CommunityMember.findOne({
//         communityId: new mongoose.Types.ObjectId(community._id),
//         memberId: new mongoose.Types.ObjectId(userId)
//       })

//       if (joinRequest && joinRequest.status === "pending") {
//         community.joinStatus = "pending";
//       } else if (isJoined) {
//         community.joinStatus = "joined";
//       } else {
//         community.joinStatus = "not-joined";
//       }
//     }

//     const totalCountAggregation = await Community.aggregate([
//       {
//         $lookup: {
//           from: "communitymembers",
//           localField: "_id",
//           foreignField: "communityId",
//           as: "members",
//         },
//       },
//       {
//         $addFields: {
//           totalMembers: { $size: "$members" }, // Count members
//         },
//       },
//       {
//         $match: {
//           ...matchStages[groupName],
//           $or: [
//             { communityName: { $regex: search, $options: "i" } },
//             { communityUsername: { $regex: search, $options: "i" } },
//           ],
//         },
//       },
//       {
//         $count: "totalCount",
//       },
//     ]);

//     const totalCount = totalCountAggregation[0]?.totalCount || 0;
//     const totalPages = Math.ceil(totalCount / pageLimit);

//     aggregationResults = {
//       totalCount,
//       totalPages,
//       currentPage: page,
//       nextPage: page < totalPages ? page + 1 : null,
//       prevPage: page > 1 ? page - 1 : null,
//       communities: groupData
//     };
//   };

//   const tasks = [];
//   const groupsToFetch = lookingFor === "all" ? Object.keys(matchStages) : [lookingFor];

//   groupsToFetch.forEach((group) => {
//     tasks.push(fetchGroupData(group));
//   });

//   await Promise.all(tasks);

//   return response.responseHandlerWithData(
//     res,
//     true,
//     statusCode.SUCCESS,
//     "Communities grouped successfully",
//     aggregationResults
//   );
// });

// const groupData = await Community.aggregate([
//   {
//     $lookup: {
//       from: "communitymembers", // Join with CommunityMember collection
//       localField: "_id",
//       foreignField: "communityId",
//       as: "members",
//     },
//   },
//   {
//     $lookup: {
//       from: "posts", // Join with Posts collection
//       localField: "_id",
//       foreignField: "communityId",
//       as: "posts",
//     },
//   },
//   {
//     $addFields: {
//       totalMembers: { $size: "$members" },
//       totalPosts: { $size: "$posts" },
//       loggedInUserRole: {
//         $arrayElemAt: [
//           {
//             $filter: {
//               input: "$members",
//               as: "member",
//               cond: { $eq: ["$$member.memberId", new mongoose.Types.ObjectId(userId)] },
//             },
//           },
//           0,
//         ],
//       },
//     },
//   },
//   {
//     $match: {
//       ...matchStages[groupName],
//       $or: [
//         { communityName: { $regex: search, $options: "i" } }, // Case-insensitive search on communityName
//         { communityUsername: { $regex: search, $options: "i" } }, // Case-insensitive search on communityUsername
//       ],
//     },
//   },
//   {
//     $sort: { totalPosts: -1, totalMembers: -1 }, // Sort by most posts, then most members
//   },
//   {
//     $project: {
//       _id: 1,
//       communityName: 1,
//       communityType: 1,
//       totalMembers: 1,
//       totalPosts: 1,
//       logo: 1,
//       description: 1,
//       loggedInUserRole: "$loggedInUserRole.communityRole"
//     },
//   },
//   { $skip: offset },
//   { $limit: pageLimit },
// ]);


exports.getCommunitiesPostGrouped = catchAsyncError(async (req, res) => {
  const userId = req.user.id;
  const {
    limit = 10,
    pageNo = 1,
    lookingFor,
    search = "",
  } = req.query;

  const pageLimit = parseInt(limit, 10);
  const page = parseInt(pageNo, 10);
  const offset = pageLimit * (page - 1);

  let communityMatch = {};
  if (lookingFor === "my") {
    communityMatch = {
      $and: [
        { 
          community: { 
            $elemMatch: {
              status: "active",
            },
          }
        },
        {
          communityMember: {
            $elemMatch: {
              memberId: new mongoose.Types.ObjectId(userId),
              status: "active",
            },
          },
        }
      ]
    };
  } else if (lookingFor === "explore") {
    communityMatch = {
      $and: [
        {
          community: {
            $elemMatch: {
              status: "active",
              communityType: "public"
            },
          },
        },
        {
          communityMember: {
            $not: {
              $elemMatch: {
                memberId: new mongoose.Types.ObjectId(userId),
              },
            }
          },
        },
        {
          memberRequests: {
            $not: {
              $elemMatch: {
                status: "pending",
              }
            }
          },
        },
      ],
    };
  } else if (lookingFor === "managed") {
    communityMatch = {
      $and: [
        {
          community: {
            $elemMatch: {
              status: "active",
            },
          },
        },
        {
          communityMember: {
            $elemMatch: {
              memberId: new mongoose.Types.ObjectId(userId),
              communityRole: { $ne: "member" },
            },
          },
        },
      ],
    };
  } else if (lookingFor === "joined") {
    communityMatch = {
      $and: [
        {
          community: {
            $elemMatch: {
              status: "active",
            },
          },
        },
        {
          communityMember: {
            $elemMatch: {
              memberId: new mongoose.Types.ObjectId(userId),
              status: "active",
              communityRole: "member",
            },
          },
        },
      ],
    };
  } else if (lookingFor === "suggested") {
    communityMatch = {
      $and: [
        {
          community: {
            $elemMatch: {
              status: "active",
              communityType: "public",
            },
          },
        },
        {
          communityMember: {
            $not: {
              $elemMatch: {
                memberId: new mongoose.Types.ObjectId(userId),
              },
            }
          },
        },
        {
          memberRequests: {
            $not: {
              $elemMatch: {
                status: "pending",
              },
            }
          },
        },
      ]
    };
  } else if (lookingFor === "requested"){
    communityMatch = {
      $and: [
        {
          community: {
            $elemMatch: {
              status: "active",
              communityType: "public",
            },
          },
        },
        {
          memberRequests: {
            $elemMatch: {
              "sendBy.id": new mongoose.Types.ObjectId(userId),
              "sendBy.type": "user",
              status: "pending",
            },
          },
        },
      ],
    };
  }

  const postMatchStage = search
    ? {
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "community.communityName": { $regex: search, $options: "i" } },
      ],
    }
    : {};

  const user = await User.findById(userId).lean();
  const userInterests = user?.interest?.flatMap((interest) => interest.value) || [];

  const recentInteractions = await Interaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("postId", "interest tags communityId postType");  // Populate communityId to know which community the post belongs to

    const interactedInterests = [];

    for (const interaction of recentInteractions) {

      if (interaction.postId.postType === 'community' && interaction.postId.communityId) {
        const community = await Community.findById(interaction.postId.communityId).lean();
        
        const communityInterests = community?.interest?.flatMap((interest) => interest.value) || [];
        
        interactedInterests.push(...communityInterests);
      }
    }

  const postsAggregation = await Post.aggregate([
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
        localField: "community._id",
        foreignField: "communityId",
        as: "communityMember",
      },
    },
    {
      $lookup: {
        from: "communityrequests",
        localField: "community._id",
        foreignField: "sendTo.id",
        as: "memberRequests",
      },
    },
    {
      $match: {
        ...communityMatch,
        ...postMatchStage,
        ...(lookingFor === "explore" && {
          $expr: {
            $not: {
              $anyElementTrue: {
                $map: {
                  input: "$community.interest",
                  as: "communityInterest",
                  in: {
                    $anyElementTrue: {
                      $map: {
                        input: "$$communityInterest.value",
                        as: "communityInterestValue",
                        in: { $in: ["$$communityInterestValue", userInterests] },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        // ...(lookingFor === "suggested" && {
        //   $expr: {
        //     $or: [
        //       {
        //         $anyElementTrue: {
        //           $map: {
        //             input: "$community.interest",
        //             as: "communityInterest",
        //             in: {
        //               $anyElementTrue: {
        //                 $map: {
        //                   input: "$$communityInterest.value",
        //                   as: "communityInterestValue",
        //                   in: { $in: ["$$communityInterestValue", interactedInterests] },
        //                 },
        //               },
        //             },
        //           },
        //         },
        //       },
        //       {
        //         $anyElementTrue: {
        //           $map: {
        //             input: "$community.interest",
        //             as: "communityInterest",
        //             in: {
        //               $anyElementTrue: {
        //                 $map: {
        //                   input: "$$communityInterest.value",
        //                   as: "communityInterestValue",
        //                   in: { $in: ["$$communityInterestValue", userInterests] },
        //                 },
        //               },
        //             },
        //           },
        //         },
        //       },
        //     ],
        //   },
        // })
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
              blueTick: 1
            }
          }
        ]
      }
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
      $addFields: {
        isPinned: {
          $in: ["$_id", { $ifNull: [{ $arrayElemAt: ["$community.pinedPosts", 0] }, []] }]
        },
      },
    },
    {
      $addFields: {
        totalLikes: { $sum: { $ifNull: ["$likeCount", 0] } },
        totalComments: { $sum: [
          { $size: "$comments" },
          { $size: "$commentReplies" },
        ] },
        totalMembers: { $size: { $ifNull: ["$communityMember", []] } },
        totalShares: { $sum: { $ifNull: ["$shareCount", 0] } },
        interestMatchScore: {
          $size: {
            $filter: {
              input: {
                $reduce: {
                  input: "$community.interest",
                  initialValue: [],
                  in: { $concatArrays: ["$$value", "$$this.value"] },
                },
              },
              as: "flatInterest",
              cond: { $in: ["$$flatInterest", userInterests] },
            },
          },
        },
        interactionMatchScore: {
          $size: {
            $filter: {
              input: {
                $reduce: {
                  input: "$community.interest",
                  initialValue: [],
                  in: { $concatArrays: ["$$value", "$$this.value"] },
                },
              },
              as: "flatInterest",
              cond: { $in: ["$$flatInterest", interactedInterests] },
            },
          },
        }
      },
    },
    {
      $addFields: {
        priorityScore: {
          $round: [
            {
              $add: [
                { $multiply: [{ $ifNull: ["$interactionMatchScore", 0] }, 0.30] }, // 30% for interaction match
                { $multiply: [{ $ifNull: ["$interestMatchScore", 0] }, 0.25] },     // 25% for interest match
                { $multiply: [{ $ifNull: ["$totalLikes", 0] }, 0.20] },               // 20% for likes
                { $multiply: [{ $ifNull: ["$totalComments", 0] }, 0.15] },            // 15% for comments
                { $multiply: [{ $ifNull: ["$totalShares", 0] }, 0.05] },              // 5% for shares
                { $multiply: [{ $ifNull: ["$totalMembers", 0] }, 0.05] }, 
              ],
            },
            2,
          ],
        },
      },
    },
    { $sort: { priorityScore: -1 } },
    { $skip: offset },
    { $limit: pageLimit },
    {
      $project: {
        _id: 1,
        title: 1,
        userId : 1,
        description: 1,
        imagesOrVideos: 1,
        turnOffCommenting: 1,
        hideLikeAndViewCounts: 1,
        makePostAsQuery: 1,
        postType: 1,
        createdAt: 1,
        likeCount: 1,
        shareCount: 1,
        community: 1,
        totalMembers: 1,
        postCreator: 1,
        totalComments : 1,
        priorityScore:1,
        isPinned : 1,
        maxMediaRatio : 1,
        postLink : 1
      },
    },
  ]);

  const totalPosts = await Post.aggregate([
    {
      $lookup: {
        from: "communities",
        localField: "communityId",
        foreignField: "_id",
        as: "community",
      },
    },
    { $unwind: "$community" },
    {
      $lookup: {
        from: "communitymembers",
        localField: "community._id",
        foreignField: "communityId",
        as: "community.members",
      },
    },
    {
      $addFields: {
        totalMembers: { $size: "$community.members" },
      },
    },
    {
      $match: {
        ...communityMatch,
        ...postMatchStage,
        ...(lookingFor === "explore" && {
          $expr: {
            $not: {
              $anyElementTrue: {
                $map: {
                  input: "$community.interest",
                  as: "communityInterest",
                  in: {
                    $anyElementTrue: {
                      $map: {
                        input: "$$communityInterest.value",
                        as: "communityInterestValue",
                        in: { $in: ["$$communityInterestValue", userInterests] },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        ...(lookingFor === "suggested" && {
          $expr: {
            $or: [
              {
                $anyElementTrue: {
                  $map: {
                    input: "$community.interest",
                    as: "communityInterest",
                    in: {
                      $anyElementTrue: {
                        $map: {
                          input: "$$communityInterest.value",
                          as: "communityInterestValue",
                          in: { $in: ["$$communityInterestValue", interactedInterests] },
                        },
                      },
                    },
                  },
                },
              },
              {
                $anyElementTrue: {
                  $map: {
                    input: "$community.interest",
                    as: "communityInterest",
                    in: {
                      $anyElementTrue: {
                        $map: {
                          input: "$$communityInterest.value",
                          as: "communityInterestValue",
                          in: { $in: ["$$communityInterestValue", userInterests] },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        })
      },
    },
  ]);

  const totalPostsCount = totalPosts.length;
  const totalPages = Math.ceil(totalPostsCount / pageLimit);

  const updatePostAggregation = await Promise.all(
    postsAggregation.map(async (post) => {
      const isLiked = await Like.exists({
        itemId: post._id,
        itemType: "Post",
        userId,
        isLiked: true,
      });
      const isBookmarked = await User.exists({
        _id: userId,
        bookmarkPosts: post._id,
      });

      const totalLikes = await Like.countDocuments({
        itemId: post._id,
        itemType: "Post",
        isLiked: true,
      });

      const isFollowToPostCreator = await Friend.exists({
        userId: new mongoose.Types.ObjectId(post.userId),
        friendId: userId,
        status: "active",
      });


      const isRequestedToPostCreator = await FriendRequest.exists({
        senderId: new mongoose.Types.ObjectId(userId),
        receiverId: new mongoose.Types.ObjectId(post.userId),
        status : "pending"
      })

      const isFollowPostCreator = isFollowToPostCreator ? "accepted" : isRequestedToPostCreator ? "requested" : "notFollow"

      const userCommunityMembership = await CommunityMember.findOne({
        communityId: new mongoose.Types.ObjectId(post.community[0]._id),
        memberId: new mongoose.Types.ObjectId(userId),
      });
    
      const isRequestedToCommunity = await CommunityRequest.findOne({
        sendBy: {
          id: new mongoose.Types.ObjectId(userId),
          type: "user"
        },
        sendTo: {
          id: new mongoose.Types.ObjectId(post.community[0]._id),
          type: "community"
        },
        status: "pending"
      })

      const userCommunityRole = userCommunityMembership?.communityRole ? userCommunityMembership?.communityRole : isRequestedToCommunity ? "pending" : "notJoined";

      const isMutedCommunity = user?.mutedCommunities.some(
        (id) => id.toString() === post.community[0]._id.toString()
      ) || false;

      const isMutedUser = user?.mutedUsers.some(
        (id) => id.toString() === post.userId.toString()
      ) || false;

      return {
        ...post,
        isFollowPostCreator,
        isLiked: !!isLiked,
        isBookmarked: !!isBookmarked,
        isMutedCommunity,
        isMutedUser,
        // totalComments: totalComments + totalReplies,
        totalLikes,
        userCommunityRole
      };
    })
  );

  const baseUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;
  const nextPage = page < totalPages ? page + 1 : null;
  const prevPage = page > 1 ? page - 1 : null;

  const nextLink = nextPage
    ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&lookingFor=${lookingFor}&search=${search}`
    : null;
  const prevLink = prevPage
    ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&lookingFor=${lookingFor}&search=${search}`
    : null;

  return response.responseHandlerWithData(res, true, 200, "Community posts retrieved successfully", {
    posts: updatePostAggregation,
    currentPage: page,
    totalPages,
    totalPostsCount,
    nextPage,
    prevPage,
    nextLink,
    prevLink,
  });
});



exports.getCommunityDetails = catchAsyncError(async (req, res) => {

  const communityId = req.query.communityId;

  const userId = req.user.id;

  const community = await Community.findOne({ _id: communityId }).lean().select(["-savedPosts", "-mutedMembers"]);

  if (!community) {
    return response.responseHandlerWithMessage(res, false, statusCode.RESULTNOTFOUND, 'Community not found.');
  }

  const communityMembers = await CommunityMember.aggregate([
    {
      $match: {
        communityId: new mongoose.Types.ObjectId(communityId),
        status: "active",
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
      $unwind: "$memberDetails",
    },
    {
      $project: {
        communityRole: 1,
        "memberDetails._id": 1,
        "memberDetails.name": 1,
        "memberDetails.businessName": 1,
        "memberDetails.profileImage": 1,
        "memberDetails.shortBio": 1,
        "memberDetails.description": 1,
        "memberDetails.username": 1,
        "memberDetails.blueTick": 1,
      },
    },
    {
      $group: {
        _id: "$communityRole",
        members: { $push: "$memberDetails" },
      },
    },
  ]);

  console.log("communityMembers--",communityMembers);

  const membersByRole = communityMembers.reduce(
    (acc, item) => {
      acc[item._id] = {
        totalCount: item.members.length,
        members: item.members.slice(0, 5),
      };
      return acc;
    },
    { admin: { totalCount: 0, members: [] }, moderator: { totalCount: 0, members: [] }, member: { totalCount: 0, members: [] } }
  );

  const totalPosts = await Post.countDocuments({
    communityId: new mongoose.Types.ObjectId(communityId),
  });

  const userCommunityMembership = await CommunityMember.findOne({
    communityId: communityId,
    memberId: new mongoose.Types.ObjectId(userId),
  });

  const isRequestedToCommunity = await CommunityRequest.findOne({
    sendBy: {
      id: new mongoose.Types.ObjectId(userId),
      type: "user"
    },
    sendTo: {
      id: new mongoose.Types.ObjectId(communityId),
      type: "community"
    },
    status: "pending"
  })

  const userCommunityRole = userCommunityMembership?.communityRole ? userCommunityMembership?.communityRole : isRequestedToCommunity ? "pending" : "notJoined";

  const user = await User.findById(userId).select(["_id","mutedCommunities"]).lean();
  const isMutedCommunity = user?.mutedCommunities.some(
    (id) => id.toString() === communityId
  ) || false;

  const result = {
    communityDetails: {
      ...community,
      totalPosts,
      totalAdminsCount: membersByRole.admin.totalCount,
      totalModeratorsCount: membersByRole.moderator.totalCount,
      totalMemberCount: membersByRole.member.totalCount,
      totalMembers:
        membersByRole.admin.totalCount +
        membersByRole.moderator.totalCount +
        membersByRole.member.totalCount,
      admins: membersByRole.admin.members,
      moderators: membersByRole.moderator.members,
      members: membersByRole.member.members,
      userCommunityRole: userCommunityRole,
      isMutedCommunity
    },
  };

  return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Community details fetched successfully.", result);
});

// exports.getCommunityPosts = catchAsyncError(async (req, res) => {
//   const userId = req.user.id;

//   const {
//     limit = 10,
//     pageNo = 1,
//     typeOfData = "all", // all, photos, videos
//     search,
//     location,
//     bussinessExpert,
//     bussinessAccount,
//     fromDate,
//     toDate = new Date(),
//     postMadeOn,
//     filterInterests,
//     queryFeed
//   } = req.query;

//   const { communityId } = req.params;

//   const pageLimit = parseInt(limit, 10);
//   const page = parseInt(pageNo, 10);
//   const offset = pageLimit * (page - 1);


//   const blockedUsersByAdmin = await User.find({ status : "blocked" }).lean().select(["_id", "status"])

//   const blockedUsersByAdminIds = blockedUsersByAdmin.map(b => b._id);

//   const blockedUsersInCommunity = await CommunityMember.find({
//     communityId: new mongoose.Types.ObjectId(communityId),
//     status : "block"
//   }).select("_id");
//   const blockedUsersInCommunityIds = blockedUsersInCommunity.map(b => b._id);



//   const postMatchSearch = search
//     ? {
//       $or: [
//         { title: { $regex: search, $options: "i" } },
//         { description: { $regex: search, $options: "i" } }
//       ],
//     }
//     : {};

//   let fileTypeCondition = {};
//   if (typeOfData === "photos") {
//     fileTypeCondition = { "imagesOrVideos.fileType": "image" };
//   } else if (typeOfData === "videos") {
//     fileTypeCondition = { "imagesOrVideos.fileType": "video" };
//   }


//   // work on filter sections

//   let postFilterMatch = {}

// //  Location Filter

//   let filterlocation = [];

//   if (location === '[]') {
//     filterlocation = [];
//   } else if (location) {
//     try {
//       filterlocation = JSON.parse(location)
//         .map(location => ({
//           latitude: parseFloat(location.latitude),  // Ensure latitude is a number and trim spaces
//           longitude: parseFloat(location.longitude), // Ensure longitude is a number and trim spaces
//           name: location.name // Trim spaces around the city name
//         }));
//     } catch (error) {
//       console.error('Error parsing location query:', error.message);
//       return res.status(400).json({ error: 'Invalid location format in query' });
//     }
//   }

//   if (filterlocation.length > 0) {
//     const cityNames = filterlocation.map(location => location.name).filter(Boolean);

//     if (cityNames.length > 0) {
//       postFilterMatch['location.cityName'] = { $in: cityNames };
//     }
//   }

// //  Business, Expert Filter

// let bussinessExpertAccPostIds = [];
//   if (bussinessExpert) {
//     const getExpertAccount = await User.find({ accountType: "Expert" }).select('_id');

//     const ExpertPostIds = await Post.find({ userId: { $in: getExpertAccount.map(account => account._id) } }).select('_id');

//     bussinessExpertAccPostIds = ExpertPostIds.map(post => post._id);
//   }

//   if(bussinessExpert && bussinessExpertAccPostIds.length == 0){
//     return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "No posts found from bussiness expert account", {
//       totalPosts: 0,
//       totalPostsInPage: 0,
//       currentPage: page,
//       totalPages: 0,
//       nextPage: null,
//       prevPage: null,
//       nextLink: null,
//       prevLink: null,
//       posts: []
//     });
//   }

//   let bussinessAccPostIds = [];
//   if (bussinessAccount) {

//     const getBussinessAccount = await User.find({ accountType: "Bussiness" }).select('_id');
//     const bussinessPostIds = await Post.find({ userId: { $in: getBussinessAccount.map(account => account._id) } }).select('_id');
//     bussinessAccPostIds = bussinessPostIds.map(post => post._id);
//   }

//   if(bussinessAccount && bussinessAccPostIds.length == 0){
//     return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "No posts found from bussiness account", {
//       totalPosts: 0,
//       totalPostsInPage: 0,
//       currentPage: page,
//       totalPages: 0,
//       nextPage: null,
//       prevPage: null,
//       nextLink: null,
//       prevLink: null,
//       posts: []
//     });
//   }

//   const expertAndBussinessPosts = [ ...(bussinessExpert && bussinessExpertAccPostIds.length > 0) ? bussinessExpertAccPostIds : [] , ...(bussinessAccount && bussinessAccPostIds.length > 0) ? bussinessAccPostIds : []]

//   // Date Filters

//   if (fromDate && toDate) {
//     const fromDateParsed = new Date(fromDate);
//     const toDateParsed = new Date(toDate);
//     postFilterMatch.createdAt = {
//       $gte: fromDateParsed,
//       $lte: toDateParsed
//     };
//   }

//   switch(postMadeOn){
//     case 'today':
//       postFilterMatch.createdAt = {
//         $gte: new Date(new Date().setHours(0, 0, 0, 0)),
//         $lt: new Date(new Date().setHours(24, 0, 0, 0))
//       };
//       break;
//     case 'weekAgo':
//       postFilterMatch.createdAt = {
//         $gte: new Date(new Date().setDate(new Date().getDate() - 7)),
//         $lt: new Date()
//       };
//       break;
//     case'monthAgo':
//       postFilterMatch.createdAt = {
//         $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
//         $lt: new Date()
//       };
//       break;
//     case 'yearAgo':
//       postFilterMatch.createdAt = {
//         $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
//         $lt: new Date()
//         };
//         break;
//     default: break;
//   }

//   // Interest Filter 

//   let interests = [];

//   if (filterInterests === '[]') {
//     interests = [];
//   } else if (filterInterests){

//     let parsedInterests = filterInterests

//     interests = parsedInterests.map(interest => interest.trim()); 

//   }

//   if (interests.length > 0) {
//     postFilterMatch.interest = {
//       $elemMatch: {
//         value: { $in: interests }
//       }
//     };
//   }

//   if (queryFeed) {
//     postFilterMatch.makePostAsQuery = true;
//   }

//   const commonMatch = {
//     communityId: new mongoose.Types.ObjectId(communityId),
//     userId: { $nin: [...blockedUsersInCommunityIds, ...blockedUsersByAdminIds] },
//   };

//   const filterMatch = {
//     ...(expertAndBussinessPosts.length > 0 && { _id: { $in: expertAndBussinessPosts } }),
//     ...postMatchSearch,
//     ...fileTypeCondition,
//     ...postFilterMatch,
//   }

//   const postsAggregation = await Post.aggregate([
//     {
//       $match: {
//         ...commonMatch,
//         ...filterMatch
//       },
//     },
//     {
//       $lookup: {
//         from: "users",
//         localField: "userId",
//         foreignField: "_id",
//         as: "postCreator",
//         pipeline: [
//           {
//             $project: {
//               _id: 1,
//               name: 1,
//               businessName: 1,
//               profileImage: 1,
//               shortBio: 1,
//               description: 1,
//               username: 1,
//               blueTick: 1,
//             },
//           },
//         ],
//       },
//     },
//     { $sort: { createdAt: -1 } },
//     { $skip: offset },
//     { $limit: pageLimit },
//     {
//       $project: {
//         _id: 1,
//         title: 1,
//         description: 1,
//         imagesOrVideos: 1,
//         turnOffCommenting: 1,
//         hideLikeAndViewCounts: 1,
//         makePostAsQuery: 1,
//         postType: 1,
//         createdAt: 1,
//         likeCount: 1,
//         shareCount: 1,
//         postCreator: 1,
//       },
//     },
//   ]);

//   const totalPosts = await Post.aggregate([
//     {
//       $match: {
//         communityId: new mongoose.Types.ObjectId(communityId),
//         ...postMatchStage,
//         ...fileTypeCondition, // Add fileType filter here
//       },
//     },
//   ]);

//   const totalPostsCount = totalPosts.length;
//   const totalPages = Math.ceil(totalPostsCount / pageLimit);

//   const updatePostAggregation = await Promise.all(
//     postsAggregation.map(async (post) => {
//       const totalComments = await Comment.countDocuments({ postId: post._id });
//       const totalReplies = await Reply.countDocuments({ commentId: post._id });
//       const isLiked = await Like.exists({
//         itemId: post._id,
//         itemType: "Post",
//         userId,
//         isLiked: true,
//       });
//       const isBookmarked = await User.exists({
//         _id: userId,
//         bookmarkPosts: post._id,
//       });
//       const totalLikes = await Like.countDocuments({
//         itemId: post._id,
//         itemType: "Post",
//         isLiked: true,
//       });

//       const isFollowPostCreator = await Friend.exists({
//         userId: new mongoose.Types.ObjectId(post.userId),
//         friendId: userId,
//         status: "active",
//       });

//       return {
//         ...post,
//         isFollowPostCreator: !!isFollowPostCreator,
//         isLiked: !!isLiked,
//         isBookmarked: !!isBookmarked,
//         totalComments: totalComments + totalReplies,
//         totalLikes,
//       };
//     })
//   );

//   const baseUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;
//   const nextPage = page < totalPages ? page + 1 : null;
//   const prevPage = page > 1 ? page - 1 : null;

//   const nextLink = nextPage
//     ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&lookingFor=${lookingFor}&search=${search}`
//     : null;
//   const prevLink = prevPage
//     ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&lookingFor=${lookingFor}&search=${search}`
//     : null;

//   return response.responseHandlerWithData(res, true, 200, "Community posts retrieved successfully", {
//     posts: updatePostAggregation,
//     currentPage: page,
//     totalPages,
//     totalPostsCount,
//     nextPage,
//     prevPage,
//     nextLink,
//     prevLink,
//   });
// });


exports.getCommunityPosts = catchAsyncError(async (req, res) => {
  const userId = req.user.id;
  const {
    limit = 10,
    pageNo = 1,
    typeOfData = "all",
    search,
    location,
    bussinessExpert,
    bussinessAccount,
    fromDate,
    toDate = new Date(),
    postMadeOn,
    filterInterests,
    queryFeed,
  } = req.body;

  const { communityId } = req.params;
  const pageLimit = parseInt(limit, 10);
  const page = parseInt(pageNo, 10);
  const offset = pageLimit * (page - 1);

  const matchFilters = {
    communityId: new mongoose.Types.ObjectId(communityId),
    userId: {
      $nin: await User.distinct("_id", { status: "blocked" }),
    },
  };

  const blockedCommunityUsers = await CommunityMember.distinct("_id", {
    communityId: new mongoose.Types.ObjectId(communityId),
    status: "block",
  });
  matchFilters.userId.$nin.push(...blockedCommunityUsers);

  if (search) {
    matchFilters.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (typeOfData === "photos") matchFilters["imagesOrVideos.fileType"] = "image";
  if (typeOfData === "videos") matchFilters["imagesOrVideos.fileType"] = "video";


  if (location) {
    try {
      const cityNames = location.map((loc) => loc.cityName).filter(Boolean);
      if (cityNames.length) matchFilters["location.cityName"] = { $in: cityNames };
    } catch {
      return response.responseHandlerWithMessage(res, false, 400, "Invalid location format in query");
    }
  }

  if (fromDate || toDate) {
    matchFilters.createdAt = {
      ...(fromDate && { $gte: new Date(fromDate) }),
      ...(toDate && { $lte: new Date(toDate) }),
    };
  }

  const relativeDateFilter = {
    today: { $gte: new Date().setHours(0, 0, 0, 0), $lt: new Date().setHours(24, 0, 0, 0) },
    weekAgo: { $gte: new Date().setDate(new Date().getDate() - 7) },
    monthAgo: { $gte: new Date().setMonth(new Date().getMonth() - 1) },
    yearAgo: { $gte: new Date().setFullYear(new Date().getFullYear() - 1) },
  };
  if (postMadeOn && relativeDateFilter[postMadeOn]) {
    matchFilters.createdAt = relativeDateFilter[postMadeOn];
  }

  if (filterInterests) {
    const interests = filterInterests.map((interest) => interest.trim());
    if (interests.length) matchFilters.interest = { $elemMatch: { value: { $in: interests } } };
  }

  if (queryFeed) matchFilters.makePostAsQuery = true;

  const expertAndBusinessUsers = [];
  if (bussinessExpert) expertAndBusinessUsers.push(...await User.distinct("_id", { accountType: "Expert" }));
  if (bussinessAccount) expertAndBusinessUsers.push(...await User.distinct("_id", { accountType: "Bussiness" }));
  if (expertAndBusinessUsers.length) matchFilters.userId.$in = expertAndBusinessUsers;

  const postsPipeline = [
    { $match: matchFilters },
    {
      $addFields: {
        isPinned: {
          $cond: {
            if: { $in: ["$_id", await Community.distinct("pinedPosts", { _id: new mongoose.Types.ObjectId(communityId) })] },
            then: 1,
            else: 0,
          },
        },
      },
    },
    { $sort: { isPinned : -1, createdAt: -1 } },
    { $skip: offset },
    { $limit: pageLimit },
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
              blueTick: 1
            }
          }
        ],
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
        from: "likes",
        localField: "_id",
        foreignField: "itemId",
        as: "likes",
        pipeline: [{ $match: { itemType: "Post", isLiked: true } }],
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
      }
    },
    {
      $project: {
        title: 1,
        description: 1,
        maxMediaRatio : 1,
        createdAt: 1,
        community: 1,
        imagesOrVideos: 1,
        likeCount: { $size: "$likes" },
        commentCount: { $size: "$comments" },
        postCreator: 1,
        postLink : 1
      },
    },
  ];

  const countPipeline = [{ $count: "total" }];
  const [posts, countResult] = await Promise.all([
    Post.aggregate(postsPipeline),
    Post.aggregate([...postsPipeline.slice(0, 1), ...countPipeline]),
  ]);


  const updatePostAggregation = await Promise.all(
    posts.map(async (post) => {
      const totalComments = await Comment.countDocuments({ postId: post._id });
      const totalReplies = await Reply.countDocuments({ commentId: post._id });
      const isLiked = await Like.exists({
        itemId: post._id,
        itemType: "Post",
        userId,
        isLiked: true,
      });
      const isBookmarked = await User.exists({
        _id: userId,
        bookmarkPosts: post._id,
      });

      const totalLikes = await Like.countDocuments({
        itemId: post._id,
        itemType: "Post",
        isLiked: true,
      });

      const isFollowPostCreator = await Friend.exists({
        userId: new mongoose.Types.ObjectId(post.userId),
        friendId: userId,
        status: "active",
      });

      const isPinned = await Community.exists({
        _id: communityId,
        pinedPosts: new mongoose.Types.ObjectId(post._id)
      });

      const userCommunityMembership = await CommunityMember.findOne({
        communityId: new mongoose.Types.ObjectId(communityId),
        memberId: new mongoose.Types.ObjectId(userId),
      });

      const user = await User.findById(userId).select(["_id","mutedCommunities"]).lean();
      const isMutedCommunity = user?.mutedCommunities?.some(
        (id) => id.toString() === communityId.toString()
      ) || false;
      
      const isMutedUser = user?.mutedUsers?.some(
        (id) => id.toString() === post?.userId?.toString()
      ) || false;

      return {
        ...post,
        isFollowPostCreator: !!isFollowPostCreator,
        isLiked: !!isLiked,
        isBookmarked: !!isBookmarked,
        isPinned : !!isPinned,
        totalComments: totalComments + totalReplies,
        totalLikes,
        userCommunityRole : userCommunityMembership?.communityRole,
        isMutedCommunity,
        isMutedUser
      };
    })
  );


  const totalPostsCount = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalPostsCount / pageLimit);

  return response.responseHandlerWithData(res, true, 200, "Community posts retrieved successfully", {
    updatePostAggregation,
    currentPage: page,
    totalPages,
    totalPostsCount,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  });
});









