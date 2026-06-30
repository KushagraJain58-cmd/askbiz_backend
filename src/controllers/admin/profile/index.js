const profileController = require("./profileController");

module.exports = {
    changePassword: profileController.changePassword,
    getPermissions : profileController.getPermissions
};
