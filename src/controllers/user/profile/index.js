const settingsController = require('./setting');
const userActionController = require('./userAction');
const userProfileController = require('./userProfile');
const followController = require("./follow")

module.exports = {
    makeAccountConversionRequest: settingsController.makeAccountConversionRequest,
    getListsOfActionUsers: settingsController.getListsOfActionUsers,
    updateUser : userProfileController.updateUser,
    getUserDetails : userProfileController.getUserDetails,
    getAllUsers : userProfileController.getAllUsers,
    blockUser: userActionController.blockUser,
    muteUser: userActionController.muteUser,
    addReport : userActionController.addReport,
    saveImageuploadImageToAws : userActionController.saveImageuploadImageToAws,
    getTags : userActionController.getTags,
    getConfiguration : userActionController.getConfiguration,
    getUnseenChatRoomsCount : userActionController.getUnseenChatRoomsCount,

    // follow controllers
    sendFollowRequest : followController.sendFollowRequest,
    getFriendRequest : followController.getFriendRequest,
    cancelFriendRequest : followController.cancelFriendRequest,
    actionFollowRequest : followController.actionFollowRequest,
    getFollowing : followController.getFollowing,
    getFollowers : followController.getFollowers,
    getMutualConnections : followController.getMutualConnections,
    unFriend: followController.unFriend,
    blockFriend : followController.blockFriend,
    unblockFriend : followController.unblockFriend,
    //Temp
    deleteUser :  userActionController.deleteUser
};
