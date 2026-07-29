const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDb = require('./src/config/mongoose');
const router = require('./src/routes');
const config = require('./utils/config').config;
const errorMiddleware = require('./src/middelwares/error');
const { socketUtiles } = require("./socket");
const { registerAIHandlers } = require("./aiSocket");
const jwt = require("jsonwebtoken");
require("./utils/workers");

dotenv.config();

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST","PUT", "DELETE"],
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.all("*", (req, res, next) => {
  console.log("Common Request:", {
    Host: req.headers.host,
    ContentType: req.headers['content-type'],
    Url: req.originalUrl,
    Method: req.method,
    Query: req.query,
    Body: req.body,
    Params: req.params
  });
  next();
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use('/api/v1', router);

app.use(errorMiddleware);


io.on("connection", async (socket) => {
  try {

    const token = socket.handshake.auth.token || socket.handshake.headers["x-access-token"];

    if (!token) {
      console.log("No token provided, disconnecting user.");
      socket.emit("connect-error", { message: "Unauthorized access" });
      return setTimeout(() => socket.disconnect(true), 1000);
    }

    const decoded = jwt.verify(token, config.secret_key);
    
    const tokenData = {
      userId : decoded.id || decoded.data.id,
      name : decoded.data.name || decoded.data.businessName || "Admin",
      userType : decoded.data.userType,
      profileImage : decoded.data.profileImage,
      accountType : decoded.accountType || "Admin"
    }

    socket.data = tokenData;

    socket.emit("connection-success", { message: "Connected successfully", userId: socket.userId });

    socketUtiles(io, socket);

    registerAIHandlers(socket);

    socket.on("disconnect", () => {

      console.log(`User disconnected: ${socket.userId}.`);
    
    });

  } catch (error) {
    console.error("Socket authentication error:", error.message);
    socket.emit("connect-error", { message: error.message || "Unauthorized access" });
    setTimeout(() => socket.disconnect(), 1000);
  }
});

app.set('socket', io);

// server.listen(config.port, () => {
//   console.log(`Server running on port ${config.port}`);
// });

(async () => {
  try {
    await connectDb();

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();
