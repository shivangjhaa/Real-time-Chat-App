// src/index.js
require("dotenv").config({ path: "./.env" });
const { CognitoJwtVerifier } = require("aws-jwt-verify");
require("./db/mongoose");
const Message = require("./models/Message");

const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const multer = require("multer");

const {
  generateMessage,
  generateLocationMessage,
  generateFileMessage,         // NEW
} = require("./utils/messages");
const { uploadFileToS3 } = require("./utils/s3");   // NEW

const server = http.createServer(app);
const io = socketio(server);

const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/users");

// --- Static files ---
const viewsPath = path.join(__dirname, "../public");
app.use(express.static(viewsPath));
app.use(express.json());

// --- Cognito verifier ---
const verifier = CognitoJwtVerifier.create({
  userPoolId: "ap-south-1_zkpv1rOQe",
  tokenUse: "id",
  clientId: "7jba75ak4gs48c4uoa0s7c3bho",
});

// --- Multer: memory storage (no disk writes) ---
// memoryStorage keeps the file as a Buffer in req.file.buffer
// This avoids disk I/O and temporary file cleanup issues.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard limit at multer level too
});

// =====================================================
// FILE UPLOAD ROUTE
// POST /upload
// Authenticates via Cognito token in Authorization header,
// uploads the file to S3, then emits a Socket.IO fileMessage
// to the correct room so all members see it instantly.
// =====================================================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // 1. Authenticate the request using the Cognito token
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    await verifier.verify(token); // throws if invalid

    // 2. Validate file presence and room
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const room = req.body.room;
    const username = req.body.username;

    if (!room || !username) {
      return res.status(400).json({ error: "room and username are required" });
    }

    // 3. Upload to S3
    const { fileUrl, fileName, fileType } = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      room
    );

    // 4. Persist to MongoDB
    const newMessage = new Message({
      username,
      room,
      fileUrl,
      fileName,
      fileType,
      type: "file",
    });
    await newMessage.save();

    // 5. Broadcast to all users in the room via Socket.IO
    io.to(room).emit(
      "fileMessage",
      generateFileMessage(username, fileUrl, fileName, fileType)
    );

    // 6. Respond to the uploader
    res.json({ success: true, fileUrl, fileName });
  } catch (err) {
    console.error("Upload error:", err.message);

    if (err.message.includes("not allowed") || err.message.includes("10 MB")) {
      return res.status(400).json({ error: err.message });
    }
    if (err.name === "JwtExpiredError" || err.name === "JwtInvalidClaimError") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    res.status(500).json({ error: "Upload failed. Please try again." });
  }
});

// --- Socket.IO Middleware (Cognito auth) ---
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token provided"));
    const payload = await verifier.verify(token);
    socket.user = payload;
    next();
  } catch (err) {
    next(new Error("Unauthorized"));
  }
});

// --- Socket.IO Events ---
io.on("connection", (socket) => {
  socket.on("join", async ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room });
    if (error) return callback(error);

    socket.join(user.room);
    socket.emit("message", generateMessage("Admin", `Welcome ${user.username}!`));

    // Load old messages (text, location, AND file)
    const oldMessages = await Message.find({ room: user.room })
      .sort({ createdAt: 1 })
      .limit(50);

    oldMessages.forEach((msg) => {
      if (msg.type === "text") {
        socket.emit("message", generateMessage(msg.username, msg.text));
      } else if (msg.type === "location") {
        socket.emit("locationMessage", generateLocationMessage(msg.username, msg.url));
      } else if (msg.type === "file") {
        // Replay file messages to the newly joined user
        socket.emit(
          "fileMessage",
          generateFileMessage(msg.username, msg.fileUrl, msg.fileName, msg.fileType)
        );
      }
    });

    socket.broadcast.to(user.room).emit(
      "message",
      generateMessage("Admin", `${user.username} has joined`)
    );

    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on("sendMessage", async (message, callback) => {
    const user = getUser(socket.id);
    if (user) {
      const newMessage = new Message({
        username: user.username,
        room: user.room,
        text: message,
        type: "text",
      });
      await newMessage.save();
      io.to(user.room).emit("message", generateMessage(user.username, message));
    }
    callback();
  });

  socket.on("sendLocation", async (coords, callback) => {
    const user = getUser(socket.id);
    if (user) {
      const url = `https://google.com/maps?q=${coords.latitude},${coords.longitude}`;
      const newMessage = new Message({
        username: user.username,
        room: user.room,
        url,
        type: "location",
      });
      await newMessage.save();
      io.to(user.room).emit(
        "locationMessage",
        generateLocationMessage(user.username, url)
      );
    }
    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit("message", generateMessage("Admin", `${user.username} has left!`));
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Server is running on port", port);
});