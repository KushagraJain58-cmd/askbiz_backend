let mongoose = require("mongoose");
let User = require("./users");
let Post = require("./post");
let Community = require("./community");

let reportSchema = new mongoose.Schema(
  {
    reportType: {             // store report type.
      type: String,
      enum: ["user", "individualPost","community", "communityPost"]
    },
    reportBy: {               // store report by user Id
      type: mongoose.Schema.Types.ObjectId,
      ref: User,
      required: true,
    },
    reportToUser: {            // store reported User Id
      type: mongoose.Schema.Types.ObjectId,
      ref: User
    }, 
    postId: {                  // store reported Post Id
        type: mongoose.Schema.Types.ObjectId,
        ref: Post,
    },
    postByUserId: {            // store post creater of reported post
        type: mongoose.Schema.Types.ObjectId,
        ref: User,
    },
    reportToCommunity: {       // store Reported community Id
      type : mongoose.Schema.Types.ObjectId,
      ref: Community
    },
    reportToCommunityPost: {    // store community Id of commuity reported Posts
      type : mongoose.Schema.Types.ObjectId,
      ref : Community
    },
    reportNameId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    reportReason : {
      type: String,
      default: null
    },
    reportSeen: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  {
    timestamps: true,
  }
);

var Report = mongoose.model("Report", reportSchema);
module.exports = Report;
