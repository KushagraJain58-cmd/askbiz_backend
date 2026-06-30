let express = require("express");
let jwt = require("../middelwares/jwt");
let { checkPermissions, checkConfigPermissions} = require("../middelwares/checkAdminPermission");

let configurationController = require("../controllers/admin/configuration");
let cmsController = require("../controllers/admin/cms");
let communityController = require("../controllers/admin/community");
let reportedPostController = require("../controllers/admin/reportedPost");
let userController = require("../controllers/admin/user");
let subAdminController = require("../controllers/admin/subAdmin");
let profileController = require("../controllers/admin/profile");
let dashboardController = require("../controllers/admin/doashboard");
let notificationController = require("../controllers/admin/notification");



let chatRouter = require("./chat");


let adminRouter = express.Router();

// token verification middlewares
adminRouter.use(jwt.verifyToken, jwt.verifyAdmin);


adminRouter.use("/chat",chatRouter);


//<------------------------ Profile Routes -------------------->
adminRouter.post('/changepassword', profileController.changePassword);
adminRouter.get('/getPermissions', profileController.getPermissions);


//<------------------------ Dashboard ------------------------------>
adminRouter.get('/dashboard/get-overview-activeUsers',checkPermissions([{ module: 'Dashboard', access: 'readAccess' }]), dashboardController.getOverviewAndActiveUsers);
adminRouter.get('/dashboard/get-postDistribution',checkPermissions([{ module: 'Dashboard', access: 'readAccess' }]), dashboardController.getPostDistributionByCategory);
adminRouter.get('/dashboard/get-userRegisterations',checkPermissions([{ module: 'Dashboard', access: 'readAccess' }]), dashboardController.userRegisterData);
adminRouter.get('/dashboard/getUserActivityOverTime',checkPermissions([{ module: 'Dashboard', access: 'readAccess' }]), dashboardController.getUserActivityOverTime);

adminRouter.get('/dashboard/communityPopularity',checkPermissions([{ module: 'Dashboard', access: 'readAccess' }]),dashboardController.getCommunityPopularity);
adminRouter.get('/dashboard/userTrend',checkPermissions([{ module: 'Dashboard', access: 'readAccess' }]),dashboardController.getUserTrend);




//<---------------------- CMS Routes ------------------------->

adminRouter.post('/cms/createOrUpdate', checkPermissions([{ module: 'CMS', access: 'fullAccess' }]), cmsController.createOrUpdateCms);
adminRouter.get('/cms/getContentByCmsType', checkPermissions([{ module: 'CMS', access: 'readAccess' }]), cmsController.getCmsByCmsType);
adminRouter.delete('/cms/deleteCms', checkPermissions([{ module: 'CMS', access: 'fullAccess' }]), cmsController.deleteCms);


//<--------------- Configuration Routes ---------------------->

adminRouter.post('/config/addConfig', checkConfigPermissions(), configurationController.addConfiguration);
adminRouter.get('/config/getConfig', checkConfigPermissions(), configurationController.getConfiguration);
adminRouter.get('/config/getConfigById', checkConfigPermissions(), configurationController.getConfigurationById);
adminRouter.get('/config/deleteConfigById', checkConfigPermissions(), configurationController.deleteConfigurationById);
adminRouter.put('/config/updateConfig', checkConfigPermissions(), configurationController.updateConfigurationById);


//<--------------------- Community Routes ----------------------->

adminRouter.get('/community/getAllCommunities', checkPermissions([{ module: 'Community', access: 'readAccess' }]), communityController.getCommunitiesListing);
adminRouter.delete('/community/deleteCommunityById', checkPermissions([{ module: 'Community', access: 'fullAccess' }]), communityController.deleteConfigurationById);
adminRouter.get('/community/getCommunityDetails', checkPermissions([{ module: 'Community', access: 'readAccess' }]), communityController.getCommunityDetails);
adminRouter.get('/community/getAllCommunityMembers', checkPermissions([{ module: 'Community', access: 'readAccess' }]), communityController.getAllCommunityMembers);


//<--------------------- Report Routes -------------------->

adminRouter.get('/report/getAllReportedPosts', checkPermissions([{ module: 'Reported Post', access: 'readAccess' },{ module: 'Community', access: 'readAccess' },{ module: 'Community', access: 'fullAccess' },{ module: 'User / User List', access: 'readAccess' },{ module: 'User / User List', access: 'fullAccess' }]), reportedPostController.getAllReportedPosts);
adminRouter.delete('/report/deletePost', checkPermissions([{ module: 'Reported Post', access: 'fullAccess' },{ module: 'Community', access: 'readAccess' },{ module: 'Community', access: 'fullAccess' }, { module: 'User / User List', access: 'readAccess' },{ module: 'User / User List', access: 'fullAccess' }]), reportedPostController.deletePost);
adminRouter.get('/report/getAllReportedBy/:postId', checkPermissions([{ module: 'Reported Post', access: 'readAccess' },{ module: 'Community', access: 'readAccess' },{ module: 'Community', access: 'fullAccess' }, { module: 'User / User List', access: 'readAccess' },{ module: 'User / User List', access: 'fullAccess' }]), reportedPostController.getReportedBy);



//<------------------------ User Routes -------------------->

adminRouter.get('/user/getUsers', checkPermissions([{ module: 'User / User List', access: 'readAccess' }]), userController.getUsers);
adminRouter.delete('/user/deleteUser', checkPermissions([{ module: 'User / User List', access: 'fullAccess' }]), userController.deleteUser);
adminRouter.get('/user/getUserById', checkPermissions([{ module: 'User / User List', access: 'readAccess' },{ module: 'User / Verify Account', access: 'readAccess' }]), userController.getUserById);
adminRouter.put('/user/updateUserStatus', checkPermissions([{ module: 'User / User List', access: 'fullAccess' }]), userController.updateUserStatus);
adminRouter.get('/user/getAccountReportedBy', checkPermissions([{ module: 'User / User List', access: 'readAccess' }]), userController.getAccountReportedBy);

adminRouter.get('/user/getAllVerifyReq', checkPermissions([{ module: 'User / Verify Account', access: 'readAccess' },{ module: 'User / Expert Request', access: 'readAccess' }, { module: 'User / Upgradation Request', access: 'readAccess' }]) , userController.verifyRequests);
adminRouter.get('/user/getVerifyReqById',  checkPermissions([{ module: 'User / Verify Account', access: 'readAccess' },{ module: 'User / Expert Request', access: 'readAccess' }, { module: 'User / Upgradation Request', access: 'readAccess' }]) , userController.getRequestById);

adminRouter.get('/user/getVerifyDetails', checkPermissions([{ module: 'User / Verify Account', access: 'readAccess' },{ module: 'User / Expert Request', access: 'readAccess' }, { module: 'User / Upgradation Request', access: 'readAccess' }])  ,userController.getVerifyAccountDetails);
adminRouter.get('/user/approveAccountReq',  checkPermissions([{ module: 'User / Verify Account', access: 'fullAccess' },{ module: 'User / Expert Request', access: 'fullAccess' }, { module: 'User / Upgradation Request', access: 'fullAccess' }]) ,userController.approveAccountRequest);
adminRouter.get('/user/reqAccountReq',  checkPermissions([{ module: 'User / Verify Account', access: 'fullAccess' },{ module: 'User / Expert Request', access: 'fullAccess' }, { module: 'User / Upgradation Request', access: 'fullAccess' }]) ,userController.rejectAccountRequest);


// //<------------------------ Sub Admin Routes ------------------------>

adminRouter.post('/subAdmin/add-subAdmin',checkPermissions([{ module: 'Sub-Admin', access: 'fullAccess' }]), subAdminController.addSubAdmin);
adminRouter.get('/subAdmin/get-subAdmins',checkPermissions([{ module: 'Sub-Admin', access: 'readAccess' }]), subAdminController.getSubAdmins);
adminRouter.get('/subAdmin/get-subAdmin-detail',checkPermissions([{ module: 'Sub-Admin', access: 'readAccess' }]), subAdminController.getSubAdminById);
adminRouter.put('/subAdmin/updateSubAdmin',checkPermissions([{ module: 'Sub-Admin', access: 'fullAccess' }]), subAdminController.updateSubAdminById);

    //roles
adminRouter.get('/role/getRoles',checkPermissions([{ module: 'Sub-Admin', access: 'fullAccess' }]), subAdminController.getRoles);
adminRouter.post('/role/addRole',checkPermissions([{ module: 'Sub-Admin', access: 'fullAccess' }]), subAdminController.addRole);
adminRouter.get('/role/get-role-detail',checkPermissions([{ module: 'Sub-Admin', access: 'readAccess' }]), subAdminController.getRoleDetails);


// //<------------------------ Notification Routes ------------------------>

adminRouter.post('/notification/addNotificationAlert',checkPermissions([{ module: 'Notification', access: 'fullAccess' }]), notificationController.addNotificationAlert);
adminRouter.put('/notification/updateNotificationAlert',checkPermissions([{ module: 'Notification', access: 'fullAccess' }]), notificationController.updateNotificationAlert);
adminRouter.delete('/notification/deleteNotificationAlert',checkPermissions([{ module: 'Notification', access: 'fullAccess' }]), notificationController.deleteNotificationAlert);
adminRouter.get('/notification/getNotificationAlerts',checkPermissions([{ module: 'Notification', access: 'readAccess' }]), notificationController.getNotificationAlerts);
adminRouter.post('/notification/resendNotificationAlert',checkPermissions([{ module: 'Notification', access: 'fullAccess' }]), notificationController.resendNotificationAlert);
adminRouter.get('/notification/getReceivedUsers',checkPermissions([{ module: 'Notification', access: 'readAccess' }]), notificationController.getReceivedUsers);




module.exports = adminRouter;