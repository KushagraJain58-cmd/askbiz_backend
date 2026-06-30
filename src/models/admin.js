let mongoose = require("mongoose");
let Schema = mongoose.Schema;

let adminSchema = new Schema({
    adminId: {
        type: String,
        unique: true,
        sparse: true
    },
    name: String,
    email: {
        type: String,
        unique: true,
        required: true
    },
    phoneNumber: String,
    roles: {
        type: String,
        enum: ["Admin","SubAdmin"],
        default: 'SubAdmin'
    },
    roleId: {
        type: Schema.Types.ObjectId,
        ref: "Role"
    },
    password: String,
    roleName: String,
    profileImage: {
      type: String,
      default: 'https://img.freepik.com/free-vector/isolated-young-handsome-man-different-poses-white-background-illustration_632498-855.jpg?t=st=1728969252~exp=1728972852~hmac=bd6574d1a3ff490482879f29a493324d1e62d706ed395e9757b23de4430eb505&w=740'
    },
    permissions: [
        {
            module: {
                type: String,
                required: true
            },
            readAccess: {
                type: Boolean,
                default: false
            },
            fullAccess: {
                type: Boolean,
                default: false
            }
        }
    ],
    status: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Active"
    },
    accessToken: String,
    fcmTokens: [
      {
        token: { type: String, required: true },
        deviceType: { type: String, enum: ['web'], default : "web" },
        lastUpdated: { type: Date, default: Date.now }
      }
    ]
}, {
    timestamps: true
});


adminSchema.pre('save', async function (next) {
    if (this.isNew && this.roles == 'SubAdmin') {
      try {
        const lastSubAdmin = await Admin.findOne({ adminId: { $ne: null } })
          .sort({ createdAt: -1 })
          .select('adminId');
  
        let lastSubAdminNumber = 0;
        if (lastSubAdmin && lastSubAdmin.adminId) {
          const match = lastSubAdmin.adminId.match(/S-(\d+)/);
          if (match) {
            lastSubAdminNumber = parseInt(match[1], 10);
          }
        }
  
        const nextSubAdminNumber = lastSubAdminNumber + 1;
        this.adminId = `S-${String(nextSubAdminNumber).padStart(2, '0')}`;
      } catch (error) {
        return next(error);
      }
    }
    next();
  });

let Admin = mongoose.model('admin', adminSchema);

module.exports = Admin;
