const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
let Community = require("../../../models/community");
let CommunityMember = require("../../../models/communityMembers");
let CommunityRequest = require("../../../models/communityRequests");
let Report = require("../../../models/report")
let Post = require("../../../models/post")
let mongoose = require("mongoose");


exports.getCommunitiesListing = catchAsyncError(async (req, res) => {
    const {
        limit = 10,
        pageNo = 1,
        sortBy = "createdAt",
        order = "desc",
        search,
        communityType,
        membersDeepSearch,
        fromDate,
        toDate = new Date(),
        location
    } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);
    const sortOrder = order === "asc" ? 1 : -1;

    const matchStage = {};

    if (search) {
        const searchTerms = search.trim().split(/\s+/);
        matchStage.$or = searchTerms.map((term) => ({
            $or: [
                { communityName: { $regex: term, $options: "i" } },
                { communityUsername: { $regex: term, $options: "i" } },
            ],
        })).flat();
    }

    if (communityType) {
        matchStage.communityType = communityType
    }

    let deepMatch = {};

    if (fromDate && toDate) {

        const fromDateParsed = new Date(fromDate);
        const toDateParsed = new Date(toDate);   
        
        toDateParsed.setHours(23, 59, 59, 999);

        matchStage.createdAt = {
            $gte: fromDateParsed,
            $lte: toDateParsed
        };
    }

    if (membersDeepSearch) {
        const [comparison, value] = membersDeepSearch.split(',');
        const membersValue = parseInt(value, 10);
        deepMatch.totalMembers = comparison === 'moreThan'
            ? { $gt: membersValue }
            : { $lt: membersValue };
    }

    console.log("deepMatch----",deepMatch);

    if(location){
        matchStage['location.cityName'] = { $regex: location, $options: "i" };
    }

    const communities = await Community.aggregate([
        {
            $match: matchStage,
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
            $addFields: {
                totalMembers: { $size: "$members" },
            },
        },
        {
            $match: deepMatch,
        },
        {
            $lookup: {
                from: "reports",
                let: { communityId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$reportToCommunityPost", "$$communityId"] },
                            reportSeen: false,
                        },
                    },
                    {
                        $group: {
                            _id: "$postId", // Group by unique postId
                        },
                    },
                ],
                as: "unseenReports",
            },
        },
        {
            $addFields: {
                unseenReportCount: { $size: "$unseenReports" },
            },
        },
        {
            $lookup: {
                from: "reports",
                let: { communityId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $or: [
                                    { $eq: ["$reportToCommunityPost", "$$communityId"] },
                                    { $eq: ["$reportToCommunity", "$$communityId"] },
                                ],
                            },
                        },
                    },
                    {
                        $group: {
                            _id: "$postId", // Group by unique postId
                        },
                    },
                ],
                as: "allReports",
            },
        },
        {
            $addFields: {
                totalReports: { $size: "$allReports" },
            },
        },
        {
            $sort: { [sortBy]: sortOrder },
        },
        { $skip: offset },
        { $limit: pageLimit },
        {
            $project: {
                _id: 1,
                communityName: 1,
                communityUsername: 1,
                createdAt: 1,
                communityType: 1,
                location: "$location.cityName",
                totalMembers: 1,
                unseenReportCount: 1,
                totalReports: 1,
                logo: 1,
                description: 1,
            },
        },
    ]);

    const totalCount = await Community.countDocuments(matchStage);
    const totalPages = Math.ceil(totalCount / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    return res.status(200).json({
        success: true,
        data: {
            totalCommunities: totalCount,
            communities,
            currentPage: page,
            totalPages,
            nextPage,
            prevPage,
        },
    });
});

exports.deleteConfigurationById = catchAsyncError(async (req, res) => {
    const { communityId } = req.query;

    const community = await Community.findById(communityId);
    if (!community) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            `Community Not Found`
        );
    }

    await Community.findByIdAndDelete(communityId);

    await CommunityMember.deleteMany({ communityId });

    await Report.deleteMany({ $or: [{ reportToCommunity: communityId, }] });

    await CommunityRequest.deleteMany({
        $or: [{ "sendTo.id": communityId }, { "sendBy.id": communityId }],
    });

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        `Community and its associated data deleted successfully`
    );
});

// exports.getCommunityDetails = catchAsyncError(async (req, res) => {

//     const communityId = req.query.communityId;

//     const community = await Community.findOne({ _id: communityId }).lean();

//     if (!community) {
//         return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Community not found.');
//     }

//     const communityMembers = await CommunityMember.aggregate([
//         {
//             $match: {
//                 communityId: new mongoose.Types.ObjectId(communityId),
//                 status: "active"
//             }
//         },
//         {
//             $lookup: {
//                 from: 'users',
//                 localField: 'memberId',
//                 foreignField: '_id',
//                 as: 'memberDetails'
//             }
//         },
//         {
//             $unwind: '$memberDetails'
//         },
//         {
//             $project: {
//                 communityRole: 1,
//                 'memberDetails._id': 1,
//                 'memberDetails.name': 1,
//                 'memberDetails.businessName': 1,
//                 'memberDetails.profileImage': 1,
//                 'memberDetails.shortBio': 1,
//                 'memberDetails.description': 1,
//                 'memberDetails.username': 1,
//                 'memberDetails.blueTick': 1
//             }
//         },
//         {
//             $group: {
//                 _id: '$communityRole',
//                 members: { $push: '$memberDetails' }
//             }
//         }
//     ]);

//     const membersByRole = communityMembers.reduce((acc, item) => {
//         acc[item._id] = item.members;
//         return acc;
//     }, {});

//     const totalPosts = await Post.countDocuments({
//         communityId: new mongoose.Types.ObjectId(communityId)
//     });

//     const result = {
//         communityDetails: {
//             ...community,
//             totalPosts,
//             admins: membersByRole['admin'] || [],
//             moderators: membersByRole['moderator'] || [],
//             members: [ ...membersByRole['admin'] , ...membersByRole['moderator'] ]
//         }
//     };

//     return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'Community details fetched successfully.', result);
// });

exports.getCommunityDetails = catchAsyncError(async (req, res) => {
    const communityId = req.query.communityId;

    const community = await Community.findOne({ _id: communityId }).lean();

    if (!community) {
        return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, 'Community not found.');
    }

    const communityMembers = await CommunityMember.aggregate([
        {
            $match: {
                communityId: new mongoose.Types.ObjectId(communityId),
                status: "active"
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'memberId',
                foreignField: '_id',
                as: 'memberDetails'
            }
        },
        {
            $unwind: '$memberDetails'
        },
        {
            $project: {
                communityRole: 1,
                'memberDetails._id': 1,
                'memberDetails.name': 1,
                'memberDetails.businessName': 1,
                'memberDetails.profileImage': 1,
                'memberDetails.shortBio': 1,
                'memberDetails.description': 1,
                'memberDetails.username': 1,
                'memberDetails.blueTick': 1
            }
        },
        {
            $group: {
                _id: '$communityRole',
                members: { $push: '$memberDetails' }
            }
        }
    ]);

    const membersByRole = communityMembers.reduce((acc, item) => {
        acc[item._id] = item.members;
        return acc;
    }, {});

    const totalMembers = communityMembers.reduce((count, item) => count + item.members.length, 0);

    const totalPosts = await Post.countDocuments({
        communityId: new mongoose.Types.ObjectId(communityId)
    });

    const result = {
        communityDetails: {
            ...community,
            totalPosts,
            totalMembers,
            admins: membersByRole['admin'] || [],
            moderators: membersByRole['moderator'] || [],
            members: [
                ...(membersByRole['admin'] || []),
                ...(membersByRole['moderator'] || []),
                ...(membersByRole['member'] || []) // Assuming 'member' is the role for general members
            ]
        }
    };

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, 'Community details fetched successfully.', result);
});


exports.getAllCommunityMembers = catchAsyncError(async (req, res) => {
    try {
        const {
            communityId,
            roleType,
            limit = 10,
            pageNo = 1,
            sortBy = "createdAt",
            order = "desc",
            search
        } = req.query;

        if (!communityId || !roleType) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Community ID and role type are required."
            );
        }

        const pageLimit = parseInt(limit, 10);
        const page = parseInt(pageNo, 10);
        const offset = pageLimit * (page - 1);
        const sortOrder = order === "asc" ? 1 : -1;

        const rolesLookingFor = roleType === 'admin' ? ['admin'] : roleType === 'moderator' ? ['moderator'] : ["admin", "moderator", "member"]

        const matchStage = {
            communityId: new mongoose.Types.ObjectId(communityId),
            communityRole: { $in: rolesLookingFor }
        };

        const searchMatchStage = search
            ? {
                $match: {
                    $or: [
                        { "memberDetails.username": { $regex: search, $options: "i" } },
                        { "memberDetails.email": { $regex: search, $options: "i" } },
                        { "memberDetails.name": { $regex: search, $options: "i" } },
                        { "memberDetails.businessName": { $regex: search, $options: "i" } },
                    ]
                },
            }
            : { $match: {} };

        const getCommunityRoles = await CommunityMember.aggregate([
            {
                $match: matchStage,
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
            searchMatchStage,
            {
                $project: {
                    _id: 1,
                    memberId: 1,
                    communityId: 1,
                    communityRole: 1,
                    memberDetails: {
                        name: 1,
                        email: 1,
                        businessName: 1,
                        username: 1,
                        profileImage: 1,
                        accountType: 1,
                        shortBio: 1,
                        occupationTitle: 1,
                        occupationSector: 1,
                        workExperience: 1,
                        description: 1,
                        companyName: 1,
                        expertise: 1,
                        blueTick: 1,
                    },
                    status: 1,
                    updatedBy: 1,
                },
            },
            { $sort: { [sortBy]: sortOrder } },
            { $skip: offset },
            { $limit: pageLimit },
        ]);

        const totalCount = await CommunityMember.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: "users",
                    localField: "memberId",
                    foreignField: "_id",
                    as: "memberDetails",
                },
            },
            { $unwind: "$memberDetails" },
            search ? { $match: { "memberDetails.name": { $regex: search, $options: "i" } } } : { $match: {} },
            { $count: "totalCount" },
        ]);

        const count = totalCount[0]?.totalCount || 0;

        const totalPages = Math.ceil(count / pageLimit);
        const nextPage = page < totalPages ? page + 1 : null;
        const prevPage = page > 1 ? page - 1 : null;

        const baseUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;
        const nextLink = nextPage
            ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&sortBy=${sortBy}&order=${order}&search=${search}`
            : null;
        const prevLink = prevPage
            ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&sortBy=${sortBy}&order=${order}&search=${search}`
            : null;

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            "Community members fetched successfully.",
            {
                totalCommunityRoles: count,
                totalRolesInPage: getCommunityRoles.length,
                currentPage: page,
                totalPages: totalPages,
                nextPage: nextPage,
                prevPage: prevPage,
                nextLink: nextLink,
                prevLink: prevLink,
                communityRoles: getCommunityRoles,
            }
        );
    } catch (err) {
        console.error("Error fetching community roles:", err);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.INTERNALSERVERERROR,
            "Internal Server Error"
        );
    }
});