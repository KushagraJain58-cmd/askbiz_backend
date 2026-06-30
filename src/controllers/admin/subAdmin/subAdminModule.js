const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
let Admin = require("../../../models/admin")
let Role = require('../../../models/roles');
let bcrypt = require('bcrypt');
let mongoose = require('mongoose');
let transporter = require('../../../config/nodemailer');
let generateRandomPassword = require("../../../../utils/constants/generatePassword");


const sendSubAdminCreds = async (name, email, password, number) => {
    try {

        await transporter.sendMail({
            from: "bhadauriaritik@gmail.com",
            to: email,
            subject: "Your administrator account credentials.",
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>              
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 2;
                        margin: 0;
                        padding: 0;
                        background-color: #f8f8f8;
                    }
                    .container {
                        max-width: 600px;
                        padding: 20px;
                    }
                    h1, p {
                        margin: 0;
                        padding: 0;
                    }
                    a {
                        color: #007bff;
                        text-decoration: none;
                        border-radius: 5px;
                        display: inline-block;
                    }
                    a:hover {
                        color: #37b7f1;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h3>Hi, ${name}</h3>
  
                    <p>Welcome to AskBiz! To get started,</p>
  
                    <p>You Admin account credentials are below.</p><br/>
  
                    <p>Email : ${email}.</p>
                    <p>Password : ${password}.</p>
  
                    <p>Thank you for joining us!</p><br>
                    
                    <p>Best Regards,<br>- The AskBiz Team</p>
  
                </div>
            </body>
            </html>`,
        });

        console.log("Verification email sent successfully");
    } catch (error) {
        console.error("Failed to send verification email:", error);
    }
};

exports.addSubAdmin = catchAsyncError(async (req, res) => {
    const { name, email, phoneNumber, roleId, permissions, profileImage } = req.body;

    const role = await Role.findById(roleId);
    if (!role) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Role not found"
        );
    }

    const existingAdmin = await Admin.findOne({
        $or: [{ email }, { phoneNumber }]
    });
    if (existingAdmin) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.CONFLICT,
            "Admin already exists"
        );
    }

    const randomPassword = generateRandomPassword();
    const hashedRandomPassword = await bcrypt.hash(randomPassword, 10);

    const subAdmin = new Admin({
        name,
        email,
        phoneNumber,
        roleId,
        roleName: role.roleName,
        password: hashedRandomPassword,
        permissions,
        profileImage
    });

    await subAdmin.save();

    sendSubAdminCreds(name, email, randomPassword, phoneNumber);

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.CREATED,
        "Sub Admin created successfully.",
        subAdmin
    );
});

exports.getSubAdmins = catchAsyncError(async (req, res) => {
    const {
        limit = 5,
        pageNo = 1,
        by = "",
        sortBy = "createdAt",
        order = "desc",
        status = "",
        role = "SubAdmin"
    } = req.query;

    const pageLimit = parseInt(limit, 10);
    const page = parseInt(pageNo, 10);
    const offset = pageLimit * (page - 1);
    const sortOrder = order === "asc" ? 1 : -1;

    let matchStage = { roles: role };

    if (status) matchStage.status = status;

    if (by) {
        const searchTerms = by.trim().split(/\s+/);
        matchStage.$or = searchTerms.map((term) => ({
            $or: [
                { name: { $regex: term, $options: "i" } },
                { email: { $regex: term, $options: "i" } },
                { phoneNumber: { $regex: term, $options: "i" } },
                { adminId: { $regex: term, $options: "i" } }
            ]
        })).flat();
    }

    const subAdmins = await Admin.aggregate([
        { $match: matchStage },
        { $sort: { [sortBy]: sortOrder } },
        { $skip: offset },
        { $limit: pageLimit },
        {
            $project: {
                adminId: 1,
                name: 1,
                email: 1,
                phoneNumber: 1,
                roles: 1,
                status: 1,
                profileImage: 1,
                createdAt: 1
            }
        }
    ]);

    const totalCount = await Admin.countDocuments(matchStage);
    const totalPages = Math.ceil(totalCount / pageLimit);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "SubAdmin data fetched successfully.",
        {
            totalSubAdmins: totalCount,
            totalSubAdminsInPage: subAdmins.length,
            currentPage: page,
            totalPages,
            nextPage,
            prevPage,
            subAdmins
        }
    );
});

exports.getSubAdminById = catchAsyncError(async (req, res) => {
    const { subAdminId } = req.query;

    if (!subAdminId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "SubAdmin ID is required"
        );
    }

    const subAdminDetails = await Admin.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(subAdminId) } },
        {
            $project: {
                adminId: 1,
                name: 1,
                email: 1,
                phoneNumber: 1,
                roleName: 1,
                status: 1,
                createdAt: 1,
                profileImage: 1,
                permissions: 1
            }
        }
    ]);

    if (!subAdminDetails.length) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "SubAdmin not found"
        );
    }

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "SubAdmin data fetched successfully.",
        subAdminDetails[0]
    );
});

exports.updateSubAdminById = catchAsyncError(async (req, res) => {
    const { subAdminId, name, email, phoneNumber, roleId, permissions, profileImage, status } = req.body;

    if (!subAdminId) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "SubAdmin ID is required"
        );
    }

    const updateResult = await Admin.updateOne(
        { _id: new mongoose.Types.ObjectId(subAdminId) },
        {
            $set: {
                name,
                email,
                phoneNumber,
                roleId,
                permissions,
                profileImage,
                status
            }
        }
    );

    if (updateResult.modifiedCount === 0) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Failed to update SubAdmin or no changes detected"
        );
    }

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.UPDATED,
        "SubAdmin data updated successfully."
    );
});

