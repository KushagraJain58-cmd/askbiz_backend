const { catchAsyncError } = require("../../../utils/constants/generateError");
let response = require("../../../utils/constants/responseFunctions")
let statusCode = require("../../../utils/constants/responseCodes")
let bcrypt = require("bcrypt");
let generateSalt = require("../../../utils/constants/generateSalts");
let User = require("../../models/users");
let Individual = require("../../models/users").Individual;
let Bussiness = require("../../models/users").Bussiness;
let Expert = require("../../models/users").Expert;
let generatePin = require("../../../utils/constants/generatePin");
let transporter = require("../../config/nodemailer");
const { sendOtpEmail } = require("../../services/otp/sendOtpEmail");

// Phone OTP delivery isn't wired up to an SMS provider yet, so a fixed code
// is used for now — it's shown on the OTP screen so testing isn't blocked.
const STATIC_PHONE_OTP = 123456;
let jwt = require("jsonwebtoken");
let config = require("../../../utils/config").config;
let Admin = require("../../models/admin");
let AccountRequest = require("../../models/accountRequests");
let { recordLogin } = require("../../../utils/helpers/dailyLogins")
let axios = require("axios")


const generateForgetPasswordEmail = (name, otp) => {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 2;
                    background-color: #f8f8f8;
                }
                .container {
                    max-width: 600px;
                    padding: 20px;
                    background-color: #ffffff;
                    margin: 20px auto;
                    border-radius: 8px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }
                h3 {
                    color: #333;
                }
                .otp-box {
                    width: fit-content;
                    border: 1px solid #ccc;
                    padding: 10px;
                    border-radius: 5px;
                    margin-bottom: 10px;
                    font-weight: bold;
                    font-size: 24px;
                    text-align: center;
                }
                p {
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h3>Hi, ${name}</h3>
                <p>We've received a request to reset your password.</p>
                <p>If you initiated this request, please use the following OTP within 5 minutes:</p>
                <div class="otp-box">${otp}</div>
                <p>If you didn't request this, kindly ignore this message.</p>
                <p>For assistance, reach us at support@askbizz.com.</p>
                <br>
                <p>Best regards,</p>
                <p>The AskBizz Team</p>
            </div>
        </body>
        </html>
    `;
};

// <--------------------- Admin auth Controllers -------------------->

exports.adminLogin = catchAsyncError(async (req, res) => {
    const { query, password, deviceType, deviceToken } = req.body;

    const admin = await Admin.findOne({
        $or: [
            { email: { $regex: `^${query}$`, $options: "i" } },
            { phoneNumber: { $regex: `^${query}$`, $options: "i" } },
        ],
    })
        .populate("roleId")
        .lean();

    if (!admin) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Admin not found. Please sign up first."
        );
    }

    if (admin.roles === "SubAdmin" && admin.status !== "Active") {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "SubAdmin account is not active. Please contact admin for activation."
        );
    }

    const isMatch = bcrypt.compareSync(password, admin.password);
    if (!isMatch) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.UNAUTHORIZED,
            "Invalid credentials."
        );
    }

    const { _id, roles, roleId, permissions,profileImage, ...rest } = admin;
    const token = jwt.sign(
        {
            data: {
                id: _id,
                userType: roles,
                roleName: roleId?.roleName,
                permissions: permissions,
                profileImage: profileImage,
            },
        },
        config.secret_key,
        { expiresIn: "24h" }
    );

    const updatedAdmin = await Admin.findOneAndUpdate(
        {
            $or: [
                { email: { $regex: `^${query}$`, $options: "i" } },
                { phoneNumber: { $regex: `^${query}$`, $options: "i" } },
            ],
        },
        { $set: { accessToken: token } },
        { new: true }
    ).select('-password');


    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Admin login successful.",
        { admin_data: updatedAdmin }
    );
});


// <-------------------- User auth Controllers -------------------->

exports.userRegister = catchAsyncError(async (req, res) => {
    const { password, confirmPassword, accountType, location, provider, profileImage, coverImage, documents, fcmToken, deviceType, ...rest } = req.body;

    const isExistUser = await User.findOne({
        $or: [{ email: req.body.email }, { phoneNumber: req.body.phoneNumber }],
        accountType: accountType,
    });

    if (isExistUser) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.CONFLICT,
            "User already exists"
        );
    }

    let hashedPassword;

    if (password !== confirmPassword) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.CONFLICT,
            "Passwords do not match"
        );
    }

    const salt = bcrypt.genSaltSync(10);
    hashedPassword = bcrypt.hashSync(password, salt);

    let newUserData = { ...rest, 
        location, 
        documents,
        provider, 
        password: hashedPassword ? hashedPassword : null,
        profileImage : !profileImage || profileImage == "" ? 
        "https://img.freepik.com/free-vector/isolated-young-handsome-man-different-poses-white-background-illustration_632498-855.jpg?t=st=1728969252~exp=1728972852~hmac=bd6574d1a3ff490482879f29a493324d1e62d706ed395e9757b23de4430eb505&w=740" :
        profileImage,
        coverImage : !coverImage || coverImage == "" ?
        "https://cloudinary-marketing-res.cloudinary.com/images/w_1000,c_scale/v1679921049/Image_URL_header/Image_URL_header-png?_i=AA" :
        coverImage
    };

    if (location) {
        newUserData.location = {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
        };
    }
    if(documents && documents.length > 0){
        newUserData.documents = documents.map((document) => {
            return {
                docName : document.name,
                docLink : document.uri
            }
        })
    }

    console.log("newUserData",newUserData);

    let newUser;
    let accountReqObj;

    switch (accountType) {
        case "Individual":
            newUser = new Individual(newUserData);
            break;

        case "Bussiness":
            newUser = new Bussiness(newUserData);

            accountReqObj = {
                sendBy: newUser._id,
                status: "pending",
                currentAccountType: "Bussiness",
                requestedAccountType: "Bussiness",
                requestDate: new Date(),
            };

            const addAccountReq = await AccountRequest.create(accountReqObj);

            if (!addAccountReq) {
                return response.responseHandlerWithMessage(
                    res,
                    false,
                    statusCode.ERROR,
                    "Error adding account request for user"
                );
            }
            break;

        case "Expert":
            newUser = new Expert({ ...newUserData, status: "inactive" });

            accountReqObj = {
                sendBy: newUser._id,
                currentAccountType: "Expert",
                requestedAccountType: "Expert",
                status: "pending",
                requestDate: new Date(),
            };

            const addExpertAccountReq = await AccountRequest.create(accountReqObj);

            if (!addExpertAccountReq) {
                return response.responseHandlerWithMessage(
                    res,
                    false,
                    statusCode.ERROR,
                    "Error adding account request for user"
                );
            }
            break;

        default:
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.CONFLICT,
                "Invalid user type"
            );
    }

    const savedUser = await newUser.save();

    const payload = {
        id: savedUser._id,
        accountType: savedUser.accountType,
        data: {
            username: savedUser.username,
            email: savedUser.email,
            phoneNumber: savedUser.phoneNumber,
            location: savedUser.location,
            phoneNumberVerified: savedUser.phoneNumberVerified,
            emailVerified: savedUser.emailVerified,
            interest: savedUser.interest,
            profileImage: savedUser.profileImage,
            userType: "User",
        },
    };

    const token = jwt.sign(payload, config.secret_key);

    await User.findByIdAndUpdate(
        { _id: savedUser._id },
        { 
            $push: { 
                tokens: { 
                    accessToken: token,
                    fcmToken: fcmToken,
                    deviceType: deviceType,
                    lastUpdated: new Date()
                } 
            }
        },
        { new: true }
    );

    await recordLogin()

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.CREATED,
        "User created successfully",
        {
            userDetails: savedUser,
            token: token,
        }
    );
});

exports.userLogin = catchAsyncError(async (req, res) => {
    const { query, password, accountType, fcmToken, deviceType } = req.body;

    const user = await User.findOne({
        $or: [
            { email: { $regex: `^${query}$`, $options: "i" } },
            { phoneNumber: { $regex: `^${query}$`, $options: "i" } },
            { username: { $regex: `^${query}$`, $options: "i" } }
        ]
    }).lean();

    if (!user) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "User not found. Please sign up first."
        );
    }

    if (user.accountType !== accountType) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            `User account type mismatch. You are trying to log in as ${accountType}, but your account is ${user.accountType}.`
        );
    }

    if (user.status === "blocked") {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "User account is blocked. Please contact support team."
        );
    }

    if (!user.phoneNumberVerified && !user.emailVerified) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "User is not verified. Please verify either with phone number or email address."
        );
    } else if (!user.phoneNumberVerified && query === user.phoneNumber && user.emailVerified) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "User is not verified with phone number. Please try to sign in with email address."
        );
    } else if (!user.emailVerified && query === user.email && user.phoneNumberVerified) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "User is not verified with email. Please try to sign in with phone number."
        );
    }

    if (user.accountType === "Expert" && user.adminApproval !== "approved") {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "Expert account is pending approval by admin. Please try again later."
        );
    }

    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "Invalid credentials."
        );
    }

    const payload = {
        id: user._id,
        accountType: user.accountType,
        data: {
            username: user.username,
            name: user.name,
            businessName: user.businessName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            location: user.location,
            provider : user.provider,
            phoneNumberVerified: user.phoneNumberVerified,
            emailVerified: user.emailVerified,
            interest: user.interest,
            profileImage: user.profileImage,
            status: user.status,
            userType: 'User',
        },
    };

    const token = jwt.sign(payload, config.secret_key);

    let userTokens = user.tokens || [];

    if (userTokens.length >= 5) {
        userTokens.shift();
    }

    userTokens.push({
        accessToken: token,
        fcmToken: fcmToken,
        deviceType: deviceType,
        lastUpdated: new Date(),
    });

    const updatedUser = await User.findOneAndUpdate(
        {
            $or: [
                { email: { $regex: `^${query}$`, $options: "i" } },
                { phoneNumber: { $regex: `^${query}$`, $options: "i" } },
                { username: { $regex: `^${query}$`, $options: "i" } }
            ]
        },
        { 
            $push: { 
                tokens: { 
                    $each: [{
                        accessToken: token,
                        fcmToken: fcmToken,
                        deviceType: deviceType,
                        lastUpdated: new Date()
                    }],
                    $slice: -5 
                }
            }
        },
        { new: true }
    ).select(['-password',"-tokens","-bookmarkPosts","-hiddenPosts","-blockedUsers","-mutedCommunities","-mutedUsers","-accessToken"]);

    const updatedUserObject = updatedUser.toObject();
    updatedUserObject.accessToken = token;

    await recordLogin()

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Login successful.",
        { user: updatedUserObject }
    );
});

async function validateSocialToken(provider, token) {
    try {
        if (provider === 'google') {

            const response = await axios.get(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
            );

            console.log("response",response);
            return response.data && response.data.aud === config.google_client_id;

        }else if (provider === 'facebook') {

            const appToken = `${config.facebook_app_id}|${config.facebook_app_secret}`;

            const response = await axios.get(
                `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appToken}`
            );
        
            console.log("Facebook debug_token response--", response.data);
        
            const data = response.data.data;
        
            return data && data.is_valid && data.app_id === config.facebook_app_id;

        }else if (provider === 'linkedin'){

            const response = await axios.get(
                "https://api.linkedin.com/v2/me",
                { headers: { Authorization: `Bearer ${token}` } }
            )
            return response.data && response.data.aud === config.google_client_id;
                
        }
        return false;
    } catch (error) {
        return false;
    }
}

exports.socialLogin = catchAsyncError(async(req, res)=>{

    const { query, accountType, provider, socialToken, fcmToken, deviceType } = req.body;

    const user = await User.findOne({
        $or: [
            { email: query },
            { phoneNumber: query }
        ]
    }).lean();

    if (!user) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "User not found. Please sign up first."
        );
    }

    if (user.accountType !== accountType) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            `User account type mismatch. You are trying to log in as ${accountType}, but your account is ${user.accountType}.`
        );
    }

    if (user.provider !== provider) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            `User provider type mismatch. You are trying to log in with ${provider}, but your account signed up with ${user.provider}.`
        );
    }

    if (user.status === "blocked") {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "User account is blocked. Please contact support team."
        );
    }

    if (!user.phoneNumberVerified && !user.emailVerified) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "User is not verified. Please verify either with phone number or email address."
        );
    } else if (!user.phoneNumberVerified && query === user.phoneNumber && user.emailVerified) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "User is not verified with phone number. Please try to sign in with email address."
        );
    } else if (!user.emailVerified && query === user.email && user.phoneNumberVerified) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "User is not verified with email. Please try to sign in with phone number."
        );
    }

    if (user.accountType === "Expert" && user.adminApproval !== "approved") {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.FORBIDDEN,
            "Expert account is pending approval by admin. Please try again later."
        );
    }

    const isValidSocialToken = await validateSocialToken(provider, socialToken);

    if (!isValidSocialToken) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.UNAUTHORIZED,
            "Invalid social login token."
        );
    }

    const payload = {
        id: user._id,
        accountType: user.accountType,
        data: {
            username: user.username,
            name: user.name,
            businessName: user.businessName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            location: user.location,
            phoneNumberVerified: user.phoneNumberVerified,
            provider : user.provider,
            emailVerified: user.emailVerified,
            interest: user.interest,
            profileImage: user.profileImage,
            status: user.status,
            userType: 'User',
        },
    };

    const token = jwt.sign(payload, config.secret_key);

    const updatedUser = await User.findOneAndUpdate(
        {
            $or: [
                { email: query },
                { phoneNumber: query }
            ]
        },
        { 
            $push: { 
                tokens: { 
                    $each: [{
                        accessToken: token,
                        fcmToken: fcmToken,
                        deviceType: deviceType,
                        lastUpdated: new Date()
                    }],
                    $slice: -5 
                }
            }
        },
        { new: true }
    ).select(['-password',"-tokens","-bookmarkPosts","-hiddenPosts","-blockedUsers","-mutedCommunities","-mutedUsers","-accessToken"]);

    const updatedUserObject = updatedUser.toObject();
    updatedUserObject.accessToken = token;

    await recordLogin()

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Social Login successful.",
        { user: updatedUserObject }
    );
})

exports.getOTPForVerification = catchAsyncError(async (req, res) => {
    const { phoneNumber, email } = req.body;

    if (!phoneNumber && !email) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Please provide either email or phone number."
        );
    }

    let sendTo;
    const emailOtp = generatePin();
    // Phone OTP delivery (SMS/Twilio) isn't wired up yet, so it's a fixed
    // code for now — shown on the OTP screen so testing isn't blocked.
    const phoneOtp = STATIC_PHONE_OTP;
    const c_Date = new Date();

    if (phoneNumber && email) {
        sendTo = "both";
    } else if (phoneNumber) {
        sendTo = "phone";
    } else if (email) {
        sendTo = "email";
    }

    if (sendTo === "both" || sendTo === "email") {
        await sendOtpEmail({
            to: email,
            otp: emailOtp,
            purpose: "verify your email address",
        });
    }

    const otpData = sendTo === "both" ? {
            emailOtp: {
                otp: emailOtp,
                emailOtpTimeStampAt: c_Date
            }, phoneOtp: {
                otp: phoneOtp,
                phoneOtpTimeStampAt: c_Date
            }
          }: sendTo === "email"
            ? { emailOtp: { otp: emailOtp, emailOtpTimeStampAt: c_Date } }
            : { phoneOtp: { otp: phoneOtp, phoneOtpTimeStampAt: c_Date } };


    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        sendTo === "both"
            ? "OTP sent to both phone and email successfully"
            : sendTo === "email"
                ? "OTP sent to email successfully"
                : "OTP sent to phone successfully",
        otpData
    );
});

exports.checkUserByUsername = catchAsyncError(async (req, res) => {
    const { username, email, phoneNumber } = req.query;

    let searchResults = {
        username: { exists: false },
        email: { exists: false },
        phoneNumber: { exists: false },
    };

    if (!username && !email && !phoneNumber) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Please provide a username, email, or phone number to check."
        );
    }

    if (username) {
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            searchResults.username.exists = true;
        }
    }

    if (email) {
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            searchResults.email.exists = true;
        }
    }

    if (phoneNumber) {
        const existingNumber = await User.findOne({ phoneNumber });
        if (existingNumber) {
            searchResults.phoneNumber.exists = true;
        }
    }

    const userFound =
        searchResults.username.exists ||
        searchResults.email.exists ||
        searchResults.phoneNumber.exists;

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        userFound
            ? "At least one of the values already exists."
            : "Provided values are available.",
        {
            userfound: userFound,
            searchResults,
        }
    );
});

exports.userlogout = catchAsyncError(async (req, res) => {
    
    const accessToken = req.headers["x-access-token"];

    const removeSavedToken = await User.findByIdAndUpdate(
        req.user.id,
        {
            $pull: { tokens: { accessToken: accessToken } } // Remove the specific token
        },
        { new: true }
    );

    if (!removeSavedToken) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            "User not found to logout."
        );
    }

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        "Logged out successfully"
    );
});


// <------------------- Common Auth Controllers ------------------->

exports.getForgetPasswordOTP = catchAsyncError(async (req, res) => {
    const { query, getOtpFor } = req.query;

    if (!query) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Please provide a valid email or phone number."
        );
    }

    let requester;
    if (getOtpFor === "user") {
        requester = await User.findOne({
            $or: [{ email: query }, { phoneNumber: query }],
        });
    } else if (getOtpFor === "admin") {
        requester = await Admin.findOne({
            $or: [{ email: query }, { phoneNumber: query }],
        });
    }

    if (!requester) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.RESULTNOTFOUND,
            `${getOtpFor} doesn't exist.`
        );
    }

    const otp = generatePin();
    const c_Date = new Date();

    const emailContent = generateForgetPasswordEmail(requester.name, otp);

    const mailOptions = {
        from: "ritik.singh@mobulous.com",
        to: requester.email,
        subject: "Forget Password OTP",
        html: emailContent,
    };

    await transporter.sendMail(mailOptions);

    console.log("OTP sent successfully");

    return response.responseHandlerWithData(
        res,
        true,
        statusCode.SUCCESS,
        "Forget password OTP sent successfully.",
        {
            otp: otp,
            otpTimeStamp: c_Date,
        }
    );
});

exports.resetPassword = catchAsyncError(async (req, res) => {
    const { resetPasswordFor, query, currentPassword, newPassword, confirmPassword } = req.body;

    if (!resetPasswordFor || !newPassword || !confirmPassword || !query) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.DATAMISSING,
            "Missing required fields"
        );
    }

    if (newPassword !== confirmPassword) {
        return response.responseHandlerWithMessage(
            res,
            false,
            statusCode.CONFLICT,
            "Passwords do not match"
        );
    }

    let requester;
    if (resetPasswordFor === "user") {

        requester = await User.findOne({
            $or: [{ email: query }, { phoneNumber: query }, { username: query }],
        });

        if (!requester) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "User not found"
            );
        }

        if (currentPassword) {
            const passwordMatch = bcrypt.compareSync(currentPassword, requester.password);
            if (!passwordMatch) {
                return response.responseHandlerWithMessage(
                    res,
                    false,
                    statusCode.UNAUTHORIZED,
                    "Incorrect current password"
                );
            }
        }

        const salt = bcrypt.genSaltSync(generateSalt());
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        await User.findOneAndUpdate(
            { _id: requester._id },
            { $set: { password: hashedPassword } },
            { new: true }
        );

    } else if (resetPasswordFor === "admin") {
        const admin = await Admin.findOne({
            $or: [{ email: query }, { phoneNumber: query }],
        });

        if (!admin) {
            return response.responseHandlerWithMessage(
                res,
                false,
                statusCode.RESULTNOTFOUND,
                "Admin not found"
            );
        }

        const salt = bcrypt.genSaltSync(generateSalt());
        const hashedPassword = bcrypt.hashSync(newPassword, salt);
        admin.password = hashedPassword;
        await admin.save();
    }

    return response.responseHandlerWithMessage(
        res,
        true,
        statusCode.SUCCESS,
        "Password reset successfully"
    );
});


