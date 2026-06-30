let User = require('../../../models/users');
let Individual = require('../../../models/users').Individual;
let { catchAsyncError } = require('../../../../utils/constants/generateError')
let response = require('../../../../utils/constants/responseFunctions');
let statusCode = require('../../../../utils/constants/responseCodes');
let mongoose = require('mongoose');
let AccountRequest = require('../../../models/accountRequests');


exports.makeAccountConversionRequest = catchAsyncError(async (req, res) => {

    const { location, ...rest } = req.body;
    const userId = req.user.id;

    const user = await User.findOne({ _id: userId }).lean();

    if (!user || user.accountType != "Individual") {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.SUCCESS,
            "User not found or authenticated"
        );
    }

    const isAccountReqAlreadySent = await AccountRequest.findOne({
        sendBy: userId,
        currentAccountType: "Individual",
        requestedAccountType: "Expert",
        status: { $ne: "rejected" },
    })

    if (isAccountReqAlreadySent) {
        return response.responseHandlerWithMessage(res, true, statusCode.SUCCESS, "Account conversion request already sent. Please wait for the administrator to complete the conversion request.");
    }

    const accountReqObj = {
        sendBy: userId,
        status: "pending",
        currentAccountType: "Individual",
        requestedAccountType: "Expert",
        requestDate: new Date(),
    };

    const addAccountReq = await AccountRequest.create(accountReqObj);

    if (!addAccountReq) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.SUCCESS,
            "Error to add account request of user."
        );
    }

    let updatedFields = { ...rest };

    if (location) {
        updatedFields.location = {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
        };
    }

    const result = await Individual.updateOne(
        { _id: user._id },
        { $set: updatedFields },
        { upsert: true, new: true }
    );

    if (result.matchedCount === 0) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.SUCCESS,
            "No matching document found to update"
        );
    }

    if (result.modifiedCount === 0) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.SUCCESS,
            "Failed to add some expert fields"
        );
    }

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Account conversion request sent successfully"
    );
});

exports.getListsOfActionUsers = catchAsyncError(async (req, res) => {
    const { actionType, limit = 10, pageNo = 1, sortBy = "createdAt", order = "desc" } = req.query;
    const validActions = ["blockedUsers", "mutedUsers"];

    // Validate action type
    if (!validActions.includes(actionType)) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "Invalid action type. Valid types are 'blockedUsers' or 'mutedUsers'."
        );
    }

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const skip = (page - 1) * pageLimit;
    const sortOrder = order === "asc" ? 1 : -1;

    // Aggregation pipeline
    const actionUsersAggregate = await User.aggregate([
        // Match the current user based on ID
        { $match: { _id: new mongoose.Types.ObjectId(req.user.id) } },

        // Project only the required action array (blockedUsers or mutedUsers)
        { $project: { [actionType]: 1 } },

        // Unwind the action array for pagination and lookup
        { $unwind: `$${actionType}` },

        // Lookup to fetch user details from the users collection
        {
            $lookup: {
                from: "users", // assuming 'users' is the collection name
                localField: actionType,
                foreignField: "_id",
                as: "userDetails"
            }
        },

        // Unwind the fetched userDetails
        { $unwind: "$userDetails" },

        // Sort based on the requested field and order
        { $sort: { [`userDetails.${sortBy}`]: sortOrder } },

        // Pagination: Skip and limit
        { $skip: skip },
        { $limit: pageLimit },

        // Project fields you want to expose
        {
            $project: {
                "userDetails._id": 1,
                "userDetails.username": 1,
                "userDetails.email": 1,
                "userDetails.profileImage": 1,
                "userDetails.status": 1,
                "userDetails.name": 1,
                "userDetails.shortBio": 1,
                "userDetails.businessName": 1,
                "userDetails.blueTick": 1,
                "userDetails.businessCategory": 1
            }
        }
    ]);

    // Fetch total count of actionType for the current user
    const totalCountResults = await User.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(req.user.id) } },
        { $project: { total: { $size: `$${actionType}` } } }
    ]);
    const totalCount = totalCountResults[0] ? totalCountResults[0].total : 0;

    // Calculate total pages, next and previous page links
    const totalPages = Math.ceil(totalCount / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    // Base URL construction for next and previous page links
    const baseUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
    const nextLink = nextPage
        ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&sortBy=${sortBy}&order=${order}&actionType=${actionType}`
        : null;
    const prevLink = prevPage
        ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&sortBy=${sortBy}&order=${order}&actionType=${actionType}`
        : null;

    // Respond with paginated results
    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, `${actionType} fetched successfully`, {
        users: actionUsersAggregate.map(doc => doc.userDetails),
        totalUsers: totalCount,
        totalPages,
        currentPage: page,
        nextPage,
        prevPage,
        nextLink,
        prevLink,
    });
});