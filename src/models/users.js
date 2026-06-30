let mongoose = require("mongoose");
let Schema = mongoose.Schema;
let model = mongoose.model;

// User Base Schema
let userBaseSchema = new Schema({
    username: String,
    email: String,
    password: String,
    phoneNumber: String,
    status: {
        type: String,
        enum: ["active", "blocked", "inactive"],
        default: "active"
    },
    phoneNumberVerified: {
        type: Boolean,
        default: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    interest: [{
        interestType: String,
        value: [String]
    }],
    accountType: {
        type: String,
        enum: ["Individual", "Bussiness", "Expert"]
    },
    communityGuidelines: {
        type: Boolean,
        default: false
    },
    mutedUsers: [
        {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    mutedCommunities : [
        {
            type: Schema.Types.ObjectId,
            ref: 'Community'
        }
    ],
    blockedUsers: [
        {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    hiddenPosts: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Post'
        }
    ],
    bookmarkPosts:[
        {
            type: Schema.Types.ObjectId,
            ref: 'Post'
        }
    ],
    location: { 
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: { 
            type: [Number],
            default: [0, 0]
        },
        cityName: {
            type: String,
            required: false
        }
    },
    googleId: String,
    facebookId: String,
    provider: {
        type: String,
        enum: ['google','facebook','linkedin','own'],
        default: 'own'
    },
    countryFlag: String,
    countryCode: String,
    profileImage: {
        type: String,
        default: 'https://img.freepik.com/free-vector/isolated-young-handsome-man-different-poses-white-background-illustration_632498-855.jpg?t=st=1728969252~exp=1728972852~hmac=bd6574d1a3ff490482879f29a493324d1e62d706ed395e9757b23de4430eb505&w=740'
    },
    coverImage: {
        type: String,
        default: 'https://cloudinary-marketing-res.cloudinary.com/images/w_1000,c_scale/v1679921049/Image_URL_header/Image_URL_header-png?_i=AA'
    },
    notificationOff : {
        type: Boolean,
        default: false
    },
    profileLink : {
        type : String,
        default : ''
    },
    tokens: [
        {
            accessToken: { type: String, default: null }, // Store accessToken per device
            fcmToken: { type: String, required: false }, // Push notification token
            deviceType: { type: String, enum: ['ios', 'android'], required: false },
            lastUpdated: { type: Date, default: Date.now }
        }
    ],
}, {
    discriminatorKey: 'accountType',
    timestamps: true
});

userBaseSchema.index({
    location: "2dsphere"
});

let User = model('user', userBaseSchema);

// Individual Schema
let Individual = User.discriminator('Individual', new Schema({
    name: String,
    dob: Date,
    gender: String,
    shortBio: String,
    education: [{
        eductionType: String,
        college: String
    }],
    occupationTitle: String,
    occupationSector: String,
    workExperience: String,
    detailBio: String,
    companyName: String,
    expertise: String,
    documents: [{
        docName : String,
        docLink : String
    }]
}, {
    timestamps: true
}));

// Business Schema
let Bussiness = User.discriminator('Bussiness', new Schema({
    businessName: String,
    businessCategory: String,
    establishmentYear: String,
    businessContactNumber: String,
    websiteURL: String,
    businessSize: String,
    products: String,
    services: String,
    description: String,
    photos: [String],
    adminApproval: {
        type: String,
        enum: ['approved', 'pending', 'rejected'],
        default: 'pending'
    },
    blueTick: {
        type: Boolean,
        default: false
    },
    businessCountryFlag : String,
    businessCountryCode : String
}));

// Expert Schema
let Expert = User.discriminator('Expert', new Schema({
    name: String,
    dob: Date,
    gender: String,
    education: [{
        eductionType: String,
        college: String
    }],
    occupationTitle: String,
    occupationSector: String,
    workExperience: String,
    shortBio: String,
    detailBio: String,
    companyName: String,
    expertise: String,
    documents: [{
        docName : String,
        docLink : String
    }],
    adminApproval: {
        type: String,
        enum: ['approved', 'pending', 'rejected'],
        default: 'pending'
    },
    blueTick: {
        type: Boolean,
        default: false
    },
    isConverted: {
        type: Boolean,
        default: false
    }
}));


// Exporting modules using module.exports in ES5
module.exports = User;
module.exports.Individual = Individual;
module.exports.Bussiness = Bussiness;
module.exports.Expert = Expert;

