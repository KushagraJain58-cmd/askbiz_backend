const CommunityMember = require("../models/communityMembers");
const response = require("../../utils/constants/responseFunctions")
let statusCode = require('../../utils/constants/responseCodes');
const { catchAsyncError } = require('../../utils/constants/generateError'); 


exports.checkCommunityPermission = (requiredRoles) => {
    return async (req, res, next) => {

        const  communityId  = req.query.communityId || req.body.communityId || req.params.communityId; 
        const userId = req.user.id;

        console.log("userId---",userId);

        if (!communityId) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Community ID is required."
            );
        }

        const requesterRole = await CommunityMember.findOne({
            communityId,
            memberId: userId,
        });
        if (!requesterRole || !requiredRoles.includes(requesterRole.communityRole)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.FORBIDDEN,
                "You do not have permission to perform this action in the community."
            );
        }

        next(); 
    };
};
