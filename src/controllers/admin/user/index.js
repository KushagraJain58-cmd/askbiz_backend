const userListController = require('./userListModule');
const accountVerificationController = require('./accountVerification');

module.exports = {
    getUsers : userListController.getUsers,
    deleteUser : userListController.deleteUser,
    getUserById : userListController.getUserById,
    updateUserStatus : userListController.updateUserStatus,
    getAccountReportedBy : userListController.getAccountReportedBy,

    getVerifyAccountDetails : accountVerificationController.getVerifyAccountDetails,
    verifyRequests : accountVerificationController.verifyRequests,
    getRequestById : accountVerificationController.getRequestById,
    approveAccountRequest : accountVerificationController.approveAccountRequest,
    rejectAccountRequest : accountVerificationController.rejectAccountRequest,
};
