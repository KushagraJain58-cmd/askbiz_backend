const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
let User = require("../../../models/users")
let Post = require("../../../models/post")
let Interaction = require("../../../models/interaction")
let Like = require("../../../models/like")
let Comment = require("../../../models/comment")
let CommunityMember = require("../../../models/communityMembers")
let Configuration = require("../../../models/configuration")
let redisClient = require("../../../config/redis")
let moment = require("moment");


exports.getOverviewAndActiveUsers = catchAsyncError(async (req, res) => {
    try {
        const totalActiveUsers = await User.countDocuments({
            status: "active"
        });

        const userActiveAccountsCount = await User.aggregate([
            { $group: { _id: "$accountType", count: { $sum: 1 } } }
        ]);

        const totalPosts = await Post.countDocuments();

        const postTypeCount = await Post.aggregate([
            { $group: { _id: "$postType", count: { $sum: 1 } } }
        ]);

        const totalLikes = await Like.countDocuments({
            itemType: "Post",
            isLiked: true
        })
        const totalComments = await Comment.countDocuments();

        const data = {
            totalActiveUsers,
            userAccounts: userActiveAccountsCount.reduce((acc, cur) => {
                acc[cur._id] = cur.count;
                return acc;
            }, {}),
            totalPosts,
            postType: postTypeCount.reduce((acc, cur) => {
                acc[cur._id] = cur.count;
                return acc;
            }, {}),
            postEngagements: {
                totalLikes,
                totalComments
            }
        };

        return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Overviews and active accounts fetched successfully", data);
    } catch (error) {
        return response.responseHandlerWithError(res, false, statusCode.ERROR, "An error occurred while fetching data");
    }
});


exports.getPostDistributionByCategory = catchAsyncError(async (req, res) => {

    let { timeFrame, from, to } = req.query;

    let dateFilter = {};
    if (timeFrame) {
        let startDate, endDate;
        const now = moment().endOf("day");

        switch (timeFrame) {
            case "lastMonth":
                startDate = moment().subtract(1, "months").startOf("month");
                endDate = moment().subtract(1, "months").endOf("month");
                break;
            case "last3Month":
                startDate = moment().subtract(3, "months").startOf("month");
                endDate = now;
                break;
            case "thisQuarter":
                startDate = moment().quarter(moment().quarter()).startOf("quarter");
                endDate = now;
                break;
            case "lastQuarter":
                startDate = moment().subtract(1, "quarters").startOf("quarter");
                endDate = moment().subtract(1, "quarters").endOf("quarter");
                break;
            case "thisYear":
                startDate = moment().startOf("year");
                endDate = now;
                break;
            case "lastYear":
                startDate = moment().subtract(1, "years").startOf("year");
                endDate = moment().subtract(1, "years").endOf("year");
                break;
            default:
                return response.responseHandlerWithMessage(res, false, 400, "Invalid timeFrame value");
        }

        dateFilter = { createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() } };

    } else if (from && to) {
        dateFilter = { createdAt: { $gte: new Date(from), $lte: new Date(to) } };
    }

    const categoryConfig = await Configuration.findOne().select("interests");


    if (!categoryConfig || !categoryConfig.interests) {
        return response.responseHandlerWithMessage(res, false, 200, "No category configuration found");
    }


    const allCategories = categoryConfig.interests.map(interest => interest.categoryName);

    const postDistribution = await Post.aggregate([
        { $match: dateFilter },
        { $unwind: "$interest" },
        { $group: { _id: "$interest.interestType", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    const categoryDistribution = postDistribution.map(item => ({
        name: item._id,
        value: item.count,
    }));

    const fullCategoryDistribution = allCategories.map(category => {
        const found = categoryDistribution.find(item => item.name === category);
        return found || { category, postCount: 0 };
    });

    const result = {
        categoryDistribution,
        listOfCategoryUsedInPost: categoryDistribution.map(data => data.name)
    };

    return response.responseHandlerWithData(res, true, 200, "Category distribution retrieved successfully", result);
});


exports.userRegisterData = catchAsyncError(async (req, res) => {
    let { timeFrame, from, to } = req.query;

    let dateFilter = {};
    if (timeFrame) {
        let startDate, endDate;
        const now = moment().endOf("day");

        switch (timeFrame) {
            case "lastMonth":
                startDate = moment().subtract(1, "months").startOf("month");
                endDate = moment().subtract(1, "months").endOf("month");
                break;
            case "last3Month":
                startDate = moment().subtract(3, "months").startOf("month");
                endDate = now;
                break;
            case "thisQuarter":
                startDate = moment().quarter(moment().quarter()).startOf("quarter");
                endDate = now;
                break;
            case "lastQuarter":
                startDate = moment().subtract(1, "quarters").startOf("quarter");
                endDate = moment().subtract(1, "quarters").endOf("quarter");
                break;
            case "thisYear":
                startDate = moment().startOf("year");
                endDate = now;
                break;
            case "lastYear":
                startDate = moment().subtract(1, "years").startOf("year");
                endDate = moment().subtract(1, "years").endOf("year");
                break;
            default:
                return response.responseHandlerWithMessage(res, false, 400, "Invalid timeFrame value");
        }

        dateFilter = { createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() } };
    } else if (from && to) {
        dateFilter = { createdAt: { $gte: new Date(from), $lte: new Date(to) } };
    }

    const userRegistrationData = await User.aggregate([
        {
            $match: {
                status: "active",
                ...dateFilter
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" }
                },
                newUsers: { $sum: 1 }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const formattedData = userRegistrationData.map(item => ({
        name: `${moment().month(item._id.month - 1).format("MMMM")} ${item._id.year}`, // Convert month number to name
        newUsers: item.newUsers
    }));

    return response.responseHandlerWithData(res, true, 200, "Monthly user registration data retrieved successfully.", formattedData);
});


exports.getUserActivityOverTime = catchAsyncError(async (req, res) => {
    try {
        const { timeFrame, from, to } = req.query;

        let startDate, endDate;

        if (timeFrame) {
            switch (timeFrame) {
                case "last3Month":
                    startDate = moment().subtract(3, "months").startOf("month");
                    endDate = moment();
                    break;
                case "lastMonth":
                    startDate = moment().subtract(1, "months").startOf("month");
                    endDate = moment().subtract(1, "months").endOf("month");
                    break;
                case "thisQuarter":
                    startDate = moment().startOf("quarter");
                    endDate = moment();
                    break;
                case "lastQuarter":
                    startDate = moment().subtract(1, "quarter").startOf("quarter");
                    endDate = moment().subtract(1, "quarter").endOf("quarter");
                    break;
                case "thisYear":
                    startDate = moment().startOf("year");
                    endDate = moment();
                    break;
                case "lastYear":
                    startDate = moment().subtract(1, "years").startOf("year");
                    endDate = moment().subtract(1, "years").endOf("year");
                    break;
                default:
                    return response.responseHandlerWithMessage(res, false, 400, "Invalid timeFrame value");
            }
        } else if (from && to) {
            startDate = moment(from);
            endDate = moment(to);
        } else {
            // Default to this year
            startDate = moment().startOf("year");
            endDate = moment();
        }

        // Determine whether to use monthly or daily granularity
        const isMonthly = startDate.diff(endDate, "months") !== 0 || timeFrame?.includes("Month") || timeFrame?.includes("Year") || timeFrame?.includes("Quarter");

        // Generate date labels
        const cursor = startDate.clone();
        const dateLabels = [];

        while (cursor.isSameOrBefore(endDate, isMonthly ? "month" : "day")) {
            dateLabels.push(isMonthly ? cursor.format("YYYY-MM") : cursor.format("YYYY-MM-DD"));
            cursor.add(1, isMonthly ? "month" : "day");
        }

        // Fetch logins from Redis
        let loginCounts = [];

        if (isMonthly) {
            for (const month of dateLabels) {
                const startOfMonth = moment(month, "YYYY-MM").startOf("month");
                const endOfMonth = moment(month, "YYYY-MM").endOf("month");

                const daysInMonth = [];
                const cursor = startOfMonth.clone();

                while (cursor.isSameOrBefore(endOfMonth, "day")) {
                    daysInMonth.push(`daily_logins:${cursor.format("YYYY-MM-DD")}`);
                    cursor.add(1, "day");
                }

                const dailyCounts = await Promise.all(daysInMonth.map(key => redisClient.get(key)));
                const monthlySum = dailyCounts.reduce((sum, count) => sum + (parseInt(count) || 0), 0);
                loginCounts.push(monthlySum);
            }
        } else {
            const redisKeys = dateLabels.map(date => `daily_logins:${date}`);
            const dailyCounts = await Promise.all(redisKeys.map(key => redisClient.get(key)));
            loginCounts = dailyCounts.map(count => parseInt(count) || 0);
        }

        // MongoDB aggregation for posts
        const postAggregation = await Post.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: startDate.toDate(),
                        $lte: endDate.toDate()
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: isMonthly ? "%Y-%m" : "%Y-%m-%d",
                            date: "$createdAt"
                        }
                    },
                    postCount: { $sum: 1 }
                }
            }
        ]);

        // MongoDB aggregation for interactions
        const interactionAggregation = await Interaction.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: startDate.toDate(),
                        $lte: endDate.toDate()
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: isMonthly ? "%Y-%m" : "%Y-%m-%d",
                            date: "$createdAt"
                        }
                    },
                    interactionCount: { $sum: 1 }
                }
            }
        ]);

        // Convert aggregation results into maps for fast access
        const postDataMap = new Map(postAggregation.map(item => [item._id, item.postCount]));
        const interactionDataMap = new Map(interactionAggregation.map(item => [item._id, item.interactionCount]));

        // Final activity data formatting
        const activityData = dateLabels.map((date, index) => ({
            name: isMonthly ? moment(date, "YYYY-MM").format("MMM YYYY") : date,
            logins: loginCounts[index] || 0,
            posts: postDataMap.get(date) || 0,
            interactions: interactionDataMap.get(date) || 0,
        }));

        return response.responseHandlerWithData(res, true, 200, "User activity data fetched successfully", activityData);
    } catch (error) {
        console.error("Error fetching user activity data:", error);
        return response.responseHandlerWithError(res, false, 500, "Error fetching user activity data");
    }
});



exports.getCommunityPopularity = catchAsyncError(async (req, res) => {
    const { timeFrame, from, to } = req.query;
    let dateRange = [];

    if (timeFrame) {
        switch (timeFrame) {
            case "last3Month":
                dateRange = [moment().subtract(3, "months").startOf("month"), moment()];
                break;
            case "lastMonth":
                dateRange = [moment().subtract(1, "months").startOf("month"), moment().subtract(1, "months").endOf("month")];
                break;
            case "thisQuarter": {
                const quarter = moment().quarter();
                const start = moment().quarter(quarter).startOf("quarter");
                const end = moment();
                dateRange = [start, end];
                break;
            }
            case "lastQuarter": {
                const lastQuarterEnd = moment().subtract(1, 'quarter').endOf('quarter');
                const lastQuarterStart = moment(lastQuarterEnd).startOf('quarter');
                dateRange = [lastQuarterStart, lastQuarterEnd];
                break;
            }
            case "thisYear":
                dateRange = [moment().startOf("year"), moment()];
                break;
            case "lastYear":
                dateRange = [moment().subtract(1, "years").startOf("year"), moment().subtract(1, "years").endOf("year")];
                break;
            default:
                return response.responseHandlerWithMessage(res, false, 400, "Invalid timeFrame value");
        }
    } else if (from && to) {
        dateRange = [moment(from), moment(to)];
    } else {
        dateRange = [moment().subtract(6, 'days'), moment()];
    }

    const topCommunities = await CommunityMember.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: dateRange[0].toDate(),
                    $lte: dateRange[1].toDate()
                }
            }
        },
        {
            $group: {
                _id: "$communityId",
                memberCount: { $sum: 1 }
            }
        },
        {
            $sort: { memberCount: -1 }
        },
        {
            $limit: 5
        },
        {
            $lookup: {
                from: "communities",
                localField: "_id",
                foreignField: "_id",
                as: "community"
            }
        },
        {
            $unwind: "$community"
        },
        {
            $project: {
                _id: 0,
                name: "$community.communityName",
                popularity: "$memberCount"
            }
        }
    ]);

    // const data = [
    //     //   { name: "Community A", popularity: 4000 },
    //     //   { name: "Community B", popularity: 3000 },
    //     //   { name: "Community C", popularity: 2000 },
    //     //   { name: "Community D", popularity: 2780 },
    //     //   { name: "Community E", popularity: 1890 },
    //     // ];

    return response.responseHandlerWithData(res, true, 200, "Top communities fetched successfully", topCommunities);
});


function buildMonthlyTrend(startDate, endDate, users, activeUsers, posts, interactions) {
    const result = [];
    const monthMap = {};

    const toMap = (arr) =>
        arr.reduce((acc, { year, month, count }) => {
            acc[`${year}-${month}`] = count;
            return acc;
        }, {});

    const userMap = toMap(users);
    const activeMap = toMap(activeUsers);
    const postMap = toMap(posts);
    const interactionMap = toMap(interactions);

    const cursor = moment(startDate).startOf("month");

    while (cursor.isSameOrBefore(endDate, "month")) {
        const year = cursor.year();
        const month = cursor.month() + 1;
        const key = `${year}-${month}`;

        result.push({
            name: cursor.format("MMM YYYY"),
            newUsers: userMap[key] || 0,
            activeUsers: activeMap[key] || 0,
            posts: postMap[key] || 0,
            interactions: interactionMap[key] || 0
        });

        cursor.add(1, "month");
    }

    return result;
}

exports.getUserTrend = catchAsyncError(async (req, res) => {
    const { timeFrame, from, to } = req.query;
    let dateRange = [];

    if (timeFrame) {
        switch (timeFrame) {
            case "last3Month":
                dateRange = [moment().subtract(3, "months").startOf("month"), moment()];
                break;
            case "lastMonth":
                dateRange = [moment().subtract(1, "months").startOf("month"), moment().subtract(1, "months").endOf("month")];
                break;
            case "thisQuarter": {
                const start = moment().startOf("quarter");
                const end = moment();
                dateRange = [start, end];
                break;
            }
            case "lastQuarter": {
                const start = moment().subtract(1, "quarter").startOf("quarter");
                const end = moment().subtract(1, "quarter").endOf("quarter");
                dateRange = [start, end];
                break;
            }
            case "thisYear":
                dateRange = [moment().startOf("year"), moment()];
                break;
            case "lastYear":
                dateRange = [moment().subtract(1, "years").startOf("year"), moment().subtract(1, "years").endOf("year")];
                break;
            default:
                return response.responseHandlerWithMessage(res, false, 400, "Invalid timeFrame value");
        }
    } else if (from && to) {
        dateRange = [moment(from), moment(to)];
    } else {
        dateRange = [moment().startOf("year"), moment()];
    }

    const [startDate, endDate] = dateRange.map(d => d.toDate());

    const groupByMonthPipeline = [
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                year: "$_id.year",
                month: "$_id.month",
                count: 1
            }
        },
        {
            $sort: { year: 1, month: 1 }
        }
    ];

    const [users, posts, interactions, activeUsersRaw] = await Promise.all([
        User.aggregate(groupByMonthPipeline),
        Post.aggregate(groupByMonthPipeline),
        Interaction.aggregate(groupByMonthPipeline),
        Interaction.aggregate([
            {
                $match: { createdAt: { $gte: startDate, $lte: endDate } }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        userId: "$userId"
                    }
                }
            },
            {
                $group: {
                    _id: { year: "$_id.year", month: "$_id.month" },
                    uniqueUsers: { $addToSet: "$_id.userId" }
                }
            },
            {
                $project: {
                    year: "$_id.year",
                    month: "$_id.month",
                    count: { $size: "$uniqueUsers" },
                    _id: 0
                }
            },
            {
                $sort: { year: 1, month: 1 }
            }
        ])
    ]);

    const monthlyTrend = buildMonthlyTrend(startDate, endDate, users, activeUsersRaw, posts, interactions);

    return response.responseHandlerWithData(res, true, 200, "Monthly user trend fetched", monthlyTrend);

});



