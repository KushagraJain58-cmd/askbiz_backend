const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');

let s3 = new S3Client({
    region: process.env.AWS_S3_REGION||'',
    credentials: {
      accessKeyId: process.env.AWS_S3_ACCESSS_KEY_ID||"",
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY||"",
    },
  });


const storage = multer.memoryStorage();

const uploadToDisk = multer({
  storage: storage
});

const uploadToAws = multer({

  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME||'',
    acl: 'public-read',
    key: function (req, file, cb) {
      cb(null, 'askbiz/' + Date.now() + '-' + file.originalname);
    },
  }),
  
});

module.exports = { uploadToDisk, uploadToAws };