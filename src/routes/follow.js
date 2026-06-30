let express = require("express");
let jwtMiddleware = require("../middelwares/jwt");

const profileController = require("../controllers/user/profile")

let followRouter = express.Router();

followRouter.use(jwtMiddleware.verifyToken, jwtMiddleware.verifyUser);

followRouter.post('/send-follow-request',  profileController.sendFollowRequest);
followRouter.get('/get-follow-request',  profileController.getFriendRequest);
followRouter.post('/action-follow-request',  profileController.actionFollowRequest);
followRouter.get('/getFollowings',  profileController.getFollowing);
followRouter.get('/getFollowers',  profileController.getFollowers);
followRouter.get('/getMutualConnection',  profileController.getMutualConnections);

followRouter.post('/unFriend',  profileController.unFriend);
followRouter.post('/cancel-friend-request',  profileController.cancelFriendRequest);


module.exports = followRouter;
