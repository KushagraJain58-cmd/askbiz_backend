const Admin = require("../models/admin")

function checkPermissions(requiredPermissions) {
    return async (req, res, next) => {

        const admin = await Admin.findOne({ _id : req.user.data.id }).select("permissions");

        const userPermissions = admin.permissions

        let hasAccess = false;

        for (let i = 0; i < requiredPermissions.length; i++) {
            const requiredModule = requiredPermissions[i];

            const hasModulePermission = userPermissions.some(permission =>
                permission.module === requiredModule.module &&
                permission[requiredModule.access] === true
            );

            if (hasModulePermission) {
                hasAccess = true;
                break;
            }
        }

        if (hasAccess) {
            return next();
        } else {
            return res.status(403).json({ sccess: false, message: "You do not have permission to access this resource." });
        }
    };
}

function checkConfigPermissions() {
    return (req, res, next) => {
        const configTypeToModuleMap = {
            interests: 'Configuration / Interest',
            reports: 'Configuration / Report',
            education: 'Configuration / Education',
            businessCategory: 'Configuration / Business Category',
            areaOfExpertise: 'Configuration / Area Of Expertise'
        };

        const configType = req.query.configType || req.body.configType;

        if (!configType || !configTypeToModuleMap[configType]) {
            return res.status(400).json({
                message: "Invalid or missing 'configType' parameter. Valid types: interests, reports, education, businessCategory, areaOfExpertise."
            });
        }

        const requiredModule = configTypeToModuleMap[configType];
        const userPermissions = req.user?.data?.permissions || [];

        const accessType = req.method === 'GET' ? 'readAccess' : 'fullAccess';

        const hasPermission = userPermissions.some(permission =>
            permission.module === requiredModule && permission[accessType] === true
        );

        if (hasPermission) {
            return next(); 
        } else {
            return res.status(403).json({
                success: false,
                message: `You do not have ${accessType} permission to access ${requiredModule}.`
            });
        }
    };
}



module.exports = { checkPermissions, checkConfigPermissions };
