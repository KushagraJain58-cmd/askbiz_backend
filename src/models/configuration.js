let mongoose = require("mongoose");
let Schema = mongoose.Schema;


let configurationSchema = new Schema({
    interests: [
        new Schema({
            thumbnail: {
                type: String,
            },
            categoryName: {
                type: String,
            },
            interestsName: [String],
            status: {
                type: String,
                enum: ['active', 'inactive'],
                default: 'active'
            }
        }, { timestamps: true })
    ],
    reports: [
      new Schema({
        reportName: {
            type: String
        },
        description: {
            type: String
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active'
        }
      }, { timestamps: true })
    ],
    education: [
        new Schema({
            educationName: {
                type: String
            },
            universityName: {
                type: String
            },
            status: {
                type: String,
                enum: ['active', 'inactive'],
                default: 'active'
            }
        }, { timestamps: true }) 
    ],
    businessCategory: [
        new Schema({
            businessCategoryName: {
                type: String
            },
            status: {
                type: String,
                enum: ['active', 'inactive'],
                default: 'active'
            }
        }, { timestamps: true })
    ],
    areaOfExpertise: [
        new Schema({
            areaOfExpertiseName: {
                type: String
            },
            status: {
                type: String,
                enum: ['active', 'inactive'],
                default: 'active'
            }
        }, { timestamps: true })
    ]
}, {
    timestamps: true // Timestamps for the main document
});

let Configuration = mongoose.model('configuration', configurationSchema);

module.exports = Configuration;
