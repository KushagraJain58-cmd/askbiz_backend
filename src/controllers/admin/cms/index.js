const cmsController = require('./cmsModule.js');

module.exports = {
    createOrUpdateCms: cmsController.createOrUpdateCms,
    getCmsByCmsType: cmsController.getCmsByCmsType,
    deleteCms: cmsController.deleteCms,
};
