let jwt = require('jsonwebtoken');
let config = require('../../utils/config').config;
let User = require('../models/users');
let Admin = require('../models/admin').Admin;
let response = require('../../utils/constants/responseFunctions')
let {catchAsyncError} = require('../../utils/constants/generateError')
let statusCode = require('../../utils/constants/responseCodes')


exports.verifyToken = async function (req, res, next) {
    try {

        let token = req.header("x-access-token");

        if (!token) {
            return response.responseHandlerWithMessage(res, false, statusCode.DATAMISSING, "You are not authenticated!");
        }

        jwt.verify(token, config.secret_key, async (err, decodedUser) => {
            if (err) {

                if (err.name === "TokenExpiredError") {

                    await User.findOneAndUpdate(
                        { "tokens.accessToken": token },
                        { $pull: { tokens: { accessToken: token } } },
                        { new: true }
                    );

                    return response.responseHandlerWithMessage(res, false, statusCode.UNAUTHORIZED, "Token has expired. Please log in again.");
                }

                return response.responseHandlerWithMessage(res, false, statusCode.UNAUTHORIZED, "Invalid token!");
            }

            req.user = decodedUser;
            req.token = token;

            next();
        });
    } catch (error) {
        console.error("Token verification error:", error);
        return response.responseHandlerWithMessage(res, false, statusCode.ERROR, "Authentication failed!");
    }
};



exports.verifyAdmin = function(req, res, next) {

    if (req.user.data.userType != "Admin" && req.user.data.userType != "SubAdmin") {
        return response.responseHandlerWithMessage(res,false,statusCode.FORBIDDEN,"You are not authorized as admin or sub-admin!")
    }
    
    next();
};

exports.verifyUser = async function(req, res, next) {
    try {
            
        const userSavedToken = await User.findById(req.user.id).select(['tokens','status', "accountType"]).lean();
        
        if (!userSavedToken) {
            return response.responseHandlerWithMessage(res,false,statusCode.DATAMISSING,"User not found!")
        }

        if(userSavedToken.accountType !== req.user.accountType) {
            return response.responseHandlerWithMessage(res,false,statusCode.FORBIDDEN,"Account Type is mismatched.")
        }

        // if (userSavedToken.accessToken !== req.token) {
        //     return response.responseHandlerWithMessage(res,false,408,"Token is not matched with saved token!")
        // }

        // :->
        const isTokenValid = userSavedToken.tokens.some(tokenObj => tokenObj.accessToken === req.token);
        if (!isTokenValid) {
            return response.responseHandlerWithMessage(
                res,
                false,
                408,
                "Token is not matched with saved token!"
            );
        }

        if(userSavedToken.status == "blocked"){
            return response.responseHandlerWithMessage(res,false,406,`Your account is ${userSavedToken.status}!`)
        }

        if (req.user.data.userType !== "User") {
            return response.responseHandlerWithMessage(res,false,statusCode.UNAUTHORIZED,"You are not authorized as user!")
        }

        next();
    } catch (err) {
        return response.responseHandlerWithError(res,false,statusCode.ERROR,"An error occurred!")
    }
};
