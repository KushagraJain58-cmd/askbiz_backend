const { catchAsyncError } = require("../../../../utils/constants/generateError");
let response = require("../../../../utils/constants/responseFunctions")
let statusCode = require("../../../../utils/constants/responseCodes")
let User = require("../../../models/users");
let Individual = require("../../../models/users").Individual;
let Bussiness = require("../../../models/users").Bussiness;
let Expert = require("../../../models/users").Expert;
let AccountRequest = require("../../../models/accountRequests");
let transporter = require('../../../config/nodemailer'); 

exports.getVerifyAccountDetails = async (req, res) => {
    try {
      const { dataFor } = req.query;
  
      let matchCondition = {};
      let message = "";
  
      if (dataFor === "verifyReq") {
        matchCondition = {
          currentAccountType: "Bussiness",
          requestedAccountType: "Bussiness"
        };
        message = "Bussiness verify account details counts successfully.";
      } else if (dataFor === "upgradeReq") {
        matchCondition = {
          currentAccountType: "Individual",
          requestedAccountType: "Expert"
        };
        message = "Upgrade request account details counts successfully.";
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid 'dataFor' value. Use 'verifyReq' or 'upgradeReq'."
        });
      }
  
      const totalApproved = await AccountRequest.countDocuments({ ...matchCondition, status: "approved" });
      const totalPending = await AccountRequest.countDocuments({ ...matchCondition, status: "pending" });
      const totalRejected = await AccountRequest.countDocuments({ ...matchCondition, status: "rejected" });
  
      return res.status(200).json({
        success: true,
        message,
        data: {
          totalApproved,
          totalPending,
          totalRejected
        }
      });
  
    } catch (error) {
      console.error("Error on fetching account details:", error);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error"
      });
    }
  };
  

exports.verifyRequests = async (req, res) => {
    try {
        const {
            limit = 5,
            pageNo = 1,
            by = "",
            sortBy = "createdAt",
            order = "desc",
            accountType = "",
            status = "",
        } = req.query;

        const pageLimit = parseInt(limit, 10);
        const page = parseInt(pageNo, 10);
        const offset = pageLimit * (page - 1);
        const sortOrder = order === "asc" ? 1 : -1;

        let matchStage = {};

        if (by) {
            const searchTerms = by.trim().split(/\s+/);
            matchStage.$or = searchTerms.map(term => ({
                $or: [
                    { requestedDate: { $regex: term, $options: "i" } },
                    { status: { $regex: term, $options: "i" } },
                    { 'sendByUser.email': { $regex: term, $options: "i" } },
                    { 'sendByUser.username': { $regex: term, $options: "i" } },
                    { 'sendByUser.businessName': { $regex: term, $options: "i" } },
                    { 'sendByUser.phoneNumber': { $regex: term, $options: "i" } },
                ]
            })).flat();
        }

        if (status) {
            matchStage.status = status;
        }

        if (accountType == "Bussiness" || accountType == "Expert") {
            matchStage.currentAccountType = accountType;
            matchStage.requestedAccountType = accountType;
        }

        if (accountType == "IndividualToExpert") {
            matchStage.currentAccountType = "Individual";
            matchStage.requestedAccountType = "Expert";
        }

        const accountRequestAggregation = await AccountRequest.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'sendBy',
                    foreignField: '_id',
                    as: 'sendByUser',
                },
            },
            {
                $match: {
                    ...matchStage
                },
            },
            { $sort: { [sortBy]: sortOrder } },
            { $skip: offset },
            { $limit: pageLimit },
            {
                $project: {
                    id: 1,
                    requestDate: 1,
                    status: 1,
                    sendByUserId: { $arrayElemAt: ['$sendByUser._id', 0] },
                    sendByUserEmail: { $arrayElemAt: ['$sendByUser.email', 0] },
                    sendByUserUsername: { $arrayElemAt: ['$sendByUser.username', 0] },
                    sendByUserProfileImage: { $arrayElemAt: ['$sendByUser.profileImage', 0] },
                    sendByUserPhoneNumber: { $arrayElemAt: ['$sendByUser.phoneNumber', 0] },
                    sendByUserBusinessName: { $arrayElemAt: ['$sendByUser.businessName', 0] },
                    sendByUserName: { $arrayElemAt: ['$sendByUser.name', 0] },
                },
            },
        ]);

        const totalCount = await AccountRequest.countDocuments(matchStage);
        const totalPages = Math.ceil(totalCount / pageLimit);
        const nextPage = page < totalPages ? page + 1 : null;
        const prevPage = page > 1 ? page - 1 : null;

        const baseUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
        const nextLink = nextPage ? `${baseUrl}?limit=${pageLimit}&pageNo=${nextPage}&by=${by}&sortBy=${sortBy}&order=${order}&status=${status}` : null;
        const prevLink = prevPage ? `${baseUrl}?limit=${pageLimit}&pageNo=${prevPage}&by=${by}&sortBy=${sortBy}&order=${order}&status=${status}` : null;

        return res.status(200).json({
            success: true,
            message: "Account Request fetched successfully.",
            totalUsers: totalCount,
            totalUserInAPage: accountRequestAggregation.length,
            currentPage: page,
            totalPages: totalPages,
            nextPage: nextPage,
            prevPage: prevPage,
            nextLink: nextLink,
            prevLink: prevLink,
            accountRequests: accountRequestAggregation
        });
    } catch (err) {
        console.error("Error on fetching business verification requests :", err);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};

exports.getRequestById = catchAsyncError(async (req, res) => {
    const { reqId } = req.query;

    if (!reqId) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "req Id is required");
    }

    const accountRequest = await AccountRequest.findById(reqId).populate('sendBy', 'email username profileImage phoneNumber businessName name');

    if (!accountRequest) {
        return response.responseHandlerWithMessage(res, false, statusCode.SUCCESS, "Account Request not found");
    }

    return response.responseHandlerWithData(res, true, statusCode.SUCCESS, "Account req fetched successfully.", accountRequest);

})

exports.approveAccountRequest = async (req, res) => {
    try {
        const { reqId } = req.query;

        if (!reqId) {
            return res.status(200).json({ success: false, message: "Request ID is required" });
        }

        const accountRequest = await AccountRequest.findById(reqId).populate('sendBy');

        if (!accountRequest) {
            return res.status(200).json({ success: false, message: "Account Request not found" });
        }

        if (accountRequest.status === "approved") {
            return res.status(200).json({ success: false, message: "Account Request is already approved" });
        }

        const { currentAccountType, requestedAccountType, sendBy } = accountRequest;


        if (!sendBy) {
            return res.status(200).json({ success: false, message: "Sender not found" });
        }

        let updateData = {};

        if (currentAccountType === "Individual" && requestedAccountType === "Expert") {
            updateData = { accountType: "Expert", adminApproval: "approved", blueTick: true, isConverted: true };
        } else if (currentAccountType === "Expert" && requestedAccountType === "Expert") {
            updateData = { status: "active", adminApproval: "approved", blueTick: true };
        } else if (currentAccountType === "Bussiness" && requestedAccountType === "Bussiness") {
            updateData = { blueTick: true, adminApproval: "approved" };
        } else {
            return res.status(200).json({ success: false, message: "Invalid account request" });
        }

        let userUpdate;

        switch (sendBy.accountType) {
            case 'Individual':

                const expertData = {
                    ...sendBy._doc, // Copy all fields from the original document
                    _id: sendBy._id, // Preserve the original _id
                    ...updateData
                };

                delete expertData.updatedAt;
                delete expertData.__v;

                await Individual.findByIdAndDelete(sendBy._id);

                userUpdate = await Expert.create(expertData);

                break;
            case 'Bussiness':
                userUpdate = await Bussiness.findOneAndUpdate(
                    { _id: sendBy._id, $or: [{ adminApproval: "pending" }, { adminApproval: "rejected" }] },
                    {
                        $set: updateData,
                        updatedAt: Date.now()
                    },
                    { new: true }
                );
                break;
            case 'Expert':
                userUpdate = await Expert.findOneAndUpdate(
                    { _id: sendBy._id, $or: [{ adminApproval: "pending" }, { adminApproval: "rejected" }] },
                    {
                        $set: updateData,
                        updatedAt: Date.now()
                    },
                    { new: true }
                )
                break;
            default:
                return res.status(200).json({ success: false, message: "Invalid account type" });
        }

        if (!userUpdate) {
            return res.status(200).json({ success: false, message: "User not found or already approved" });
        }

        await AccountRequest.findByIdAndUpdate(reqId, {
            status: "approved",
            updatedBy: req.user.data.id
        });

        return res.status(200).json({
            success: true,
            message: "Account request approved successfully",
            data: userUpdate,
        });

    } catch (err) {
        console.error("Error on changing account status:", err);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};

exports.rejectAccountRequest = async (req, res) => {
    try {
        const { reqId } = req.query;

        if (!reqId) {
            return res.status(200).json({ success: false, message: "Request ID is required" });
        }

        const accountRequest = await AccountRequest.findById(reqId).populate('sendBy');

        if (!accountRequest) {
            return res.status(200).json({ success: false, message: "Account Request not found" });
        }

        if (accountRequest.status === "rejected") {
            return res.status(200).json({ success: false, message: "Account Request is already rejected" });
        }

        const { currentAccountType, requestedAccountType, sendBy } = accountRequest;

        if (!sendBy) {
            return res.status(200).json({ success: false, message: "Sender not found" });
        }

        let updateData = {};
        let emailSubject = "";
        let emailMessage = "";

        if (currentAccountType === "Expert" && requestedAccountType === "Expert") {
            updateData = { status: "inactive", adminApproval: "rejected" };
            emailSubject = "Admin rejected your expert account request";
            emailMessage = `Admin has disapproved your expert account request.`;

        } else if (currentAccountType === "Bussiness" && requestedAccountType === "Bussiness") {
            updateData = { blueTick: false, adminApproval: "rejected" };
            emailSubject = "Admin rejected your business account request";
            emailMessage = `Admin has disapproved your business account request.`;

        } else if (currentAccountType === "Individual" && requestedAccountType === "Expert") {
            updateData = { accountType: "Individual" };
            emailSubject = "Admin rejected your request to become an expert";
            emailMessage = `Admin has disapproved your request to switch to an expert account.`;
        } else {
            return res.status(200).json({ success: false, message: "Invalid account request" });
        }

        let userUpdate;

        switch (sendBy.accountType) {
            case 'Individual':
                userUpdate = await Individual.findOneAndUpdate(
                    {
                        _id: sendBy._id
                    },
                    {
                        $set: updateData,
                        updatedAt: Date.now()
                    },
                    { new: true }
                )
                break;
            case 'Bussiness':
                userUpdate = await Bussiness.findOneAndUpdate(
                    { _id: sendBy._id, $or: [{ adminApproval: "pending" }, { adminApproval: "approved" }] },
                    {
                        $set: updateData,
                        updatedAt: Date.now()
                    },
                    { new: true }
                );
                break;
            case 'Expert':
                userUpdate = await Expert.findOneAndUpdate(
                    { _id: sendBy._id, $or: [{ adminApproval: "pending" }, { adminApproval: "approved" }] },
                    {
                        $set: updateData,
                        updatedAt: Date.now()
                    },
                    { new: true }
                )
                break;
            default:
                return res.status(200).json({ success: false, message: "Invalid account type" });
        }

        if (!userUpdate) {
            return res.status(200).json({ success: false, message: "User not found or already rejected" });
        }

        await AccountRequest.findByIdAndUpdate(reqId, {
            status: "rejected",
            updatedBy: req.user.data.id,
        });

        const mailOptions = {
            from: "ritik.singh@mobulous.com",
            to: "bhadauriaritik@gmail.com",
            subject: emailSubject,
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
            <h3>Hi ${sendBy.username},</h3>
            <p>${emailMessage}</p>
            <p>For more info, please contact the administrator.</p>
            <p>For assistance, reach us at support@askbizz.com.</p><br>
            <p>Best regards,</p>
            <p>The AskBizz Team</p>
          </div>
        </body>
        </html>
      `,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({
            success: true,
            message: "Account request rejected successfully",
            data: userUpdate,
        });

    } catch (err) {
        console.error("Error on rejecting account request:", err);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};