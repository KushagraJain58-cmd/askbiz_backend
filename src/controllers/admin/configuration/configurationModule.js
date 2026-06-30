const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
let Configuration = require("../../../models/configuration");


exports.addConfiguration = catchAsyncError(async (req, res) => {
    try {
        const { configType, ...rest } = req.body;

        if (!configType || !["interests", "reports", "education", "businessCategory", "areaOfExpertise"].includes(configType)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Invalid configuration type provided."
            );
        }

        let configuration = await Configuration.findOne();

        if (!configuration) {
            configuration = new Configuration({
                [configType]: [rest[configType]],
            });
        } else {
            configuration[configType].push(rest[configType]);
        }

        await configuration.save();

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            "Configuration added successfully.",
            configuration
        );
    } catch (error) {
        console.error("Error adding configuration:", error);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.ERROR,
            "Failed to add configuration."
        );
    }
});

exports.getConfiguration = catchAsyncError(async (req, res) => {
    try {
        const { configType, by } = req.query;

        if (!configType || !["interests", "reports", "education", "businessCategory", "areaOfExpertise"].includes(configType)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Invalid configuration type provided."
            );
        }

        const matchCondition = by ? {
            $or: [
                { [`${configType}.name`]: { $regex: by, $options: "i" } },
                { [`${configType}.description`]: { $regex: by, $options: "i" } },
            ],
        } : {};

        const configAggregation = await Configuration.aggregate([
            { $match: {} },
            { $unwind: `$${configType}` },
            { $match: matchCondition },
            { $sort: { [`${configType}.createdAt`]: -1 } },
            {
                $group: {
                    _id: null,
                    items: { $push: `$${configType}` },
                },
            },
            { $project: { _id: 0, items: 1 } },
        ]);

        if (!configAggregation || configAggregation.length === 0) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                `No ${configType} configuration found.`
            );
        }

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            `${configType} configuration fetched successfully.`,
            configAggregation[0].items
        );
    } catch (error) {
        console.error("Error fetching configuration:", error);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.ERROR,
            "Failed to fetch configuration."
        );
    }
});

exports.getConfigurationById = catchAsyncError(async (req, res) => {
    try {
        const { configType, configId } = req.query;

        if (!configType || !["interests", "reports", "education", "businessCategory", "areaOfExpertise"].includes(configType)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Invalid configuration type provided."
            );
        }

        const configuration = await Configuration.findOne().select(configType);

        if (!configuration) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "Configuration not found."
            );
        }

        const configItem = configuration[configType].id(configId);

        if (!configItem) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "No configuration found with the provided ID."
            );
        }

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            `${configType} configuration fetched by ID successfully.`,
            configItem
        );
    } catch (error) {
        console.error("Error fetching configuration by ID:", error);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.ERROR,
            "Failed to fetch configuration by ID."
        );
    }
});

exports.deleteConfigurationById = catchAsyncError(async (req, res) => {
    try {
        const { configType, configId } = req.query;

        if (!configType || !["interests", "reports", "education", "businessCategory", "areaOfExpertise"].includes(configType)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Invalid configuration type provided."
            );
        }

        const configuration = await Configuration.findOne().select(configType);

        if (!configuration) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "Configuration not found."
            );
        }

        const configIndex = configuration[configType].findIndex((config) => config._id.equals(configId));

        if (configIndex === -1) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "No configuration found with the provided ID."
            );
        }

        configuration[configType].splice(configIndex, 1);
        await configuration.save();

        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            "Configuration deleted successfully."
        );
    } catch (error) {
        console.error("Error deleting configuration:", error);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.ERROR,
            "Failed to delete configuration."
        );
    }
});

exports.updateConfigurationById = catchAsyncError(async (req, res) => {
    try {
        const { configType, configId } = req.query;
        const updates = req.body;

        if (!configType || !["interests", "reports", "education", "businessCategory", "areaOfExpertise"].includes(configType)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Invalid configuration type provided."
            );
        }

        if (!configId) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Configuration ID is required."
            );
        }

        const configuration = await Configuration.findOne().select(configType);

        if (!configuration) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "Configuration not found."
            );
        }

        const configItem = configuration[configType].id(configId);

        if (!configItem) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "No configuration found with the provided ID."
            );
        }

        Object.assign(configItem, updates);
        await configuration.save();

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            "Configuration updated successfully.",
            configItem
        );
    } catch (error) {
        console.error("Error updating configuration:", error);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.ERROR,
            "Failed to update configuration."
        );
    }
});

