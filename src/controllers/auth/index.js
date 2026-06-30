const authController = require('./authController');

module.exports = {
    adminLogin: authController.adminLogin,
    userRegister: authController.userRegister,
    userLogin: authController.userLogin,
    getOTPForVerification: authController.getOTPForVerification,
    checkUserByUsername : authController.checkUserByUsername,
    userlogout : authController.userlogout,
    getForgetPasswordOTP : authController.getForgetPasswordOTP,
    resetPassword : authController.resetPassword,
    socialLogin : authController.socialLogin
};
