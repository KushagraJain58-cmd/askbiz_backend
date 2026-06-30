const reportedPostController = require("./reportedPostModule");

module.exports = {
    getAllReportedPosts: reportedPostController.getAllReportedPosts,
    deletePost: reportedPostController.deletePost,
    getReportedBy: reportedPostController.getReportedBy,
};
