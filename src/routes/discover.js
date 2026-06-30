let express = require("express");
let jwtMiddleware = require("../middelwares/jwt");


const discoverController = require("../controllers/user/discover");


let discoverRouter = express.Router();

discoverRouter.use(jwtMiddleware.verifyToken, jwtMiddleware.verifyUser)

discoverRouter.get('/discover-accounts-communities', discoverController.discoverAccountsAndCommunities);

discoverRouter.get('/discover-trendingPosts-tags', discoverController.discoverTrendingPostsAndTags);

discoverRouter.post('/discover-popularInterestPosts', discoverController.discoverPopularInterestPosts);

discoverRouter.get('/discover-posts-by-tag', discoverController.discoverPostsByTag);



module.exports = discoverRouter;