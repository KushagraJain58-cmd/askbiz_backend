const configurationController = require("./configurationModule");

module.exports = {
    addConfiguration: configurationController.addConfiguration,
    getConfiguration: configurationController.getConfiguration,
    getConfigurationById: configurationController.getConfigurationById,
    deleteConfigurationById: configurationController.deleteConfigurationById,
    updateConfigurationById: configurationController.updateConfigurationById,
};
