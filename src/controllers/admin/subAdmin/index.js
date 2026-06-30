const subAdminController = require('./subAdminModule');
const rolesController = require('./roles');

module.exports = {
    addSubAdmin : subAdminController.addSubAdmin,
    getSubAdmins : subAdminController.getSubAdmins,
    getSubAdminById : subAdminController.getSubAdminById,
    updateSubAdminById : subAdminController.updateSubAdminById,
    addRole : rolesController.addRole,
    getRoles : rolesController.getRoles,
    getRoleDetails : rolesController.getRoleDetails
};
