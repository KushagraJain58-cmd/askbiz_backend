let express = require("express");
let {verifyToken, verifyUser} = require("../middelwares/jwt")

const feedController = require("../controllers/user/feed")

let postRouter = express.Router();

postRouter.use(verifyToken, verifyUser)

postRouter.post('/createPost', feedController.createPost);
postRouter.post('/:postId/comment/addComment',  feedController.addComment);
postRouter.post('/comment/reply/addReply',  feedController.addReply);
postRouter.put('/postActions',  feedController.postActions);
postRouter.post('/getPosts',  feedController.getPosts);
postRouter.get('/comments/getComments',  feedController.getCommentsByPostId);
postRouter.get('/getOwnPosts',  feedController.getOwnPosts);
postRouter.post('/toggleBookmark',  feedController.toggleBookmark);
postRouter.get('/getAllBookmarks',  feedController.getBookmarks);
postRouter.get('/getMyCommentsOnPosts',  feedController.getUserCommentsAndReplies);
postRouter.get('/getPostbyId',  feedController.getParticularPostById);
postRouter.delete('/deletePostById',  feedController.deletePost);
postRouter.post('/updatePost',  feedController.updatePost);
postRouter.post('/deleteCommentOrReply',  feedController.deleteCommentOrReply);


module.exports = postRouter;