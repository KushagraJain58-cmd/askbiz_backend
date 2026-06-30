const discoverfeedController = require('./feed');


module.exports = {
    discoverAccountsAndCommunities : discoverfeedController.discoverAccountsAndCommunities,
    discoverTrendingPostsAndTags : discoverfeedController.discoverTrendingPostsAndTags,
    discoverPopularInterestPosts : discoverfeedController.discoverPopularInterestPosts,
    discoverPostsByTag : discoverfeedController.discoverPostsByTag
};
