const communityController = require('./communityModule');

module.exports = {
    getCommunitiesListing: communityController.getCommunitiesListing,
    deleteConfigurationById: communityController.deleteConfigurationById,
    getCommunityDetails: communityController.getCommunityDetails,
    getAllCommunityMembers: communityController.getAllCommunityMembers,
};