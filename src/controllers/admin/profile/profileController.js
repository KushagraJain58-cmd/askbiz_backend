const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
let Admin = require("../../../models/admin")


exports.changePassword = catchAsyncError(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Current password and new password are required"
        );
    }

    const adminId = req.user.data.id;

    const adminData = await Admin.findOne({ _id: adminId }).select('password');

    const isMatch = bcrypt.compareSync(currentPassword, adminData.password);

    if (!isMatch) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.UNAUTHORIZED,
            "Incorrect current password"
        );
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    await Admin.updateOne({ _id: adminId }, { password: hashedPassword });

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        "Password changed successfully"
    );
});

exports.getPermissions = catchAsyncError(async (req, res) => {

    const adminId = req.query.adminId || req.user.data.id;

    const adminPermissions = await Admin.findOne({ _id: adminId }).select('permissions');

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Permissions fetched successfully.",
        adminPermissions.permissions
    );
});



