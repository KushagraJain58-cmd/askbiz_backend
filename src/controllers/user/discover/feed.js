const mongoose = require("mongoose");
const { catchAsyncError } = require('../../../../utils/constants/generateError');
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes');
const Community = require('../../../models/community');
const User = require('../../../models/users');
const Post = require('../../../models/post');
const Tag = require('../../../models/tags');
const Like = require('../../../models/like');
const { Friend, FriendRequest } = require('../../../models/follow');
const CommunityMember = require("../../../models/communityMembers");
const CommunityRequest = require("../../../models/communityRequests");
const Interest = require("../../../models/interest");
const Interaction = require ("../../../models/interaction");


exports.discoverAccountsAndCommunities = catchAsyncError(async (req, res) => {

    const userId = req.user.id;

    const {
        limit = 5,
        pageNo = 1,
        lookingFor = "all",
        search,
        communityType
    } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);

    const user = await User.findById(userId).lean();
    const userInterests = user?.interest?.flatMap((interest) => interest.value) || [];

    const communityTypeFilter = (typeof communityType === 'string' && ["public", "private"].includes(communityType))
    ? [{ communityType }]
    : [];

    const matchStages = {
        expert: {
            match: {
                status: 'active',
                accountType: 'Expert',
                _id: { $ne: new mongoose.Types.ObjectId(userId) },
            },
            deepMatch: {
                $and: [
                    { "friendConnections": { $size: 0 } },
                    { "pendingRequests": { $size: 0 } }
                ]
            }
        },
        profile: {
            match: {
                status: 'active',
                accountType: {
                    $in : ["Individual","Bussiness"]
                },
                _id: { $ne: new mongoose.Types.ObjectId(userId) },
            },
            deepMatch: {
                $and: [
                    { "friendConnections": { $size: 0 } },
                    { "pendingRequests": { $size: 0 } }
                ]
            }
        },
        individual: {
            match: {
                status: 'active',
                accountType: 'Individual',
                _id: { $ne: new mongoose.Types.ObjectId(userId) },
            },
            deepMatch: {
                $and: [
                    { "friendConnections": { $size: 0 } },
                    { "pendingRequests": { $size: 0 } }
                ]
            }
        },
        bussiness: {
            match: {
                status: 'active',
                accountType: 'Bussiness',
                _id: { $ne: new mongoose.Types.ObjectId(userId) },
            },
            deepMatch: {
                $and: [
                    { "friendConnections": { $size: 0 } },
                    { "pendingRequests": { $size: 0 } }
                ]
            }
        },
        community: {
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
                ...communityTypeFilter
            ],
        }
    };

    const fetchGroupData = async (groupName) => {
        switch (groupName) {
            case 'expert': {
                const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const decayConfig = {
                    periodMs: 31536000000, // 1 year decay
                    baseWeight: 75
                };

                const interactionWeights = {
                    like: 1,
                    comment: 2,
                    share: 3,
                    bookmark: 1.5
                };

                const experts = await User.aggregate([
                    {
                        $geoNear: {
                            near: { type: "Point", coordinates: [user.location.coordinates[0], user.location.coordinates[1]] },
                            distanceField: "distance",
                            spherical: true,
                        },
                    },
                    {
                        $match: {
                            ...matchStages[groupName].match,
                            ...(search && {
                                $or: [
                                    { name: { $regex: search, $options: "i" } },
                                    { businessName: { $regex: search, $options: "i" } },
                                    { username: { $regex: search, $options: "i" } },
                                    { email: { $regex: search, $options: "i" } }
                                ]
                            })
                        }
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { expertId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $or: [
                                                { $and: [{ $eq: ["$userId", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$friendId", "$$expertId"] }] },
                                                { $and: [{ $eq: ["$userId", "$$expertId"] }, { $eq: ["$friendId", new mongoose.Types.ObjectId(userId)] }] },
                                            ],
                                        },
                                    },
                                }
                            ],
                            as: 'friendConnections'
                        }
                    },
                    {
                        $lookup: {
                            from: 'friendrequests',
                            let: { profileId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $and: [{ $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$receiverId", "$$profileId"] }] },
                                        status: 'pending',
                                    },
                                },
                            ],
                            as: 'pendingRequests'
                        }
                    },
                    {
                        $match: matchStages[groupName].deepMatch
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { userId: new mongoose.Types.ObjectId(userId) },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$userId", "$$userId"] },
                                                { $eq: ["$status", "active"] }
                                            ]
                                        }
                                    }
                                },
                                { $project: { friendId: 1 } }
                            ],
                            as: 'userFollowing'
                        }
                    },
                    {
                        $addFields: {
                            followingIds: { $map: { input: "$userFollowing", as: "f", in: "$$f.friendId" } }
                        }
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { expertId: '$_id', followingIds: '$followingIds' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $in: ["$userId", "$$followingIds"] }, // User's followings are the followers
                                                { $eq: ["$friendId", "$$expertId"] }    // They follow the expert
                                            ]
                                        },
                                        status: "active"
                                    }
                                }
                            ],
                            as: 'followingFollowings'
                        }
                    },
                    {
                        $addFields: {
                            mutualConnectionsScore: { $size: "$followingFollowings" }
                        }
                    },
                    {
                        $lookup: {
                            from: "communitymembers",
                            let: { expertId: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$memberId", "$$expertId"] },
                                                { $eq: ["$status", "active"] },
                                            ],
                                        },
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "communitymembers",
                                        let: { communityId: "$communityId" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$communityId", "$$communityId"] },
                                                            { $eq: ["$memberId", new mongoose.Types.ObjectId(userId)] },
                                                            { $eq: ["$status", "active"] },
                                                        ],
                                                    },
                                                },
                                            },
                                        ],
                                        as: "commonCommunity",
                                    },
                                },
                                { $match: { commonCommunity: { $ne: [] } } },
                            ],
                            as: "sharedCommunities",
                        }
                    },
                    {
                        $lookup: {
                            from: "friends",
                            localField: "_id",
                            foreignField: "userId",
                            as: "followers"
                        }
                    },
                    {
                        $lookup: {
                            from: "posts",
                            localField: "_id",
                            foreignField: "userId",
                            as: "totalPosts"
                        }
                    },
                    {
                        $lookup: {
                            from: 'interactions',
                            let: { userId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $eq: ["$userId", "$$userId"] },
                                        status: "active",
                                        createdAt: { $gte: THIRTY_DAYS_AGO }
                                    }
                                },
                                {
                                    $addFields: {
                                        weight: {
                                            $switch: {
                                                branches: [
                                                    { case: { $eq: ["$type", "like"] }, then: interactionWeights.like },
                                                    { case: { $eq: ["$type", "comment"] }, then: interactionWeights.comment },
                                                    { case: { $eq: ["$type", "share"] }, then: interactionWeights.share },
                                                    { case: { $eq: ["$type", "bookmark"] }, then: interactionWeights.bookmark }
                                                ],
                                                default: 0
                                            }
                                        },
                                        interactionAge: {
                                            $divide: [
                                                { $subtract: [new Date(), "$createdAt"] },
                                                86400000 // Convert to days
                                            ]
                                        }
                                    }
                                },
                                {
                                    $group: {
                                        _id: null,
                                        totalEngagement: {
                                            $sum: {
                                                $multiply: [
                                                    "$weight",
                                                    { $exp: { $divide: ["$interactionAge", -30] } }
                                                ]
                                            }
                                        },
                                        lastActivity: { $max: "$createdAt" }
                                    }
                                }
                            ],
                            as: 'engagementData'
                        }
                    },
                    { $unwind: { path: '$engagementData', preserveNullAndEmptyArrays: true } },

                    {
                        $addFields: {
                            lastActive: {
                                $ifNull: [
                                    '$engagementData.lastActivity',
                                    { $ifNull: ['$createdAt', new Date('2000-01-01')] }
                                ]
                            },
                            recencyScore: {
                                $multiply: [
                                    {
                                        $exp: {
                                            $divide: [
                                                {
                                                    $subtract: [
                                                        new Date(),
                                                        { $ifNull: ["$lastActive", new Date('2000-01-01')] }
                                                    ]
                                                },
                                                -decayConfig.periodMs
                                            ]
                                        }
                                    },
                                    decayConfig.baseWeight
                                ]
                            }
                        }
                    },

                    {
                        $addFields: {
                            engagementScore: {
                                $add: [
                                    { $multiply: [{ $ifNull: ["$engagementData.totalEngagement", 0] }, 0.7] },
                                    { $multiply: [{ $size: { $ifNull: ["$followers", []] } }, 0.1] },
                                    { $multiply: [{ $size: { $ifNull: ["$totalPosts", []] } }, 0.05] },
                                    { $multiply: [{ $size: { $ifNull: ["$friendConnections", []] } }, 0.15] }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            freshness: {
                                $switch: {
                                    branches: [
                                        { case: { $gte: ["$recencyScore", 60] }, then: "Very Active" },
                                        { case: { $gte: ["$recencyScore", 40] }, then: "Active" },
                                        { case: { $gte: ["$recencyScore", 20] }, then: "Moderate" }
                                    ],
                                    default: "Low Activity"
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            demographicalAttributesScore: {
                                $add: [
                                    {
                                        $cond: [
                                            { $ne: ["$occupationTitle", null] },
                                            { $cond: [{ $regexMatch: { input: "$occupationTitle", regex: user.occupationTitle, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$occupationSector", null] },
                                            { $cond: [{ $regexMatch: { input: "$occupationSector", regex: user.occupationSector, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$education", null] },
                                            {
                                                $cond: [
                                                    {
                                                        $gt: [
                                                            {
                                                                $size: {
                                                                    $filter: {
                                                                        input: { $ifNull: ["$education", []] },
                                                                        as: "edu",
                                                                        cond: {
                                                                            $in: [
                                                                                { $toString: "$$edu.college" },
                                                                                (user.education || []).map(e => e.college.toString())
                                                                            ]
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    },
                                                    10,
                                                    0
                                                ]
                                            },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$education", null] },
                                            {
                                                $cond: [
                                                    {
                                                        $gt: [
                                                            {
                                                                $size: {
                                                                    $filter: {
                                                                        input: { $ifNull: ["$education", []] },
                                                                        as: "edu",
                                                                        cond: {
                                                                            $in: [
                                                                                { $toString: "$$edu.college" },
                                                                                (user.education || []).map(e => e.college.toString())
                                                                            ]
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    },
                                                    10,
                                                    0
                                                ]
                                            },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$expertise", null] },
                                            { $cond: [{ $regexMatch: { input: "$expertise", regex: user.expertise, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$companyName", null] },
                                            { $cond: [{ $regexMatch: { input: "$companyName", regex: user.companyName, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$businessCategory", null] },
                                            { $cond: [{ $regexMatch: { input: "$businessCategory", regex: user.businessCategory, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$services", null] },
                                            { $cond: [{ $regexMatch: { input: "$services", regex: user.services, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    }
                                ]
                            },
                            commonCommunityScore: { $size: "$sharedCommunities" },
                            accountTypePriorityScore: {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ["$accountType", user.accountType] }, then: 1.2 },
                                        { case: { $ne: ["$accountType", user.accountType] }, then: 0.8 }
                                    ],
                                    default: 1
                                }
                            },
                        }
                    },
                    {
                        $addFields: {
                            suggestionScore: {
                                $add: [
                                    { $multiply: ["$demographicalAttributesScore", 0.25] },
                                    { $multiply: ["$commonCommunityScore", 0.15] },
                                    { $multiply: ["$mutualConnectionsScore", 0.15] },
                                    { $multiply: ["$accountTypePriorityScore", 0.1] },
                                    { $multiply: ["$engagementScore", 0.2] },
                                    { $multiply: ["$recencyScore", 0.1] },
                                    { $multiply: ["$distance", -0.05] }
                                ]
                            }
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
                            profileLink : 1,
                            username: 1,
                            blueTick: 1,
                            coverImage: 1,
                            accountType: 1,
                            friendConnections: 1,
                            freshness: 1,
                            scoreBreakdown: {
                                demographics: { $round: ["$demographicalAttributesScore", 2] },
                                community: { $round: ["$commonCommunityScore", 2] },
                                connections: { $round: ["$mutualConnectionsScore", 2] },
                                engagement: { $round: ["$engagementScore", 2] },
                                recency: { $round: ["$recencyScore", 2] },
                                accountType: { $round: ["$accountTypePriorityScore", 2] },
                                proximity: { $round: ["$distance", 2] }
                            },
                            suggestionScore: 1,
                        },
                    }
                ]);
                return experts.map(item => ({ ...item, groupName: 'expert' }));
            }

            case 'profile': {

                const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const decayConfig = {
                    periodMs: 31536000000,
                    baseWeight: 75
                };

                const interactionWeights = {
                    like: 1,
                    comment: 2,
                    share: 3,
                    bookmark: 1.5
                };

                const profile = await User.aggregate([
                    {
                        $geoNear: {
                            near: { type: "Point", coordinates: [user.location.coordinates[0], user.location.coordinates[1]] },
                            distanceField: "distance",
                            spherical: true,
                        },
                    },
                    {
                        $match: {
                            ...matchStages[groupName].match,
                            ...(search && {
                                $or: [
                                    { name: { $regex: search, $options: "i" } },
                                    { businessName: { $regex: search, $options: "i" } },
                                    { username: { $regex: search, $options: "i" } },
                                    { email: { $regex: search, $options: "i" } }
                                ]
                            })
                        }
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { expertId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $or: [
                                                { $and: [{ $eq: ["$userId", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$friendId", "$$expertId"] }] },
                                                { $and: [{ $eq: ["$userId", "$$expertId"] }, { $eq: ["$friendId", new mongoose.Types.ObjectId(userId)] }] },
                                            ],
                                        },
                                    },
                                }
                            ],
                            as: 'friendConnections'
                        }
                    },
                    {
                        $lookup: {
                            from: 'friendrequests',
                            let: { profileId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $and: [{ $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$receiverId", "$$profileId"] }] },
                                        status: 'pending',
                                    },
                                },
                            ],
                            as: 'pendingRequests'
                        }
                    },
                    {
                        $match: matchStages[groupName].deepMatch
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { userId: new mongoose.Types.ObjectId(userId) },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$userId", "$$userId"] },
                                                { $eq: ["$status", "active"] }
                                            ]
                                        }
                                    }
                                },
                                { $project: { friendId: 1 } }
                            ],
                            as: 'userFollowing'
                        }
                    },
                    {
                        $addFields: {
                            followingIds: { $map: { input: "$userFollowing", as: "f", in: "$$f.friendId" } }
                        }
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { profileId: '$_id', followingIds: '$followingIds' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $in: ["$userId", "$$followingIds"] }, // User's followings are the followers
                                                { $eq: ["$friendId", "$$profileId"] }    // They follow the expert
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: 'followingFollowings'
                        }
                    },
                    {
                        $addFields: {
                            mutualConnectionsScore: {
                                $size: {
                                    $ifNull: ["$followingFollowings", []] // Handle null/undefined cases
                                }
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "communitymembers",
                            let: { profileId: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$memberId", "$$profileId"] },
                                                { $eq: ["$status", "active"] },
                                            ],
                                        },
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "communitymembers",
                                        let: { communityId: "$communityId" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$communityId", "$$communityId"] },
                                                            { $eq: ["$memberId", new mongoose.Types.ObjectId(userId)] },
                                                            { $eq: ["$status", "active"] },
                                                        ],
                                                    },
                                                },
                                            },
                                        ],
                                        as: "commonCommunity",
                                    },
                                },
                                { $match: { commonCommunity: { $ne: [] } } },
                            ],
                            as: "sharedCommunities",
                        },
                    },
                    {
                        $lookup: {
                            from: "friends",
                            localField: "_id",
                            foreignField: "userId",
                            as: "followers"
                        }
                    },
                    {
                        $lookup: {
                            from: "posts",
                            localField: "_id",
                            foreignField: "userId",
                            as: "totalPosts"
                        }
                    },
                    {
                        $lookup: {
                            from: 'interactions',
                            let: { userId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $eq: ["$userId", "$$userId"] },
                                        status: "active",
                                        createdAt: { $gte: THIRTY_DAYS_AGO }
                                    }
                                },
                                {
                                    $addFields: {
                                        weight: {
                                            $switch: {
                                                branches: [
                                                    { case: { $eq: ["$type", "like"] }, then: interactionWeights.like },
                                                    { case: { $eq: ["$type", "comment"] }, then: interactionWeights.comment },
                                                    { case: { $eq: ["$type", "share"] }, then: interactionWeights.share },
                                                    { case: { $eq: ["$type", "bookmark"] }, then: interactionWeights.bookmark }
                                                ],
                                                default: 0
                                            }
                                        },
                                        interactionAge: {
                                            $divide: [
                                                { $subtract: [new Date(), "$createdAt"] },
                                                86400000 // Convert to days
                                            ]
                                        }
                                    }
                                },
                                {
                                    $group: {
                                        _id: null,
                                        totalEngagement: {
                                            $sum: {
                                                $multiply: [
                                                    "$weight",
                                                    { $exp: { $divide: ["$interactionAge", -30] } } // 30-day decay
                                                ]
                                            }
                                        },
                                        lastActivity: { $max: "$createdAt" }
                                    }
                                }
                            ],
                            as: 'engagementData'
                        }
                    },
                    { $unwind: { path: '$engagementData', preserveNullAndEmptyArrays: true } },

                    {
                        $addFields: {
                            lastActive: {
                                $ifNull: [
                                    '$engagementData.lastActivity',
                                    { $ifNull: ['$createdAt', new Date('2000-01-01')] }
                                ]
                            },
                            recencyScore: {
                                $multiply: [
                                    {
                                        $exp: {
                                            $divide: [
                                                {
                                                    $subtract: [
                                                        new Date(),
                                                        { $ifNull: ["$lastActive", new Date('2000-01-01')] }
                                                    ]
                                                },
                                                -decayConfig.periodMs
                                            ]
                                        }
                                    },
                                    decayConfig.baseWeight
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            engagementScore: {
                                $add: [
                                    { $multiply: [{ $ifNull: ["$engagementData.totalEngagement", 0] }, 0.7] },
                                    { $multiply: [{ $size: { $ifNull: ["$followers", []] } }, 0.1] },
                                    { $multiply: [{ $size: { $ifNull: ["$totalPosts", []] } }, 0.05] },
                                    { $multiply: [{ $size: { $ifNull: ["$friendConnections", []] } }, 0.15] }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            freshness: {
                                $switch: {
                                    branches: [
                                        { case: { $gte: ["$recencyScore", 60] }, then: "Very Active" },
                                        { case: { $gte: ["$recencyScore", 40] }, then: "Active" },
                                        { case: { $gte: ["$recencyScore", 20] }, then: "Moderate" }
                                    ],
                                    default: "Low Activity"
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            demographicalAttributesScore: {
                                $add: [
                                    {
                                        $cond: [
                                            { $ne: ["$occupationTitle", null] },
                                            { $cond: [{ $regexMatch: { input: "$occupationTitle", regex: user.occupationTitle, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$occupationSector", null] },
                                            { $cond: [{ $regexMatch: { input: "$occupationSector", regex: user.occupationSector, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$education", null] },
                                            {
                                                $cond: [
                                                    {
                                                        $gt: [
                                                            {
                                                                $size: {
                                                                    $filter: {
                                                                        input: { $ifNull: ["$education", []] },
                                                                        as: "edu",
                                                                        cond: {
                                                                            $in: [
                                                                                { $toString: "$$edu.college" },
                                                                                (user.education || []).map(e => e.college.toString())
                                                                            ]
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    },
                                                    10,
                                                    0
                                                ]
                                            },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$education", null] },
                                            {
                                                $cond: [
                                                    {
                                                        $gt: [
                                                            {
                                                                $size: {
                                                                    $filter: {
                                                                        input: { $ifNull: ["$education", []] },
                                                                        as: "edu",
                                                                        cond: {
                                                                            $in: [
                                                                                { $toString: "$$edu.college" },
                                                                                (user.education || []).map(e => e.college.toString())
                                                                            ]
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    },
                                                    10,
                                                    0
                                                ]
                                            },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$expertise", null] },
                                            { $cond: [{ $regexMatch: { input: "$expertise", regex: user.expertise, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$companyName", null] },
                                            { $cond: [{ $regexMatch: { input: "$companyName", regex: user.companyName, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$businessCategory", null] },
                                            { $cond: [{ $regexMatch: { input: "$businessCategory", regex: user.businessCategory, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$services", null] },
                                            { $cond: [{ $regexMatch: { input: "$services", regex: user.services, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    }
                                ]
                            },
                            commonCommunityScore: { $size: "$sharedCommunities" },
                            accountTypePriorityScore: {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ["$accountType", user.accountType] }, then: 1.2 },
                                        { case: { $ne: ["$accountType", user.accountType] }, then: 0.8 }
                                    ],
                                    default: 1
                                }
                            },
                        }
                    },
                    {
                        $addFields: {
                            suggestionScore: {
                                $add: [
                                    { $multiply: ["$demographicalAttributesScore", 0.25] },
                                    { $multiply: ["$commonCommunityScore", 0.15] },
                                    { $multiply: ["$mutualConnectionsScore", 0.15] },
                                    { $multiply: ["$accountTypePriorityScore", 0.1] },
                                    { $multiply: ["$engagementScore", 0.2] },
                                    { $multiply: ["$recencyScore", 0.1] },
                                    { $multiply: ["$distance", -0.05] }
                                ]
                            }
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
                            blueTick: 1,
                            coverImage: 1,
                            accountType: 1,
                            friendConnections: 1,
                            freshness: 1,
                            profileLink : 1,
                            scoreBreakdown: {
                                demographics: { $round: ["$demographicalAttributesScore", 2] },
                                community: { $round: ["$commonCommunityScore", 2] },
                                connections: { $round: ["$mutualConnectionsScore", 2] },
                                engagement: { $round: ["$engagementScore", 2] },
                                recency: { $round: ["$recencyScore", 2] },
                                accountType: { $round: ["$accountTypePriorityScore", 2] },
                                proximity: { $round: ["$distance", 2] }
                            },
                            suggestionScore: 1,
                        },
                    }
                ]);
                return profile.map(item => ({ ...item, groupName: 'profile' }));
            }

            case 'individual': {

                const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const decayConfig = {
                    periodMs: 31536000000,
                    baseWeight: 75
                };

                const interactionWeights = {
                    like: 1,
                    comment: 2,
                    share: 3,
                    bookmark: 1.5
                };

                const individual = await User.aggregate([
                    {
                        $geoNear: {
                            near: { type: "Point", coordinates: [user.location.coordinates[0], user.location.coordinates[1]] },
                            distanceField: "distance",
                            spherical: true,
                        },
                    },
                    {
                        $match: {
                            ...matchStages[groupName].match,
                            ...(search && {
                                $or: [
                                    { name: { $regex: search, $options: "i" } },
                                    { businessName: { $regex: search, $options: "i" } },
                                    { username: { $regex: search, $options: "i" } },
                                    { email: { $regex: search, $options: "i" } }
                                ]
                            })
                        }
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { expertId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $or: [
                                                { $and: [{ $eq: ["$userId", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$friendId", "$$expertId"] }] },
                                                { $and: [{ $eq: ["$userId", "$$expertId"] }, { $eq: ["$friendId", new mongoose.Types.ObjectId(userId)] }] },
                                            ],
                                        },
                                    },
                                }
                            ],
                            as: 'friendConnections'
                        }
                    },
                    {
                        $lookup: {
                            from: 'friendrequests',
                            let: { profileId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $and: [{ $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$receiverId", "$$profileId"] }] },
                                        status: 'pending',
                                    },
                                },
                            ],
                            as: 'pendingRequests'
                        }
                    },
                    {
                        $match: matchStages[groupName].deepMatch
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { userId: new mongoose.Types.ObjectId(userId) },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$userId", "$$userId"] },
                                                { $eq: ["$status", "active"] }
                                            ]
                                        }
                                    }
                                },
                                { $project: { friendId: 1 } }
                            ],
                            as: 'userFollowing'
                        }
                    },
                    {
                        $addFields: {
                            followingIds: { $map: { input: "$userFollowing", as: "f", in: "$$f.friendId" } }
                        }
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { profileId: '$_id', followingIds: '$followingIds' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $in: ["$userId", "$$followingIds"] }, // User's followings are the followers
                                                { $eq: ["$friendId", "$$profileId"] }    // They follow the expert
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: 'followingFollowings'
                        }
                    },
                    {
                        $addFields: {
                            mutualConnectionsScore: {
                                $size: {
                                    $ifNull: ["$followingFollowings", []] // Handle null/undefined cases
                                }
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "communitymembers",
                            let: { profileId: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$memberId", "$$profileId"] },
                                                { $eq: ["$status", "active"] },
                                            ],
                                        },
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "communitymembers",
                                        let: { communityId: "$communityId" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$communityId", "$$communityId"] },
                                                            { $eq: ["$memberId", new mongoose.Types.ObjectId(userId)] },
                                                            { $eq: ["$status", "active"] },
                                                        ],
                                                    },
                                                },
                                            },
                                        ],
                                        as: "commonCommunity",
                                    },
                                },
                                { $match: { commonCommunity: { $ne: [] } } },
                            ],
                            as: "sharedCommunities",
                        },
                    },
                    {
                        $lookup: {
                            from: "friends",
                            localField: "_id",
                            foreignField: "userId",
                            as: "followers"
                        }
                    },
                    {
                        $lookup: {
                            from: "posts",
                            localField: "_id",
                            foreignField: "userId",
                            as: "totalPosts"
                        }
                    },
                    {
                        $lookup: {
                            from: 'interactions',
                            let: { userId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $eq: ["$userId", "$$userId"] },
                                        status: "active",
                                        createdAt: { $gte: THIRTY_DAYS_AGO }
                                    }
                                },
                                {
                                    $addFields: {
                                        weight: {
                                            $switch: {
                                                branches: [
                                                    { case: { $eq: ["$type", "like"] }, then: interactionWeights.like },
                                                    { case: { $eq: ["$type", "comment"] }, then: interactionWeights.comment },
                                                    { case: { $eq: ["$type", "share"] }, then: interactionWeights.share },
                                                    { case: { $eq: ["$type", "bookmark"] }, then: interactionWeights.bookmark }
                                                ],
                                                default: 0
                                            }
                                        },
                                        interactionAge: {
                                            $divide: [
                                                { $subtract: [new Date(), "$createdAt"] },
                                                86400000 // Convert to days
                                            ]
                                        }
                                    }
                                },
                                {
                                    $group: {
                                        _id: null,
                                        totalEngagement: {
                                            $sum: {
                                                $multiply: [
                                                    "$weight",
                                                    { $exp: { $divide: ["$interactionAge", -30] } } // 30-day decay
                                                ]
                                            }
                                        },
                                        lastActivity: { $max: "$createdAt" }
                                    }
                                }
                            ],
                            as: 'engagementData'
                        }
                    },
                    { $unwind: { path: '$engagementData', preserveNullAndEmptyArrays: true } },

                    {
                        $addFields: {
                            lastActive: {
                                $ifNull: [
                                    '$engagementData.lastActivity',
                                    { $ifNull: ['$createdAt', new Date('2000-01-01')] }
                                ]
                            },
                            recencyScore: {
                                $multiply: [
                                    {
                                        $exp: {
                                            $divide: [
                                                {
                                                    $subtract: [
                                                        new Date(),
                                                        { $ifNull: ["$lastActive", new Date('2000-01-01')] }
                                                    ]
                                                },
                                                -decayConfig.periodMs
                                            ]
                                        }
                                    },
                                    decayConfig.baseWeight
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            engagementScore: {
                                $add: [
                                    { $multiply: [{ $ifNull: ["$engagementData.totalEngagement", 0] }, 0.7] },
                                    { $multiply: [{ $size: { $ifNull: ["$followers", []] } }, 0.1] },
                                    { $multiply: [{ $size: { $ifNull: ["$totalPosts", []] } }, 0.05] },
                                    { $multiply: [{ $size: { $ifNull: ["$friendConnections", []] } }, 0.15] }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            freshness: {
                                $switch: {
                                    branches: [
                                        { case: { $gte: ["$recencyScore", 60] }, then: "Very Active" },
                                        { case: { $gte: ["$recencyScore", 40] }, then: "Active" },
                                        { case: { $gte: ["$recencyScore", 20] }, then: "Moderate" }
                                    ],
                                    default: "Low Activity"
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            demographicalAttributesScore: {
                                $add: [
                                    {
                                        $cond: [
                                            { $ne: ["$occupationTitle", null] },
                                            { $cond: [{ $regexMatch: { input: "$occupationTitle", regex: user.occupationTitle, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$occupationSector", null] },
                                            { $cond: [{ $regexMatch: { input: "$occupationSector", regex: user.occupationSector, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$education", null] },
                                            {
                                                $cond: [
                                                    {
                                                        $gt: [
                                                            {
                                                                $size: {
                                                                    $filter: {
                                                                        input: { $ifNull: ["$education", []] },
                                                                        as: "edu",
                                                                        cond: {
                                                                            $in: [
                                                                                { $toString: "$$edu.college" },
                                                                                (user.education || []).map(e => e.college.toString())
                                                                            ]
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    },
                                                    10,
                                                    0
                                                ]
                                            },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$education", null] },
                                            {
                                                $cond: [
                                                    {
                                                        $gt: [
                                                            {
                                                                $size: {
                                                                    $filter: {
                                                                        input: { $ifNull: ["$education", []] },
                                                                        as: "edu",
                                                                        cond: {
                                                                            $in: [
                                                                                { $toString: "$$edu.college" },
                                                                                (user.education || []).map(e => e.college.toString())
                                                                            ]
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    },
                                                    10,
                                                    0
                                                ]
                                            },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$expertise", null] },
                                            { $cond: [{ $regexMatch: { input: "$expertise", regex: user.expertise, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$companyName", null] },
                                            { $cond: [{ $regexMatch: { input: "$companyName", regex: user.companyName, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$businessCategory", null] },
                                            { $cond: [{ $regexMatch: { input: "$businessCategory", regex: user.businessCategory, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$services", null] },
                                            { $cond: [{ $regexMatch: { input: "$services", regex: user.services, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    }
                                ]
                            },
                            commonCommunityScore: { $size: "$sharedCommunities" },
                            accountTypePriorityScore: {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ["$accountType", user.accountType] }, then: 1.2 },
                                        { case: { $ne: ["$accountType", user.accountType] }, then: 0.8 }
                                    ],
                                    default: 1
                                }
                            },
                        }
                    },
                    {
                        $addFields: {
                            suggestionScore: {
                                $add: [
                                    { $multiply: ["$demographicalAttributesScore", 0.25] },
                                    { $multiply: ["$commonCommunityScore", 0.15] },
                                    { $multiply: ["$mutualConnectionsScore", 0.15] },
                                    { $multiply: ["$accountTypePriorityScore", 0.1] },
                                    { $multiply: ["$engagementScore", 0.2] },
                                    { $multiply: ["$recencyScore", 0.1] },
                                    { $multiply: ["$distance", -0.05] }
                                ]
                            }
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
                            blueTick: 1,
                            coverImage: 1,
                            accountType: 1,
                            friendConnections: 1,
                            freshness: 1,
                            profileLink : 1,
                            scoreBreakdown: {
                                demographics: { $round: ["$demographicalAttributesScore", 2] },
                                community: { $round: ["$commonCommunityScore", 2] },
                                connections: { $round: ["$mutualConnectionsScore", 2] },
                                engagement: { $round: ["$engagementScore", 2] },
                                recency: { $round: ["$recencyScore", 2] },
                                accountType: { $round: ["$accountTypePriorityScore", 2] },
                                proximity: { $round: ["$distance", 2] }
                            },
                            suggestionScore: 1,
                        },
                    }
                ]);
                return individual.map(item => ({ ...item, groupName: 'individual' }));
            }

            case 'bussiness': {

                const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const decayConfig = {
                    periodMs: 31536000000,
                    baseWeight: 75
                };

                const interactionWeights = {
                    like: 1,
                    comment: 2,
                    share: 3,
                    bookmark: 1.5
                };

                const bussiness = await User.aggregate([
                    {
                        $geoNear: {
                            near: { type: "Point", coordinates: [user.location.coordinates[0], user.location.coordinates[1]] },
                            distanceField: "distance",
                            spherical: true,
                        },
                    },
                    {
                        $match: {
                            ...matchStages[groupName].match,
                            ...(search && {
                                $or: [
                                    { name: { $regex: search, $options: "i" } },
                                    { businessName: { $regex: search, $options: "i" } },
                                    { username: { $regex: search, $options: "i" } },
                                    { email: { $regex: search, $options: "i" } }
                                ]
                            })
                        }
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { expertId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $or: [
                                                { $and: [{ $eq: ["$userId", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$friendId", "$$expertId"] }] },
                                                { $and: [{ $eq: ["$userId", "$$expertId"] }, { $eq: ["$friendId", new mongoose.Types.ObjectId(userId)] }] },
                                            ],
                                        },
                                    },
                                }
                            ],
                            as: 'friendConnections'
                        }
                    },
                    {
                        $lookup: {
                            from: 'friendrequests',
                            let: { profileId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $and: [{ $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$receiverId", "$$profileId"] }] },
                                        status: 'pending',
                                    },
                                },
                            ],
                            as: 'pendingRequests'
                        }
                    },
                    {
                        $match: matchStages[groupName].deepMatch
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { userId: new mongoose.Types.ObjectId(userId) },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$userId", "$$userId"] },
                                                { $eq: ["$status", "active"] }
                                            ]
                                        }
                                    }
                                },
                                { $project: { friendId: 1 } }
                            ],
                            as: 'userFollowing'
                        }
                    },
                    {
                        $addFields: {
                            followingIds: { $map: { input: "$userFollowing", as: "f", in: "$$f.friendId" } }
                        }
                    },
                    {
                        $lookup: {
                            from: 'friends',
                            let: { profileId: '$_id', followingIds: '$followingIds' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $in: ["$userId", "$$followingIds"] }, // User's followings are the followers
                                                { $eq: ["$friendId", "$$profileId"] }    // They follow the expert
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: 'followingFollowings'
                        }
                    },
                    {
                        $addFields: {
                            mutualConnectionsScore: {
                                $size: {
                                    $ifNull: ["$followingFollowings", []] // Handle null/undefined cases
                                }
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "communitymembers",
                            let: { profileId: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$memberId", "$$profileId"] },
                                                { $eq: ["$status", "active"] },
                                            ],
                                        },
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "communitymembers",
                                        let: { communityId: "$communityId" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$communityId", "$$communityId"] },
                                                            { $eq: ["$memberId", new mongoose.Types.ObjectId(userId)] },
                                                            { $eq: ["$status", "active"] },
                                                        ],
                                                    },
                                                },
                                            },
                                        ],
                                        as: "commonCommunity",
                                    },
                                },
                                { $match: { commonCommunity: { $ne: [] } } },
                            ],
                            as: "sharedCommunities",
                        },
                    },
                    {
                        $lookup: {
                            from: "friends",
                            localField: "_id",
                            foreignField: "userId",
                            as: "followers"
                        }
                    },
                    {
                        $lookup: {
                            from: "posts",
                            localField: "_id",
                            foreignField: "userId",
                            as: "totalPosts"
                        }
                    },
                    {
                        $lookup: {
                            from: 'interactions',
                            let: { userId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $eq: ["$userId", "$$userId"] },
                                        status: "active",
                                        createdAt: { $gte: THIRTY_DAYS_AGO }
                                    }
                                },
                                {
                                    $addFields: {
                                        weight: {
                                            $switch: {
                                                branches: [
                                                    { case: { $eq: ["$type", "like"] }, then: interactionWeights.like },
                                                    { case: { $eq: ["$type", "comment"] }, then: interactionWeights.comment },
                                                    { case: { $eq: ["$type", "share"] }, then: interactionWeights.share },
                                                    { case: { $eq: ["$type", "bookmark"] }, then: interactionWeights.bookmark }
                                                ],
                                                default: 0
                                            }
                                        },
                                        interactionAge: {
                                            $divide: [
                                                { $subtract: [new Date(), "$createdAt"] },
                                                86400000 // Convert to days
                                            ]
                                        }
                                    }
                                },
                                {
                                    $group: {
                                        _id: null,
                                        totalEngagement: {
                                            $sum: {
                                                $multiply: [
                                                    "$weight",
                                                    { $exp: { $divide: ["$interactionAge", -30] } } // 30-day decay
                                                ]
                                            }
                                        },
                                        lastActivity: { $max: "$createdAt" }
                                    }
                                }
                            ],
                            as: 'engagementData'
                        }
                    },
                    { $unwind: { path: '$engagementData', preserveNullAndEmptyArrays: true } },

                    {
                        $addFields: {
                            lastActive: {
                                $ifNull: [
                                    '$engagementData.lastActivity',
                                    { $ifNull: ['$createdAt', new Date('2000-01-01')] }
                                ]
                            },
                            recencyScore: {
                                $multiply: [
                                    {
                                        $exp: {
                                            $divide: [
                                                {
                                                    $subtract: [
                                                        new Date(),
                                                        { $ifNull: ["$lastActive", new Date('2000-01-01')] }
                                                    ]
                                                },
                                                -decayConfig.periodMs
                                            ]
                                        }
                                    },
                                    decayConfig.baseWeight
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            engagementScore: {
                                $add: [
                                    { $multiply: [{ $ifNull: ["$engagementData.totalEngagement", 0] }, 0.7] },
                                    { $multiply: [{ $size: { $ifNull: ["$followers", []] } }, 0.1] },
                                    { $multiply: [{ $size: { $ifNull: ["$totalPosts", []] } }, 0.05] },
                                    { $multiply: [{ $size: { $ifNull: ["$friendConnections", []] } }, 0.15] }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            freshness: {
                                $switch: {
                                    branches: [
                                        { case: { $gte: ["$recencyScore", 60] }, then: "Very Active" },
                                        { case: { $gte: ["$recencyScore", 40] }, then: "Active" },
                                        { case: { $gte: ["$recencyScore", 20] }, then: "Moderate" }
                                    ],
                                    default: "Low Activity"
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            demographicalAttributesScore: {
                                $add: [
                                    {
                                        $cond: [
                                            { $ne: ["$occupationTitle", null] },
                                            { $cond: [{ $regexMatch: { input: "$occupationTitle", regex: user.occupationTitle, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$occupationSector", null] },
                                            { $cond: [{ $regexMatch: { input: "$occupationSector", regex: user.occupationSector, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$education", null] },
                                            {
                                                $cond: [
                                                    {
                                                        $gt: [
                                                            {
                                                                $size: {
                                                                    $filter: {
                                                                        input: { $ifNull: ["$education", []] },
                                                                        as: "edu",
                                                                        cond: {
                                                                            $in: [
                                                                                { $toString: "$$edu.college" },
                                                                                (user.education || []).map(e => e.college.toString())
                                                                            ]
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    },
                                                    10,
                                                    0
                                                ]
                                            },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$education", null] },
                                            {
                                                $cond: [
                                                    {
                                                        $gt: [
                                                            {
                                                                $size: {
                                                                    $filter: {
                                                                        input: { $ifNull: ["$education", []] },
                                                                        as: "edu",
                                                                        cond: {
                                                                            $in: [
                                                                                { $toString: "$$edu.college" },
                                                                                (user.education || []).map(e => e.college.toString())
                                                                            ]
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    },
                                                    10,
                                                    0
                                                ]
                                            },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$expertise", null] },
                                            { $cond: [{ $regexMatch: { input: "$expertise", regex: user.expertise, options: "i" } }, 20, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$companyName", null] },
                                            { $cond: [{ $regexMatch: { input: "$companyName", regex: user.companyName, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$businessCategory", null] },
                                            { $cond: [{ $regexMatch: { input: "$businessCategory", regex: user.businessCategory, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $ne: ["$services", null] },
                                            { $cond: [{ $regexMatch: { input: "$services", regex: user.services, options: "i" } }, 10, 0] },
                                            0
                                        ]
                                    }
                                ]
                            },
                            commonCommunityScore: { $size: "$sharedCommunities" },
                            accountTypePriorityScore: {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ["$accountType", user.accountType] }, then: 1.2 },
                                        { case: { $ne: ["$accountType", user.accountType] }, then: 0.8 }
                                    ],
                                    default: 1
                                }
                            },
                        }
                    },
                    {
                        $addFields: {
                            suggestionScore: {
                                $add: [
                                    { $multiply: ["$demographicalAttributesScore", 0.25] },
                                    { $multiply: ["$commonCommunityScore", 0.15] },
                                    { $multiply: ["$mutualConnectionsScore", 0.15] },
                                    { $multiply: ["$accountTypePriorityScore", 0.1] },
                                    { $multiply: ["$engagementScore", 0.2] },
                                    { $multiply: ["$recencyScore", 0.1] },
                                    { $multiply: ["$distance", -0.05] }
                                ]
                            }
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
                            blueTick: 1,
                            coverImage: 1,
                            accountType: 1,
                            friendConnections: 1,
                            freshness: 1,
                            profileLink : 1,
                            scoreBreakdown: {
                                demographics: { $round: ["$demographicalAttributesScore", 2] },
                                community: { $round: ["$commonCommunityScore", 2] },
                                connections: { $round: ["$mutualConnectionsScore", 2] },
                                engagement: { $round: ["$engagementScore", 2] },
                                recency: { $round: ["$recencyScore", 2] },
                                accountType: { $round: ["$accountTypePriorityScore", 2] },
                                proximity: { $round: ["$distance", 2] }
                            },
                            suggestionScore: 1,
                        },
                    }
                ]);
                return bussiness.map(item => ({ ...item, groupName: 'bussiness' }));
            }

            case 'community': {

                const user = await User.findById(userId).lean();
                const userInterests = user?.interest?.flatMap((interest) => interest.value) || [];

                const recentInteractions = await Interaction.find({ userId })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .populate("postId", "interest tags communityId postType");

                const interactedInterests = [];

                for (const interaction of recentInteractions) {
                    if (interaction.postId.postType === 'community' && interaction.postId.communityId) {

                        const community = await Community.findById(interaction.postId.communityId).lean();

                        const communityInterests = community?.interest?.flatMap((interest) => interest.value) || [];

                        interactedInterests.push(...communityInterests);

                    }else if(interaction.postId.postType === 'normal'){

                        const postInterests = interaction.postId.interest.flatMap((interest) => interest.value) || [];
                        interactedInterests.push(...postInterests);
                    }
                }

                    const communities = await Community.aggregate([
                        {
                            $match: {
                                ...(search && {
                                    $or: [
                                        { communityName: { $regex: search, $options: "i" } },
                                        { communityUsername: { $regex: search, $options: "i" } },
                                        { "location.cityName": { $regex: search, $options: "i" } },
                                    ]
                                }),
                                ...{
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
                                  }
                            }
                        },
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
                            $match: {
                                ...matchStages[groupName]
                            }
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
                                }
                            },
                        },
                        {
                            $addFields: {
                                suggestionScore: {
                                    $round: [
                                        {
                                            $add: [
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
                                coverImage: 1,
                                description: 1,
                                suggestionScore: 1,
                                communityLink : 1
                            },
                        }
                    ]);
                    return await Promise.all(
                        communities.map(async (item) => {

                            const userCommunityMembership = await CommunityMember.findOne({
                                communityId: new mongoose.Types.ObjectId(item._id),
                                memberId: new mongoose.Types.ObjectId(userId),
                            });

                            const isRequestedToCommunity = await CommunityRequest.findOne({
                                sendBy: {
                                    id: new mongoose.Types.ObjectId(userId),
                                    type: "user",
                                },
                                sendTo: {
                                    id: new mongoose.Types.ObjectId(item._id),
                                    type: "community",
                                },
                                status: "pending",
                            });

                            const userCommunityRole = userCommunityMembership?.communityRole
                                ? userCommunityMembership.communityRole
                                : isRequestedToCommunity
                                    ? "pending"
                                    : "notJoined";

                            console.log("userCommunityRole", userCommunityRole);

                            return { ...item, userCommunityRole, groupName: "community" };
                        })
                    );
                }
            default:
                return [];
        }
    };

    let allResults = {};

    const tasks = [];
    const groupsToFetch = lookingFor === 'all' ? Object.keys(matchStages) : [lookingFor];


    for (const group of groupsToFetch) {
        tasks.push(fetchGroupData(group));
    }

    const groupResults = await Promise.all(tasks);

    groupsToFetch.forEach((groupName, index) => {
        const groupData = groupResults[index];

        groupData.sort((a, b) => b.suggestionScore - a.suggestionScore);

        const totalCount = groupData.length;
        const totalPages = Math.ceil(totalCount / pageLimit);
        const paginatedResults = groupData.slice(offset, offset + pageLimit);

        allResults[groupName] = {
            totalCount,
            totalPages,
            currentPage: page,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
            results: paginatedResults,
        };
    });

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Discover content grouped and paginated successfully",
        allResults
    );

});


// exports.discoverAccountsAndCommunities = catchAsyncError(async (req, res) => {
//     const userId = req.user.id;

//     const {
//         limit = 5,
//         pageNo = 1,
//         lookingFor = "all",
//         search
//     } = req.query;

//     const pageLimit = parseInt(limit, 10);
//     const page = parseInt(pageNo, 10);
//     const offset = pageLimit * (page - 1);

//     const user = await User.findById(userId).lean();
//     const userInterests = user?.interest?.flatMap((interest) => interest.value) || [];

//     const matchStages = {
//         expert: {
//             match: {
//                 status: 'active',
//                 accountType: 'Expert',
//                 _id: { $ne: new mongoose.Types.ObjectId(userId) },
//             },
//             deepMatch: {
//                 $and: [
//                     { "friendConnections": { $size: 0 } },
//                     { "pendingRequests": { $size: 0 } }
//                 ]
//             }
//         },
//         // profile: {
//         //     match: {
//         //         status: 'active',
//         //         $or: [
//         //             { "accountType": "Individual" },
//         //             { "accountType": "Bussiness" }
//         //         ],
//         //         _id: { $ne: new mongoose.Types.ObjectId(userId) },
//         //     },
//         //     deepMatch: {
//         //         $and: [
//         //             { "friendConnections": { $size: 0 } },
//         //             { "pendingRequests": { $size: 0 } }
//         //         ]
//         //     }
//         // },
//         // community: {
//         //     $and: [
//         //         { status: "active" },
//         //         {
//         //             members: {
//         //                 $not: {
//         //                     $elemMatch: {
//         //                         memberId: new mongoose.Types.ObjectId(userId),
//         //                     },
//         //                 },
//         //             },
//         //         },
//         //         {
//         //             memberRequests: {
//         //                 $not: {
//         //                     $elemMatch: {
//         //                         status: "pending",
//         //                     },
//         //                 },
//         //             },
//         //         },
//         //     ],
//         // }
//     };

//     const fetchGroupData = async (groupName) => {

//         switch (groupName) {
//             case 'expert': {
//                 const relevantExperts = await fetchRelevantExperts(user, userId, search, matchStages[groupName]);
//                 const nonRelevantExperts = await fetchNonRelevantExperts(user, userId, search, matchStages[groupName]);
//                 const combinedExperts = combineAndShuffle(relevantExperts, nonRelevantExperts, limit);
//                 return combinedExperts.map(item => ({ ...item, groupName: 'expert' }));
//             }
//             default:
//                 return [];
//         }
//     };

//     const fetchRelevantExperts = async (user, userId, search, matchStage) => {
//         // Your existing logic to fetch relevant experts

//         const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
//         const decayConfig = {
//             periodMs: 31536000000, // 1 year decay
//             baseWeight: 75
//         };

//         const interactionWeights = {
//             like: 1,
//             comment: 2,
//             share: 3,
//             bookmark: 1.5
//         };

//         const relevantExperts = await User.aggregate([
//             {
//                 $geoNear: {
//                     near: { type: "Point", coordinates: [user.location.coordinates[0], user.location.coordinates[1]] },
//                     distanceField: "distance",
//                     spherical: true,
//                 },
//             },
//             {
//                 $match: {
//                     ...matchStage.match,
//                     ...(search && {
//                         $or: [
//                             { name: { $regex: search, $options: "i" } },
//                             { businessName: { $regex: search, $options: "i" } },
//                             { username: { $regex: search, $options: "i" } },
//                             { email: { $regex: search, $options: "i" } }
//                         ]
//                     })
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'friends',
//                     let: { expertId: '$_id' },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: {
//                                     $or: [
//                                         { $and: [{ $eq: ["$userId", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$friendId", "$$expertId"] }] },
//                                         { $and: [{ $eq: ["$userId", "$$expertId"] }, { $eq: ["$friendId", new mongoose.Types.ObjectId(userId)] }] },
//                                     ],
//                                 },
//                             },
//                         }
//                     ],
//                     as: 'friendConnections'
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'friendrequests',
//                     let: { profileId: '$_id' },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: { $and: [{ $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$receiverId", "$$profileId"] }] },
//                                 status: 'pending',
//                             },
//                         },
//                     ],
//                     as: 'pendingRequests'
//                 }
//             },
//             {
//                 $match: matchStage.deepMatch
//             },
//             {
//                 $lookup: {
//                     from: 'friends',
//                     let: { userId: new mongoose.Types.ObjectId(userId) },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: {
//                                     $and: [
//                                         { $eq: ["$userId", "$$userId"] },
//                                         { $eq: ["$status", "active"] }
//                                     ]
//                                 }
//                             }
//                         },
//                         { $project: { friendId: 1 } }
//                     ],
//                     as: 'userFollowing'
//                 }
//             },
//             {
//                 $addFields: {
//                     followingIds: { $map: { input: "$userFollowing", as: "f", in: "$$f.friendId" } }
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'friends',
//                     let: { expertId: '$_id', followingIds: '$followingIds' },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: {
//                                     $and: [
//                                         { $in: ["$userId", "$$followingIds"] }, // User's followings are the followers
//                                         { $eq: ["$friendId", "$$expertId"] }    // They follow the expert
//                                     ]
//                                 },
//                                 status: "active"
//                             }
//                         }
//                     ],
//                     as: 'followingFollowings'
//                 }
//             },
//             {
//                 $addFields: {
//                     mutualConnectionsScore: { $size: "$followingFollowings" }
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "communitymembers",
//                     let: { expertId: "$_id" },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: {
//                                     $and: [
//                                         { $eq: ["$memberId", "$$expertId"] },
//                                         { $eq: ["$status", "active"] },
//                                     ],
//                                 },
//                             },
//                         },
//                         {
//                             $lookup: {
//                                 from: "communitymembers",
//                                 let: { communityId: "$communityId" },
//                                 pipeline: [
//                                     {
//                                         $match: {
//                                             $expr: {
//                                                 $and: [
//                                                     { $eq: ["$communityId", "$$communityId"] },
//                                                     { $eq: ["$memberId", new mongoose.Types.ObjectId(userId)] },
//                                                     { $eq: ["$status", "active"] },
//                                                 ],
//                                             },
//                                         },
//                                     },
//                                 ],
//                                 as: "commonCommunity",
//                             },
//                         },
//                         { $match: { commonCommunity: { $ne: [] } } },
//                     ],
//                     as: "sharedCommunities",
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "friends",
//                     localField: "_id",
//                     foreignField: "userId",
//                     as: "followers"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "posts",
//                     localField: "_id",
//                     foreignField: "userId",
//                     as: "totalPosts"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'interactions',
//                     let: { userId: '$_id' },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: { $eq: ["$userId", "$$userId"] },
//                                 status: "active",
//                                 createdAt: { $gte: THIRTY_DAYS_AGO }
//                             }
//                         },
//                         {
//                             $addFields: {
//                                 weight: {
//                                     $switch: {
//                                         branches: [
//                                             { case: { $eq: ["$type", "like"] }, then: interactionWeights.like },
//                                             { case: { $eq: ["$type", "comment"] }, then: interactionWeights.comment },
//                                             { case: { $eq: ["$type", "share"] }, then: interactionWeights.share },
//                                             { case: { $eq: ["$type", "bookmark"] }, then: interactionWeights.bookmark }
//                                         ],
//                                         default: 0
//                                     }
//                                 },
//                                 interactionAge: {
//                                     $divide: [
//                                         { $subtract: [new Date(), "$createdAt"] },
//                                         86400000 // Convert to days
//                                     ]
//                                 }
//                             }
//                         },
//                         {
//                             $group: {
//                                 _id: null,
//                                 totalEngagement: { 
//                                     $sum: { 
//                                         $multiply: [
//                                             "$weight",
//                                             { $exp: { $divide: ["$interactionAge", -30] } }
//                                         ] 
//                                     } 
//                                 },
//                                 lastActivity: { $max: "$createdAt" }
//                             }
//                         }
//                     ],
//                     as: 'engagementData'
//                 }
//             },
//             { $unwind: { path: '$engagementData', preserveNullAndEmptyArrays: true } },

//             {
//                 $addFields: {
//                     lastActive: {
//                         $ifNull: [
//                             '$engagementData.lastActivity',
//                             { $ifNull: ['$createdAt', new Date('2000-01-01')] }
//                         ]
//                     },
//                     recencyScore: {
//                         $multiply: [
//                             {
//                                 $exp: {
//                                     $divide: [
//                                         { 
//                                             $subtract: [ 
//                                                 new Date(), 
//                                                 { $ifNull: ["$lastActive", new Date('2000-01-01')] }
//                                             ] 
//                                         },
//                                         -decayConfig.periodMs
//                                     ]
//                                 }
//                             },
//                             decayConfig.baseWeight
//                         ]
//                     }
//                 }
//             },

//             // Engagement Calculation
//             {
//                 $addFields: {
//                     engagementScore: {
//                         $add: [
//                             { $multiply: [{ $ifNull: ["$engagementData.totalEngagement", 0] }, 0.7] },
//                             { $multiply: [{ $size: { $ifNull: ["$followers", []] } }, 0.1] },
//                             { $multiply: [{ $size: { $ifNull: ["$totalPosts", []] } }, 0.05] },
//                             { $multiply: [{ $size: { $ifNull: ["$friendConnections", []] } }, 0.15] }
//                         ]
//                     }
//                 }
//             },
//             // Add Freshness Indicator
//             {
//                 $addFields: {
//                     freshness: {
//                         $switch: {
//                             branches: [
//                                 { case: { $gte: ["$recencyScore", 60] }, then: "Very Active" },
//                                 { case: { $gte: ["$recencyScore", 40] }, then: "Active" },
//                                 { case: { $gte: ["$recencyScore", 20] }, then: "Moderate" }
//                             ],
//                             default: "Low Activity"
//                         }
//                     }
//                 }
//             },
//             {
//                 $addFields: {
//                     demographicalAttributesScore: {
//                         $add: [
//                             {
//                                 $cond: [
//                                     { $ne: ["$occupationTitle", null] },
//                                     { $cond: [{ $regexMatch: { input: "$occupationTitle", regex: user.occupationTitle, options: "i" } }, 20, 0] },
//                                     0
//                                 ]
//                             },
//                             {
//                                 $cond: [
//                                     { $ne: ["$occupationSector", null] },
//                                     { $cond: [{ $regexMatch: { input: "$occupationSector", regex: user.occupationSector, options: "i" } }, 20, 0] },
//                                     0
//                                 ]
//                             },
//                             {
//                                 $cond: [
//                                     { $ne: ["$education", null] },
//                                     {
//                                         $cond: [
//                                             {
//                                                 $gt: [
//                                                     {
//                                                         $size: {
//                                                             $filter: {
//                                                                 input: { $ifNull: ["$education", []] },
//                                                                 as: "edu",
//                                                                 cond: {
//                                                                     $in: [
//                                                                         { $toString: "$$edu.college" },
//                                                                         (user.education || []).map(e => e.college.toString())
//                                                                     ]
//                                                                 }
//                                                             }
//                                                         }
//                                                     },
//                                                     0
//                                                 ]
//                                             },
//                                             10,
//                                             0
//                                         ]
//                                     },
//                                     0
//                                 ]
//                             },
//                             {
//                                 $cond: [
//                                     { $ne: ["$education", null] },
//                                     {
//                                         $cond: [
//                                             {
//                                                 $gt: [
//                                                     {
//                                                         $size: {
//                                                             $filter: {
//                                                                 input: { $ifNull: ["$education", []] },
//                                                                 as: "edu",
//                                                                 cond: {
//                                                                     $in: [
//                                                                         { $toString: "$$edu.college" },
//                                                                         (user.education || []).map(e => e.college.toString())
//                                                                     ]
//                                                                 }
//                                                             }
//                                                         }
//                                                     },
//                                                     0
//                                                 ]
//                                             },
//                                             10,
//                                             0
//                                         ]
//                                     },
//                                     0
//                                 ]
//                             },
//                             {
//                                 $cond: [
//                                     { $ne: ["$expertise", null] },
//                                     { $cond: [{ $regexMatch: { input: "$expertise", regex: user.expertise, options: "i" } }, 20, 0] },
//                                     0
//                                 ]
//                             },
//                             {
//                                 $cond: [
//                                     { $ne: ["$companyName", null] },
//                                     { $cond: [{ $regexMatch: { input: "$companyName", regex: user.companyName, options: "i" } }, 10, 0] },
//                                     0
//                                 ]
//                             },
//                             {
//                                 $cond: [
//                                     { $ne: ["$businessCategory", null] },
//                                     { $cond: [{ $regexMatch: { input: "$businessCategory", regex: user.businessCategory, options: "i" } }, 10, 0] },
//                                     0
//                                 ]
//                             },
//                             {
//                                 $cond: [
//                                     { $ne: ["$services", null] },
//                                     { $cond: [{ $regexMatch: { input: "$services", regex: user.services, options: "i" } }, 10, 0] },
//                                     0
//                                 ]
//                             }
//                         ]
//                     },
//                     commonCommunityScore: { $size: "$sharedCommunities" },
//                     accountTypePriorityScore: {
//                         $switch: {
//                             branches: [
//                                 { case: { $eq: ["$accountType", user.accountType] }, then: 1.2 },
//                                 { case: { $ne: ["$accountType", user.accountType] }, then: 0.8 }
//                             ],
//                             default: 1
//                         }
//                     },
//                 }
//             },
//             // Update Suggestion Score Calculation
//             {
//                 $addFields: {
//                     suggestionScore: {
//                         $add: [
//                             { $multiply: ["$demographicalAttributesScore", 0.25] },
//                             { $multiply: ["$commonCommunityScore", 0.15] },
//                             { $multiply: ["$mutualConnectionsScore", 0.15] },
//                             { $multiply: ["$accountTypePriorityScore", 0.1] },
//                             { $multiply: ["$engagementScore", 0.2] },
//                             { $multiply: ["$recencyScore", 0.1] },
//                             { $multiply: ["$distance", -0.05] }
//                         ]
//                     }
//                 }
//             },
//             {
//                 $project: {
//                     _id: 1,
//                     name: 1,
//                     businessName: 1,
//                     profileImage: 1,
//                     shortBio: 1,
//                     description: 1,
//                     username: 1,
//                     blueTick: 1,
//                     coverImage: 1,
//                     accountType: 1,
//                     friendConnections: 1,
//                     freshness : 1,
//                     scoreBreakdown: {
//                         demographics: { $round: ["$demographicalAttributesScore", 2] },
//                         community: { $round: ["$commonCommunityScore", 2] },
//                         connections: { $round: ["$mutualConnectionsScore", 2] },
//                         engagement: { $round: ["$engagementScore", 2] },
//                         recency: { $round: ["$recencyScore", 2] },
//                         accountType: { $round: ["$accountTypePriorityScore", 2] },
//                         proximity: { $round: ["$distance", 2] }
//                     },
//                     suggestionScore : 1,
//                 },
//             }
//         ]);

//         return relevantExperts;

//     };

//     const fetchNonRelevantExperts = async (user, userId, search, matchStage) => {
//         // Logic to fetch non-relevant experts
//         const nonRelevantExperts = await User.aggregate([
//             {
//                 $match: {
//                     status: 'active',
//                     accountType: 'Expert',
//                     _id: { $ne: new mongoose.Types.ObjectId(userId) },
//                     ...(search && {
//                         $or: [
//                             { name: { $regex: search, $options: "i" } },
//                             { businessName: { $regex: search, $options: "i" } },
//                             { username: { $regex: search, $options: "i" } },
//                             { email: { $regex: search, $options: "i" } }
//                         ]
//                     })
//                 }
//             },
//             { $sample: { limit: 10 } } // Adjust the size as needed
//         ]);
//         return nonRelevantExperts;
//     };

//     const combineAndShuffle = (relevantData, nonRelevantData, limit) => {
//         const relevantCount = Math.floor(limit * 0.7); 
//         const nonRelevantCount = limit - relevantCount;

//         console.log("relevantCount",relevantCount);
//         console.log("nonRelevantCount",nonRelevantCount);


//         const combinedData = [
//             ...relevantData.slice(0, relevantCount),
//             ...nonRelevantData.slice(0, nonRelevantCount)
//         ];

//         for (let i = combinedData.length - 1; i > 0; i--) {
//             const j = Math.floor(Math.random() * (i + 1));
//             [combinedData[i], combinedData[j]] = [combinedData[j], combinedData[i]];
//         }

//         return combinedData;
//     };

//     let allResults = {};

//     const tasks = [];
//     const groupsToFetch = lookingFor === 'all' ? Object.keys(matchStages) : [lookingFor];

//     for (const group of groupsToFetch) {
//         tasks.push(fetchGroupData(group));
//     }

//     const groupResults = await Promise.all(tasks);

//     groupsToFetch.forEach((groupName, index) => {
//         const groupData = groupResults[index];

//         groupData.sort((a, b) => b.suggestionScore - a.suggestionScore);

//         const totalCount = groupData.length;
//         const totalPages = Math.ceil(totalCount / pageLimit);
//         const paginatedResults = groupData.slice(offset, offset + pageLimit);

//         allResults[groupName] = {
//             totalCount,
//             totalPages,
//             currentPage: page,
//             nextPage: page < totalPages ? page + 1 : null,
//             prevPage: page > 1 ? page - 1 : null,
//             results: paginatedResults,
//         };
//     });

//     return response.responseHandlerWithData(
//         res,
//         true,
//         statusCode.SUCCESS,
//         "Discover content grouped and paginated successfully",
//         allResults
//     );
// });



exports.discoverTrendingPostsAndTags = catchAsyncError(async (req, res) => {
    const userId = req.user.id;
    const {
        limit = 5,
        pageNo = 1,
        lookingFor = "all",
        search
    } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);

    const user = await User.findById(userId).lean();
    const userInterests = user?.interest?.flatMap((interest) => interest.value) || [];

    const matchStages = {
        trendingPost: {
            $and: [
                { likeCount: { $gte: 1 } },
            ]
        },
        hastag: {
            $and: [
                { status: 'active' },
                { tagName: { $exists: true } },
                { tagUsedCount: { $gte: 1 } },
            ],
        },
        popularInterest: {
            $and: [
                { status: 'active' },
                { interestUsedCount: { $gte: 1 } }
            ]
        }
    };

    const fetchGroupData = async (groupName) => {
        switch (groupName) {
            case 'trendingPost': {
                const trendingPost = await Post.aggregate([
                    {
                        $match: {
                            ...matchStages[groupName],
                            ...(search && {
                                $or: [
                                    { title: { $regex: search, $options: "i" } },
                                    { description: { $regex: search, $options: "i" } }
                                ]
                            })
                        }
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
                                        accountType: 1,
                                        username: 1,
                                        blueTick: 1
                                    }
                                }
                            ]
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
                            from: "communitymembers",
                            localField: "community._id",
                            foreignField: "communityId",
                            as: "communityMember",
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
                            from: "tags",
                            localField: "tags",
                            foreignField: "tagName",
                            as: "tagDetails"
                        },
                    },
                    {
                        $addFields: {
                            totalLikes: { $sum: { $ifNull: ["$likeCount", 0] } },
                            totalComments: {
                                $sum: [
                                    { $size: "$comments" },
                                    { $size: "$commentReplies" },
                                ]
                            },
                            totalShares: { $sum: { $ifNull: ["$shareCount", 0] } },
                            tagPopularityScore: {
                                $sum: {
                                    $map: {
                                        input: "$tagDetails",
                                        as: "tag",
                                        in: "$$tag.tagUsedCount"
                                    },
                                }
                            },
                            interestMatchOnNormalPostScore: {
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
                            interestMatchOnCommunityPostScore: {
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
                            }
                        },
                    },
                    {
                        $addFields: {
                            userEngagementScore: {
                                $add: [
                                    { $multiply: [{ $ifNull: ["$totalLikes", 0] }, 0.35] },
                                    { $multiply: [{ $ifNull: ["$totalComments", 0] }, 0.30] },
                                    { $multiply: [{ $ifNull: ["$viewCount", 0] }, 0.25] },
                                    { $multiply: [{ $ifNull: ["$totalShares", 0] }, 0.10] },
                                ]
                            },
                            behaviouralScore: {
                                $add: [
                                    { $multiply: [{ $ifNull: ["$tagPopularityScore", 0] }, 0.40] },
                                    { $multiply: [{ $ifNull: ["$interestMatchOnNormalPostScore", 0] }, 0.30] },
                                    { $multiply: [{ $ifNull: ["$interestMatchOnCommunityPostScore", 0] }, 0.30] }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            priorityScore: {
                                $round: [
                                    {
                                        $add: [
                                            { $ifNull: ["$userEngagementScore", 0] },
                                            { $ifNull: ["$behaviouralScore", 0] },
                                        ]
                                    },
                                    2,
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            userId: 1,
                            description: 1,
                            imagesOrVideos: 1,
                            turnOffCommenting: 1,
                            maxMediaRatio : 1,
                            communityId: 1,
                            hideLikeAndViewCounts: 1,
                            makePostAsQuery: 1,
                            postType: 1,
                            createdAt: 1,
                            likeCount: 1,
                            shareCount: 1,
                            community: 1,
                            totalMembers: 1,
                            postCreator: 1,
                            totalComments: 1,
                            priorityScore: 1,
                            postLink : 1
                        }
                    }

                ]);
                return Promise.all(trendingPost.map(async (item) => {

                    const isLiked = await Like.exists({
                        itemId: item._id,
                        itemType: "Post",
                        userId,
                        isLiked: true,
                    });
                    const isBookmarked = await User.exists({
                        _id: userId,
                        bookmarkPosts: item._id,
                    });

                    let mutedData = {};

                    if (item.postType === "normal") {
                        mutedData.isMute = !!(await User.exists({
                            _id: userId,
                            mutedUsers: item.userId,
                        }));
                    } else if (item.postType === "community") {
                        mutedData.isMutedUser = !!(await User.exists({
                            _id: userId,
                            mutedUsers: item.userId,
                        }));
                
                        mutedData.isMutedCommunity = !!(await User.exists({
                            _id: userId,
                            mutedCommunities: item.communityId,
                        }));
                    }

                    const totalLikes = await Like.countDocuments({
                        itemId: item._id,
                        itemType: "Post",
                        isLiked: true,
                    });

                    const isFollowToPostCreator = await Friend.exists({
                        userId: new mongoose.Types.ObjectId(item.userId),
                        friendId: userId,
                        status: "active",
                    });

                    const isRequestedToPostCreator = await FriendRequest.exists({
                        senderId: new mongoose.Types.ObjectId(userId),
                        receiverId: new mongoose.Types.ObjectId(item.userId),
                        status: "pending"
                    })

                    const isFollowPostCreator = isFollowToPostCreator ? "accepted" : isRequestedToPostCreator ? "requested" : "notFollow"

                    let userCommunityRole = null;

                    if (item.communityId && item.community.length > 0) {

                        const userCommunityMembership = await CommunityMember.findOne({
                            communityId: new mongoose.Types.ObjectId(item.community[0]._id),
                            memberId: new mongoose.Types.ObjectId(userId),
                        });

                        const isRequestedToCommunity = await CommunityRequest.findOne({
                            sendBy: {
                                id: new mongoose.Types.ObjectId(userId),
                                type: "user"
                            },
                            sendTo: {
                                id: new mongoose.Types.ObjectId(item.community[0]._id),
                                type: "community"
                            },
                            status: "pending"
                        })
                        userCommunityRole = userCommunityMembership?.communityRole ? userCommunityMembership?.communityRole : isRequestedToCommunity ? "pending" : "notJoined";
                    }

                    return {
                        ...item,
                        isFollowPostCreator,
                        isLiked: !!isLiked,
                        isBookmarked: !!isBookmarked,
                        totalLikes,
                        userCommunityRole,
                        groupName: 'trendingPost',
                        ...mutedData,
                    };
                }))
            }
            case 'hastag': {
                const hastag = await Tag.aggregate([
                    {
                        $match: {
                            ...matchStages[groupName],
                            ...(search && {
                                $or: [
                                    { tagName: { $regex: search, $options: "i" } }
                                ]
                            })
                        }
                    },
                    { $sort: { tagUsedCount: -1 } },
                    {
                        $project: {
                            _id: 1,
                            tagName: 1,
                            tagUsedCount: 1,
                        },
                    },
                    {
                        $addFields: {
                            priorityScore: {
                                $multiply: ["$tagUsedCount", 1]
                            },
                        },
                    },
                ]);
                return hastag.map(item => ({ ...item, groupName: 'hastag' }));
            }
            case 'popularInterest': {
                const popularInterest = await Interest.aggregate([
                    {
                        $match: {
                            ...matchStages[groupName]
                        }
                    },
                    {
                        $sort: { interestUsedCount: -1 }
                    },
                    {
                        $limit: 10
                    },
                    {
                        $project: {
                            _id: 0,
                            interestName: 1,
                            interestUsedCount: 1
                        }
                    }
                ]);
                return popularInterest.map(item => ({ ...item, groupName: 'popularInterest' }));
            }
            default:
                return [];
        }
    };

    let allResults = {};

    const tasks = [];
    const groupsToFetch = lookingFor === 'all' ? Object.keys(matchStages) : [lookingFor];

    for (const group of groupsToFetch) {

        tasks.push(fetchGroupData(group));
    }

    const groupResults = await Promise.all(tasks);

    groupsToFetch.forEach((groupName, index) => {
        const groupData = groupResults[index];

        groupData.sort((a, b) => b.priorityScore - a.priorityScore);

        const totalCount = groupData.length;
        const totalPages = Math.ceil(totalCount / pageLimit);
        const paginatedResults = groupData.slice(offset, offset + pageLimit);

        allResults[groupName] = {
            totalCount,
            totalPages,
            currentPage: page,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
            results: paginatedResults,
        };
    });

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Discover content grouped and paginated successfully",
        allResults
    );
});


exports.discoverPopularInterestPosts = catchAsyncError(async (req, res) => {

    const userId = req.user.id;

    let { limit = 10, pageNo = 1, order = "desc", filterInterests, search } = req.body;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);

    const user = await User.findById(userId).lean();
    const userInterests = user?.interest?.flatMap((interest) => interest.value) || [];

    const matchFilters = {};

    if (filterInterests && filterInterests.length > 0) {
        const interests = filterInterests.map((interest) => interest.trim());
        if (interests.length)
            matchFilters.interest = { $elemMatch: { value: { $in: interests } } };
    }

    if (search) {
        const searchTerms = search.trim().split(/\s+/);
        matchFilters.$or = searchTerms.map(term => ({
            $or: [
                { title: { $regex: term, $options: "i" } },
                { description: { $regex: term, $options: "i" } },
                { "interest.value": { $regex: term, $options: "i" } }
            ]
        })).flat();
    }

    const postsPipeline = [
        {
            $match: matchFilters
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
                            accountType: 1,
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
                                $and: [
                                    { $eq: ["$_id", new mongoose.Types.ObjectId(userId)] },
                                    { $in: ["$$userId", { $ifNull: ["$mutedUsers", []] }] }
                                ]
                            }
                        }
                    }
                ],
                as: "userMuteInfo"
            }
        },
        {
            $lookup: {
                from: "users",
                let: { communityId: "$communityId" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$_id", new mongoose.Types.ObjectId(userId)] },
                                    { $in: ["$$communityId", { $ifNull: ["$mutedCommunities", []] }] }
                                ]
                            }
                        }
                    }
                ],
                as: "communityMuteInfo"
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
                let: { communityId: "$communityId" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$communityId", "$$communityId"] },
                                    { $eq: ["$memberId", new mongoose.Types.ObjectId(userId)] },
                                    { $eq: ["$status", "active"] }
                                ]
                            }
                        }
                    }
                ],
                as: "communityFollowInfo"
            }
        },
        {
            $lookup: {
                from: "communityrequests",
                let: { communityId: "$communityId" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$sendBy.id", new mongoose.Types.ObjectId(userId)] },
                                    { $eq: ["$sendTo.id", "$$communityId"] },
                                    { $eq: ["$status", "pending"] }
                                ]
                            }
                        }
                    }
                ],
                as: "communityJoinReqStatus"
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
                isLiked: { $gt: [{ $size: "$userLikeInfo" }, 0] },
                isBookMarked: { $gt: [{ $size: "$userBookmarkInfo" }, 0] },
                isMute: { $gt: [{ $size: "$userMuteInfo" }, 0] },
                isMutedUser: { $gt: [{ $size: "$userMuteInfo" }, 0] },
                isMutedCommunity: { $gt: [{ $size: "$communityMuteInfo" }, 0] },
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
                userCommunityRole : {
                    $cond: [
                        { $gt: [{ $size: "$communityFollowInfo" }, 0] },
                        { $arrayElemAt: ["$communityFollowInfo.communityRole", 0] },
                        {
                            $cond: [
                                { $gt: [{ $size: "$communityJoinReqStatus" }, 0] },
                                "pending",
                                "notJoined"
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
            $lookup: {
                from: "interests",
                let: { interestValues: "$interest.value" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $in: ["$interestName", "$$interestValues"] }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            interestName: 1,
                            interestUsedCount: 1
                        }
                    }
                ],
                as: "interestDetails"
            }
        },
        {
            $addFields: {
                priorityScore: {
                    $sum: "$interestDetails.interestUsedCount"
                }
            }
        },
        {
            $sort: {
                priorityScore: -1,
                popularityScore: -1
            }
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
                isMute: { $cond: [{ $eq: ["$postType", "normal"] }, "$isMute", "$$REMOVE"] },
                isMutedUser: { $cond: [{ $eq: ["$postType", "community"] }, "$isMutedUser", "$$REMOVE"] },
                isMutedCommunity: { $cond: [{ $eq: ["$postType", "community"] }, "$isMutedCommunity", "$$REMOVE"] },
                isFollowingToPostCreator: 1,
                maxMediaRatio : 1,
                postLink : 1
            },
        },
    ]

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


exports.discoverPostsByTag = catchAsyncError(async (req, res) => {

    const userId = req.user.id;

    let { limit = 10, pageNo = 1, order = "desc", tag, interestValue } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);

    const user = await User.findById(userId).lean();
    const userInterests = user?.interest?.flatMap((interest) => interest.value) || [];

    let matchFilter = {};

    if (tag) {
        matchFilter = {
            $expr: { $in: [tag, { $ifNull: ["$tags", []] }] }
        }
    } else if (interestValue) {
        matchFilter = {
            $expr: {
                $gt: [
                    {
                        $size: {
                            $filter: {
                                input: { $ifNull: ["$interest", []] },
                                as: "item",
                                cond: { $in: [interestValue, "$$item.value"] }
                            }
                        }
                    },
                    0
                ]
            }

        }
    }

    const postsPipeline = [
        {
            $match: matchFilter
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
                                $and: [
                                    { $eq: ["$_id", new mongoose.Types.ObjectId(userId)] },
                                    { $in: ["$$userId", { $ifNull: ["$mutedUsers", []] }] }
                                ]
                            }
                        }
                    }
                ],
                as: "userMuteInfo"
            }
        },
        {
            $lookup: {
                from: "users",
                let: { communityId: "$communityId" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$_id", new mongoose.Types.ObjectId(userId)] },
                                    { $in: ["$$communityId", { $ifNull: ["$mutedCommunities", []] }] }
                                ]
                            }
                        }
                    }
                ],
                as: "communityMuteInfo"
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
                let: { communityId: "$communityId" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$communityId", "$$communityId"] },
                                    { $eq: ["$memberId", new mongoose.Types.ObjectId(userId)] },
                                    { $eq: ["$status", "active"] }
                                ]
                            }
                        }
                    }
                ],
                as: "communityFollowInfo"
            }
        },
        {
            $lookup: {
                from: "communityrequests",
                let: { communityId: "$communityId" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$sendBy.id", new mongoose.Types.ObjectId(userId)] },
                                    { $eq: ["$sendTo.id", "$$communityId"] },
                                    { $eq: ["$status", "pending"] }
                                ]
                            }
                        }
                    }
                ],
                as: "communityJoinReqStatus"
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
                isLiked: { $gt: [{ $size: "$userLikeInfo" }, 0] },
                isBookMarked: { $gt: [{ $size: "$userBookmarkInfo" }, 0] },
                isMute: { $gt: [{ $size: "$userMuteInfo" }, 0] },
                isMutedUser: { $gt: [{ $size: "$userMuteInfo" }, 0] },
                isMutedCommunity: { $gt: [{ $size: "$communityMuteInfo" }, 0] },
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
                userCommunityRole : {
                    $cond: [
                        { $gt: [{ $size: "$communityFollowInfo" }, 0] },
                        { $arrayElemAt: ["$communityFollowInfo.communityRole", 0] },
                        {
                            $cond: [
                                { $gt: [{ $size: "$communityJoinReqStatus" }, 0] },
                                "pending",
                                "notJoined"
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
            $lookup: {
                from: "interests",
                let: { interestValues: "$interest.value" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $in: ["$interestName", "$$interestValues"] }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            interestName: 1,
                            interestUsedCount: 1
                        }
                    }
                ],
                as: "interestDetails"
            }
        },
        {
            $addFields: {
                priorityScore: {
                    $sum: "$interestDetails.interestUsedCount"
                }
            }
        },
        {
            $sort: {
                priorityScore: -1,
                popularityScore: -1
            }
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
                maxMediaRatio : 1,
                isMute: { $cond: [{ $eq: ["$postType", "normal"] }, "$isMute", "$$REMOVE"] },
                isMutedUser: { $cond: [{ $eq: ["$postType", "community"] }, "$isMutedUser", "$$REMOVE"] },
                isMutedCommunity: { $cond: [{ $eq: ["$postType", "community"] }, "$isMutedCommunity", "$$REMOVE"] },
                isFollowingToPostCreator: 1,
                postLink : 1
            },
        },
    ]

    const countPipeline = [{ $count: "total" }];
    const [posts, countResult] = await Promise.all([
        Post.aggregate(postsPipeline),
        Post.aggregate([...postsPipeline.slice(0, 1), ...countPipeline]),
    ]);

    const totalPostsCount = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalPostsCount / pageLimit);

    return response.responseHandlerWithData(res, true, 200, "Feed Posts base on the tag retrieved successfully", {
        currentPage: page,
        totalPages,
        totalPostsCount,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        posts,
    });
});



