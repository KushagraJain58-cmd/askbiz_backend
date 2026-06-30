let express = require("express");
let passport = require("passport");
let jwtMiddleware = require("../middelwares/jwt");
let config = require("../../utils/config").config;
let jwt = require('jsonwebtoken');
let User = require("../models/users");
let authRouter = express.Router();


let authenticateController = require("../controllers/auth");

//<------------------- Admin auth routes ------------------->

authRouter.post('/admin-login', authenticateController.adminLogin);


//<----------------- User auth routes ----------------->

authRouter.post('/register', authenticateController.userRegister);
authRouter.post('/get-otp', authenticateController.getOTPForVerification);
authRouter.get('/check-username', authenticateController.checkUserByUsername);
authRouter.post('/login', authenticateController.userLogin);
authRouter.post('/social-login', authenticateController.socialLogin);

authRouter.post('/userLogout', jwtMiddleware.verifyToken, jwtMiddleware.verifyUser, authenticateController.userlogout);


// <---------------------- Common auth routes --------------------->

authRouter.get('/get-forgetPassword-otp', authenticateController.getForgetPasswordOTP);
authRouter.post('/reset-password', authenticateController.resetPassword);


// <--------------- Social auth routes -------------------->

// authRouter.get('/google',
//     function(req, res, next) {
//         req.session.lastQuery = req.query;
//         return next();
//     },
//     passport.authenticate('google', { scope: ['email', 'profile'], prompt: 'select_account' })
// );

// authRouter.get('/google/callback',
//     passport.authenticate('google', {
//         successRedirect: '/api/v1/auth/login/success',
//         failureRedirect: '/api/v1/auth/login/failure'
//     })
// );

// authRouter.get("/login/success", function(req, res, next) {
//     if (req.user) {
//         var password = req.user.password, // Exclude password from token
//             role = req.user.role,
//             rest = Object.assign({}, req.user);
//         delete rest.password;
//         delete rest.role;

//         var payload = {
//             id: req.user._id,
//             accountType: req.user.accountType,
//             data: Object.assign({}, rest, { userType: 'User' })
//         };

//         var token = jwt.sign(payload, config.secret_key, { expiresIn: '24h' });

//         User.findOneAndUpdate(
//             { _id: req.user._id },
//             {
//                 $set: {
//                     accessToken: token,
//                 },
//             },
//             { new: true }
//         ).then(function() {
//             // return res.status(200)
//             //            .redirect(`${process.env.UI_REDIRECT_URL}/home?token=${token}`);

//             // Add localhost URL
//             return res.status(200)
//                 .redirect('http://localhost:9094?token=' + token);
//         });
//     } else {
//         return res.status(401).json({
//             success: false,
//             message: "Not an authorized user...!!"
//         });
//     }
// });

// authRouter.get("/login/failure", function(req, res, next) {
//     console.log("Login failed");
//     return res.status(401).json({
//         success: false,
//         message: "Login failed...!"
//     });
// });

module.exports = authRouter;
