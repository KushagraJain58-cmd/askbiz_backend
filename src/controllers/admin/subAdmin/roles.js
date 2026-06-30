const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
let Role = require('../../../models/roles');



exports.addRole = catchAsyncError(async (req, res) => {
    const { roleName, permissions, status } = req.body;

    if (!roleName || roleName.trim() === "") {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Role Name is required."
        );
    }

    const isRoleExist = await Role.findOne({
        roleName: roleName.trim(),
    })

    if(isRoleExist) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.CONFLICT,
            "Role already exists."
        );
    }

    const roleObj = {
        roleName: roleName.trim(),
        status,
        permissions
    };

    const role = await Role.create(roleObj);

    if (!role) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.ERROR,
            "Failed to create role."
        );
    }

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.CREATED,
        "New Role created successfully.",
        role
    );
});

exports.getRoles = catchAsyncError(async (req, res) => {
    const roles = await Role.find().lean();

    if (!roles || roles.length === 0) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "No roles found."
        );
    }

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Roles fetched successfully.",
        roles
    );
});

exports.getRoleDetails = catchAsyncError(async (req, res) => {
    const { roleId } = req.query;

    if (!roleId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Role ID is required."
        );
    }

    const role = await Role.findById(roleId).lean();

    if (!role) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "No role found."
        );
    }

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Role details fetched successfully.",
        role
    );
});