let mongoose = require('mongoose');

let roleSchema = new mongoose.Schema({
    roleName: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
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
    ]
}, { timestamps: true });

let Role = mongoose.model('Role', roleSchema);
module.exports = Role;
