let mongoose = require("mongoose");

let cmsSchema = new mongoose.Schema(
  {
    privacyPolicy: {
      type: String
    },
    aboutUs: {
      type: String
    },
    contactUs: {
      type: String
    },
    termsAndConditions: {
        type: String
    },
    communityGuidelines:{
        type: String
    },
    lastUpdate : {
        adminId : {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true
        },
        updatedContent : {
            type: String,
        },
        updatedDate: {
            type: Date,
            default: Date.now
        }
    }
  },
  {
    timestamps: true,
  }
);

let Cms = mongoose.model("Cms", cmsSchema);
module.exports = Cms;
