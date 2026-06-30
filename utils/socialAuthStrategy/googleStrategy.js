var passport = require("passport");
var passportGoogleOauth20 = require('passport-google-oauth20');
var dotenv = require('dotenv');
var generateSalt = require("../constants/generateSalts");
var generateRandomPassword = require("../constants/generatePassword");
var bcrypt = require("bcrypt");
var User = require("../../src/models/users");
var Individual = require("../../src/models/users").Individual;
var Experience = require("../../src/models/users").Experience;
var Expert = require("../../src/models/users").Expert;

var socialGoogleAuthStrategy = function() {
    dotenv.config();
    var GoogleStrategy = passportGoogleOauth20.Strategy;
    passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID || "735049577384-ka29n2qdmjc67kji7u45hau6uqkoj7fu.apps.googleusercontent.com",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "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",
            callbackURL: 'http://localhost:9094/api/v1/auth/google/callback',
            passReqToCallback: true
        },
        async function(request, accessToken, refreshToken, profile, done) {
            var apiUser = profile._json;
            console.log("Google api user details::>> ", apiUser);

            var accountType = request.session.lastQuery.accountType;

            var isUserExist = await User.findOne({
                email: apiUser.email
            });

            if (!isUserExist) {
                console.log("--New User Register through Google Sign In--");
                var number = generateSalt();
                var password = generateRandomPassword();

                var salt = bcrypt.genSaltSync(number);
                var hash = bcrypt.hashSync(password, salt);
                // const id = generateUniqueAccountId();

                var userObj = {
                    googleId: apiUser.sub,
                    provider: 'google',
                    // accountId:id,
                    email: apiUser.email,
                    password: hash,
                    profileImage: apiUser.picture,
                    emailVerified: true
                };

                var newUser;

                switch (accountType) {
                    case "Individual":
                        userObj.name = apiUser.name;
                        userObj.accountType = accountType;
                        newUser = new Individual(userObj);
                        break;
                    case "Experience":
                        userObj.bussinessName = apiUser.name;
                        userObj.accountType = accountType;
                        newUser = new Experience(userObj);
                        break;
                    case "Expert":
                        userObj.name = apiUser.name;
                        userObj.accountType = accountType;
                        newUser = new Expert(userObj);
                        break;
                    default:
                        console.log("Account type is invalid.");
                        // return done(err);
                }

                var savedUser = await newUser.save();

                // sendRegistrationMail(apiUser.name, apiUser.email, savedSeller.accountId, password);
                return done(null, savedUser);
            } else {
                console.log("--User Already Register through Google Sign In--");
                return done(null, isUserExist);
            }
            //done(null, profile);
        }
    ));
};

// Uncomment for session serialization/deserialization
// passport.serializeUser(function(user, done) {
//     done(null, user);
// });

// passport.deserializeUser(function(user, done) {
//     done(null, user);
// });

module.exports = socialGoogleAuthStrategy;
