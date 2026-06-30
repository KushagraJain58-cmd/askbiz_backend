let express = require("express");
let jwtMiddleware = require("../middelwares/jwt");
let {checkCommunityPermission} = require("../middelwares/checkCommunityPermissions");

const communityController = require("../controllers/user/community");

let communityRouter = express.Router();

communityRouter.use(jwtMiddleware.verifyToken, jwtMiddleware.verifyUser)

communityRouter.post('/create-community', communityController.createCommunity);
communityRouter.post('/send-invites', communityController.sendInvites);

// on user side
communityRouter.get('/get-all-invitations', communityController.getCommunityInvites);
communityRouter.post('/invite-action', communityController.communityInviteAction);


communityRouter.get('/get-community-detail', communityController.getCommunityDetails);

communityRouter.put('/edit-community', communityController.editCommunityDetails);

communityRouter.get('/get-community-members', communityController.getAllCommunityMembers);

communityRouter.post('/add-admins-moderator', communityController.addAdminOrModerator);

communityRouter.post('/sendJoinRequest', communityController.sendJoinRequest);
communityRouter.get('/getJoinRequests', communityController.getJoiningRequests);
communityRouter.post('/accept-reject-req', communityController.approveOrRejectRequest);

communityRouter.post('/toggle-block-member', checkCommunityPermission(['admin', 'moderator']), communityController.toggleBlockUserInCommunity);
communityRouter.get('/blocked-member-list', checkCommunityPermission(['admin', 'moderator']), communityController.blockMemberList);
communityRouter.post('/remove-member', checkCommunityPermission(['admin', 'moderator']), communityController.removeMember);

communityRouter.post('/downgrade-member', checkCommunityPermission(['admin', 'moderator']), communityController.downgradeMember);


communityRouter.get('/getCommunitiesGrouped', communityController.getCommunitiesGrouped);
communityRouter.get('/getCommunitiesPostGrouped', communityController.getCommunitiesPostGrouped);

communityRouter.post('/getCommunityPosts/:communityId', communityController.getCommunityPosts);

communityRouter.get('/reported-content/:communityId',checkCommunityPermission(['admin', 'moderator']), communityController.getAllCommunityReportedPosts);

communityRouter.post('/toggle-action', checkCommunityPermission(['admin', 'moderator']), communityController.toggleActions);
communityRouter.get('/delete-community', checkCommunityPermission(['admin', 'moderator']), communityController.deleteCommunity);

communityRouter.post('/mute-community', communityController.muteCommunity);

communityRouter.get('/leave-community', communityController.leaveCommunity);



module.exports = communityRouter;