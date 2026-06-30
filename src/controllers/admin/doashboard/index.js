const dashboardController = require("./dashboardModule");

module.exports = {
    getOverviewAndActiveUsers : dashboardController.getOverviewAndActiveUsers,
    getPostDistributionByCategory : dashboardController.getPostDistributionByCategory,
    userRegisterData : dashboardController.userRegisterData,
    getUserActivityOverTime : dashboardController.getUserActivityOverTime,
    getCommunityPopularity : dashboardController.getCommunityPopularity,
    getUserTrend: dashboardController.getUserTrend
};
