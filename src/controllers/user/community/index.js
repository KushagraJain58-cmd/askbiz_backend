const communityFeedController = require('./feed');
const communityActionsController = require('./communityActions');


module.exports = {
    createCommunity: communityActionsController.createCommunity,
    editCommunityDetails: communityActionsController.editCommunityDetails,
    sendInvites : communityActionsController.sendInvites,
    getCommunityInvites : communityActionsController.getCommunityInvites,
    communityInviteAction: communityActionsController.communityInviteAction,
    getAllCommunityMembers: communityActionsController.getAllCommunityMembers,
    addAdminOrModerator : communityActionsController.addAdminOrModerator,
    sendJoinRequest : communityActionsController.sendJoinRequest,
    getJoiningRequests : communityActionsController.getJoiningRequests,
    approveOrRejectRequest : communityActionsController.approveOrRejectRequest,
    toggleBlockUserInCommunity : communityActionsController.toggleBlockUserInCommunity,
    blockMemberList : communityActionsController.blockMemberList,
    removeMember : communityActionsController.removeMember,
    downgradeMember : communityActionsController.downgradeMember,
    getAllCommunityReportedPosts : communityActionsController.getAllCommunityReportedPosts,
    toggleActions : communityActionsController.toggleActions,
    muteCommunity : communityActionsController.muteCommunity,
    leaveCommunity : communityActionsController.leaveCommunity,
    deleteCommunity : communityActionsController.deleteCommunity,
    // community Feed
    getCommunitiesGrouped : communityFeedController.getCommunitiesGrouped,
    getCommunityDetails : communityFeedController.getCommunityDetails,
    getCommunitiesPostGrouped : communityFeedController.getCommunitiesPostGrouped,
    getCommunityPosts : communityFeedController.getCommunityPosts,
};
