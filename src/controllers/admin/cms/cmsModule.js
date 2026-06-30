const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
let Cms = require("../../../models/cms");

exports.createOrUpdateCms = catchAsyncError(async (req, res) => {
    try {
        const { cmsType, content } = req.body;

        if (!cmsType || !["privacyPolicy", "aboutUs", "contactUs", "termsAndConditions", "communityGuidelines"].includes(cmsType)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Invalid CMS type provided."
            );
        }

        let cms = await Cms.findOne();

        if (!cms) {
            cms = new Cms({
                [cmsType]: content,
                lastUpdate: {
                    adminId: req.user.data.id,
                    updatedContent: cmsType,
                    updatedDate: new Date(),
                },
            });
        } else {
            cms[cmsType] = content;
            cms.lastUpdate = {
                adminId: req.user.data.id,
                updatedContent: cmsType,
                updatedDate: new Date(),
            };
        }

        await cms.save();

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            `${cmsType} added or updated successfully.`,
            cms
        );
    } catch (error) {
        console.error("Error creating or updating CMS:", error);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.ERROR,
            "Failed to create or update CMS."
        );
    }
});

exports.getCmsByCmsType = catchAsyncError(async (req, res) => {
    try {
        const { cmsType } = req.query;

        if (!cmsType || !["privacyPolicy", "aboutUs", "contactUs", "termsAndConditions", "communityGuidelines"].includes(cmsType)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Invalid CMS type provided."
            );
        }

        const cms = await Cms.findOne();

        if (!cms || !cms[cmsType]) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                `No configuration found for the provided CMS type: ${cmsType}.`
            );
        }

        return response.responseHandlerWithData(
            res,
            true,
            statusCode.SUCCESS,
            `${cmsType} details fetched successfully.`,
            cms[cmsType]
        );
    } catch (error) {
        console.error("Error fetching CMS by type:", error);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.ERROR,
            "Failed to fetch CMS by type."
        );
    }
});

exports.deleteCms = catchAsyncError(async (req, res) => {
    try {
        const { cmsType } = req.query;

        if (!cmsType || !["privacyPolicy", "aboutUs", "contactUs", "termsAndConditions", "communityGuidelines"].includes(cmsType)) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.DATAMISSING,
                "Invalid CMS type provided."
            );
        }

        let cms = await Cms.findOne();

        if (!cms || !cms[cmsType]) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                `No configuration found for the provided CMS type: ${cmsType}.`
            );
        }

        cms[cmsType] = undefined;
        cms.lastUpdate = {
            adminId: req.user.data.id,
            updatedContent: cmsType,
            updatedDate: new Date(),
        };

        await cms.save();

        return response.responseHandlerWithMessage(
            res,
            true,
            statusCode.SUCCESS,
            `${cmsType} has been deleted successfully.`
        );
    } catch (error) {
        console.error("Error deleting CMS:", error);
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.ERROR,
            "Failed to delete CMS."
        );
    }
});