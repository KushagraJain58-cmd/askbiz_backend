const postController = require('./post');
const commentReplyController = require('./comment&reply');
const reviewController = require('./review');

module.exports = {
    writeReview: reviewController.writeReview,
    getAllReviewsOfUser: reviewController.getAllReviewsOfUser,
    addComment : commentReplyController.addComment,
    addReply : commentReplyController.addReply,
    getCommentsByPostId: commentReplyController.getCommentsByPostId,
    getUserCommentsAndReplies: commentReplyController.getUserCommentsAndReplies,
    deleteCommentOrReply : commentReplyController.deleteCommentOrReply,
    createPost : postController.createPost,
    postActions : postController.postActions,
    getPosts : postController.getPosts,
    deletePost : postController.deletePost,
    updatePost : postController.updatePost,
    getOwnPosts : postController.getOwnPosts,
    toggleBookmark : postController.toggleBookmark,
    getBookmarks : postController.getBookmarks,
    getParticularPostById : postController.getParticularPostById,
    likeToggle : postController.likeToggle,
};
