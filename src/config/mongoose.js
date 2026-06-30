// let mongoose = require("mongoose");
// let config = require("../../utils/config").config;

// let connectDb = (function () {
//   return mongoose.connect(config.mongodburl)
//     .then(function () {
//       console.log("Connected to MongoDB");
//     })
//     .catch(function (error) {
//       console.error("Error connecting to MongoDB:", error);
//     });
// })();

// module.exports = connectDb;


const mongoose = require("mongoose");
const { config } = require("../../utils/config");

mongoose.set("bufferCommands", false);

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDb() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(config.mongodburl, {
        serverSelectionTimeoutMS: 30000,
      })
      .then((mongoose) => {
        console.log("Connected to MongoDB");
        return mongoose;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDb;
