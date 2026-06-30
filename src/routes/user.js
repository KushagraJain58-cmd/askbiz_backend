let express = require("express");
let verifyToken = require("../middelwares/jwt").verifyToken;
let verifyUser = require("../middelwares/jwt").verifyUser;

let followRouter = require("./follow");
let communityRouter = require("./community");
let postRouter = require("./post");
let discoverRouter = require("./discover");
let chatRouter = require("./chat");


 const profileController = require("../controllers/user/profile")
 const adminController = require("../controllers/admin/user")
 const authController = require("../controllers/auth")
 const feedController = require("../controllers/user/feed") 
 const notificationController = require("../controllers/user/notification") 



let userRouter = express.Router();


userRouter.use('/follow', followRouter);
userRouter.use('/community', communityRouter);
userRouter.use('/post', postRouter);
userRouter.use("/discover",discoverRouter)

userRouter.use("/chat",verifyToken,verifyUser,chatRouter);


//review
userRouter.post('/review/writeReview', verifyToken, verifyUser, feedController.writeReview);
userRouter.get('/review/getAllReviews', verifyToken, verifyUser, feedController.getAllReviewsOfUser);


//profile
userRouter.get('/getUser', verifyToken, verifyUser, profileController.getUserDetails);
userRouter.put('/updateUser', verifyToken, verifyUser, profileController.updateUser);


//Temp
userRouter.delete('/deleteUser', profileController.deleteUser);


//settings
userRouter.post('/convertAccount', verifyToken, verifyUser, profileController.makeAccountConversionRequest );
userRouter.get('/actionedUsers', verifyToken, verifyUser, profileController.getListsOfActionUsers );
userRouter.post('/changePassword', authController.resetPassword );
// userRouter.delete('/deleteAccount', authController.deleteAccount );


//User Actions
userRouter.get('/getAllUsers', verifyToken, verifyUser, profileController.getAllUsers);
userRouter.get('/tags/getTags', verifyToken, verifyUser, profileController.getTags);
userRouter.put('/blockUser', verifyToken, verifyUser, profileController.blockUser);
userRouter.put('/muteUser', verifyToken, verifyUser, profileController.muteUser);
userRouter.post('/report/create', verifyToken, verifyUser, profileController.addReport );
userRouter.get('/config/getConfiguration',profileController.getConfiguration );
userRouter.post('/like/toggle', verifyToken, verifyUser, feedController.likeToggle);
userRouter.get('/getUnseenChatRoomsCount', verifyToken, verifyUser, profileController.getUnseenChatRoomsCount );


userRouter.post('/saveImage', profileController.saveImageuploadImageToAws );


//notification

userRouter.get('/notification/getNotifications',verifyToken, verifyUser, notificationController.getNotifications );
userRouter.delete('/notification/deleteNotification',verifyToken, verifyUser, notificationController.deleteNotification );
userRouter.get('/notification/hasUnseenNotifications',verifyToken, verifyUser, notificationController.hasUnseenNotifications );
userRouter.put('/notification/toggleNotification',verifyToken, notificationController.toggleNotification );









module.exports = userRouter;
