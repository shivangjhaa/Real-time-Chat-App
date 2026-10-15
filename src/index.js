// src/index.js
require("dotenv").config({ path: "./.env" });
const crypto = require("crypto");
const { CognitoJwtVerifier } = require("aws-jwt-verify");
require("./db/mongoose");
const Message = require("./models/Message");
const FlaggedMessage = require("./models/FlaggedMessage");
const Incident = require("./models/Incident");
const Block = require("./models/Block");

const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const multer = require("multer");

const {
  generateMessage,
  generateLocationMessage,
  generateFileMessage,
} = require("./utils/messages");
const { uploadFileToS3 } = require("./utils/s3");
const { analyzeMessage } = require("./utils/moderation");
const { analyzeWithComprehend, isComprehendConfigured } = require("./utils/comprehend");

const server = http.createServer(app);
const io = socketio(server);

const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/users");

// --- Static files & middleware ---
const viewsPath = path.join(__dirname, "../public");
app.use(express.static(viewsPath));
app.use(express.json());

// --- Cognito verifier ---
const verifier = CognitoJwtVerifier.create({
  userPoolId: "ap-south-1_zkpv1rOQe",
  tokenUse: "id",
  clientId: "7jba75ak4gs48c4uoa0s7c3bho",
});

// Optional/Soft Cognito Auth Helper for REST routes
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "No authentication token provided" });
  }
  try {
    const payload = await verifier.verify(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session token" });
  }
};

// --- Multer: memory storage ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// =====================================================
// FILE UPLOAD ROUTE
// =====================================================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No authentication token provided" });
    }

    await verifier.verify(token);

    if (!req.file) {
      return res.status(400).json({ error: "No file selected for upload" });
    }

    const room = (req.body.room || "").trim().toLowerCase();
    const roomName = (req.body.roomName || req.body.room || "").trim();
    const username = (req.body.username || "").trim();

    if (!room || !username) {
      return res.status(400).json({ error: "Room and username are required" });
    }

    const { fileUrl, fileName, fileType } = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      room
    );

    const newMessage = new Message({
      username,
      room,
      roomName,
      fileUrl,
      fileName,
      fileType,
      type: "file",
    });
    await newMessage.save();

    io.to(room).emit(
      "fileMessage",
      generateFileMessage(username, fileUrl, fileName, fileType)
    );

    res.json({ success: true, fileUrl, fileName, fileType });
  } catch (err) {
    console.error("Upload error:", err.message);

    if (err.message && (err.message.includes("not allowed") || err.message.includes("10 MB"))) {
      return res.status(400).json({ error: err.message });
    }
    if (err.name === "JwtExpiredError" || err.name === "JwtInvalidClaimError") {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    res.status(500).json({ error: err.message || "Upload failed. Please try again." });
  }
});

// =====================================================
// SAFECHAT AI THREAT DETECTION & INCIDENT APIS
// =====================================================

// Health & System Capability Status
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    platform: "SafeChat Intelligent Protection",
    awsComprehend: isComprehendConfigured() ? "available" : "fallback_mode",
    s3Bucket: process.env.S3_BUCKET_NAME || "configured",
    timestamp: new Date().toISOString(),
  });
});

// Interactive Threat Analysis & Testing Sandbox
app.post("/api/moderation/test", async (req, res) => {
  try {
    const { message = "", room = "test-room", username = "tester" } = req.body;
    const moderation = analyzeMessage(message, { room, username });

    // Enrich with AWS Comprehend (sentiment & entities)
    let aiEnrichment = { available: false };
    try {
      aiEnrichment = await analyzeWithComprehend(message);
    } catch (e) {
      // safe fallback
    }

    res.json({
      success: true,
      moderation: {
        ...moderation,
        aiSentiment: aiEnrichment.sentiment || "N/A",
        aiEntities: aiEnrichment.entities || [],
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Incident Report with Cryptographic Integrity
app.post("/api/incidents", async (req, res) => {
  try {
    const {
      reporter,
      reportedUser,
      room,
      roomName,
      messageText,
      category,
      riskScore,
      threatLevel,
      explanation,
      matchedSignals,
      userNotes,
    } = req.body;

    if (!reporter || !reportedUser || !messageText) {
      return res.status(400).json({ error: "Reporter, reported user, and message content are required" });
    }

    // Retrieve last 5 messages from the room as tamper-evident contextual evidence
    const recentContext = await Message.find({ room: (room || "").toLowerCase() })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const evidenceContext = recentContext.reverse().map((m) => ({
      username: m.username,
      text: m.text || (m.type === "file" ? `[File: ${m.fileName}]` : "[Location]"),
      timestamp: m.createdAt,
    }));

    // Generate SHA-256 evidence integrity checksum
    const payloadToHash = JSON.stringify({
      reporter,
      reportedUser,
      messageText,
      evidenceContext,
      timestamp: new Date().toISOString(),
    });
    const evidenceChecksum = crypto.createHash("sha256").update(payloadToHash).digest("hex");

    const incidentId = `INC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const incident = new Incident({
      incidentId,
      reporter,
      reportedUser,
      room: (room || "").toLowerCase(),
      roomName: roomName || room,
      messageText,
      category: category || "Unspecified",
      riskScore: Number(riskScore) || 50,
      threatLevel: threatLevel || "Warning",
      explanation: explanation || "",
      matchedSignals: Array.isArray(matchedSignals)
        ? matchedSignals.map((s) => (typeof s === "string" ? { label: s } : s))
        : [],
      userNotes: userNotes || "",
      status: "pending",
      evidenceChecksum,
      evidenceContext,
    });

    await incident.save();

    res.status(201).json({
      success: true,
      incidentId,
      message: "Incident successfully logged and evidence secured",
      incident,
    });
  } catch (err) {
    console.error("Create incident error:", err);
    res.status(500).json({ error: err.message || "Failed to create incident report" });
  }
});

// List Incident Reports (with category, status, and room filters)
app.get("/api/incidents", async (req, res) => {
  try {
    const { status, category, room, limit = 50 } = req.query;
    const filter = {};

    if (status && status !== "all") filter.status = status;
    if (category && category !== "all") filter.category = category;
    if (room && room !== "all") filter.room = room.toLowerCase();

    const incidents = await Incident.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    res.json({ success: true, count: incidents.length, incidents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Incident Status & Resolution Notes
app.patch("/api/incidents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actionTaken } = req.body;

    const incident = await Incident.findOneAndUpdate(
      { incidentId: id },
      {
        ...(status && { status }),
        ...(actionTaken && { actionTaken }),
      },
      { new: true }
    );

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    res.json({ success: true, incident });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Block User Endpoint
app.post("/api/block", async (req, res) => {
  try {
    const { blocker, blockedUser, reason } = req.body;
    if (!blocker || !blockedUser) {
      return res.status(400).json({ error: "Blocker and blockedUser are required" });
    }

    if (blocker.toLowerCase() === blockedUser.toLowerCase()) {
      return res.status(400).json({ error: "You cannot block yourself" });
    }

    const block = await Block.findOneAndUpdate(
      { blocker: blocker.toLowerCase(), blockedUser: blockedUser.toLowerCase() },
      { reason: reason || "User blocked by participant" },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: `User ${blockedUser} blocked`, block });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Blocked Users for a participant
app.get("/api/blocks/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const blocks = await Block.find({ blocker: (username || "").toLowerCase() }).lean();
    res.json({ success: true, blockedUsers: blocks.map((b) => b.blockedUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unblock User
app.delete("/api/block", async (req, res) => {
  try {
    const { blocker, blockedUser } = req.body;
    await Block.deleteOne({
      blocker: (blocker || "").toLowerCase(),
      blockedUser: (blockedUser || "").toLowerCase(),
    });
    res.json({ success: true, message: `User ${blockedUser} unblocked` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Safety Analytics Dashboard Metrics
app.get("/api/analytics/stats", async (req, res) => {
  try {
    const totalMessages = await Message.countDocuments();
    const flaggedCount = await FlaggedMessage.countDocuments();
    const incidentCount = await Incident.countDocuments();
    const activeBlocksCount = await Block.countDocuments();

    // Category breakdown
    const categoryAgg = await FlaggedMessage.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const categoryDistribution = {
      "Scam/Fraud": 0,
      "Harassment": 0,
      "Ragging/Coercion": 0,
      "Blackmail": 0,
      "Repeated Unsafe": 0,
    };
    categoryAgg.forEach((item) => {
      if (item._id) {
        categoryDistribution[item._id] = item.count;
      }
    });

    // Threat level breakdown
    const levelAgg = await FlaggedMessage.aggregate([
      { $group: { _id: "$threatLevel", count: { $sum: 1 } } },
    ]);
    const threatLevels = {
      Safe: 0,
      Caution: 0,
      Warning: 0,
      Dangerous: 0,
    };
    levelAgg.forEach((item) => {
      if (item._id && threatLevels.hasOwnProperty(item._id)) {
        threatLevels[item._id] = item.count;
      }
    });

    // Recent Flagged Messages
    const recentFlagged = await FlaggedMessage.find()
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    // Recent Incidents
    const recentIncidents = await Incident.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      totals: {
        totalMessages,
        flaggedCount,
        incidentCount,
        activeBlocksCount,
        protectionRate: totalMessages > 0 ? Math.round(((totalMessages - flaggedCount) / totalMessages) * 100) : 100,
      },
      categoryDistribution,
      threatLevels,
      recentFlagged,
      recentIncidents,
    });
  } catch (err) {
    console.error("Analytics stats error:", err);
    res.status(500).json({ error: err.message });
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
  socket.on("join", async ({ username, room, roomName }, callback) => {
    // Robust room isolation: Ensure room identifier is namespaced by roomName if not already prefixed
    const cleanRoomName = (roomName || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    let cleanRoomId = (room || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");

    if (cleanRoomName && cleanRoomId && !cleanRoomId.startsWith(`${cleanRoomName}-`)) {
      cleanRoomId = `${cleanRoomName}-${cleanRoomId}`;
    }

    const displayRoomName = (roomName || (cleanRoomId.includes("-") ? cleanRoomId.split("-")[0] : cleanRoomId)).trim();

    const { error, user } = addUser({ id: socket.id, username, room: cleanRoomId, roomName: displayRoomName });
    if (error) return callback(error);

    socket.join(user.room);
    socket.emit("message", generateMessage("Admin", `Welcome to SafeChat, ${user.username}!`));

    // Load recent history (up to 50 messages)
    const oldMessages = await Message.find({ room: user.room })
      .sort({ createdAt: 1 })
      .limit(50);

    oldMessages.forEach((msg) => {
      if (msg.type === "text") {
        const msgPayload = generateMessage(msg.username, msg.text, msg.moderation);
        msgPayload._id = msg._id;
        socket.emit("message", msgPayload);
      } else if (msg.type === "location") {
        socket.emit("locationMessage", generateLocationMessage(msg.username, msg.url));
      } else if (msg.type === "file") {
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
      roomName: user.roomName,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on("clearRoomMessages", async (callback) => {
    const user = getUser(socket.id);
    if (user && user.room) {
      try {
        await Message.deleteMany({ room: user.room });
        io.to(user.room).emit("chatCleared", {
          by: user.username,
          message: `${user.username} cleared all chat history in this room.`,
        });
        if (typeof callback === "function") callback({ success: true });
      } catch (err) {
        if (typeof callback === "function") callback({ error: err.message });
      }
    }
  });

  socket.on("sendMessage", async (message, callback) => {
    const user = getUser(socket.id);
    if (user) {
      try {
        // Run intelligent threat detection with conversation context
        const moderation = analyzeMessage(message, {
          room: user.room,
          username: user.username,
        });

        const newMessage = new Message({
          username: user.username,
          room: user.room,
          roomName: user.roomName,
          text: message,
          type: "text",
          moderation,
        });
        await newMessage.save();

        // Audit log flagged interactions (risk > 30)
        if (moderation.risk > 30) {
          const flaggedMessage = new FlaggedMessage({
            sender: user.username,
            room: user.room,
            roomName: user.roomName,
            message,
            riskScore: moderation.risk,
            threatLevel: moderation.threatLevel,
            category: moderation.category,
            warning: moderation.warning,
            explanation: moderation.explanation,
            actionAdvice: moderation.actionAdvice,
            urgencyDetected: moderation.urgencyDetected,
            matchedSignals: moderation.matchedSignals,
            signals: moderation.signals,
          });
          await flaggedMessage.save();
        }

        const msgPayload = generateMessage(user.username, message, moderation);
        msgPayload._id = newMessage._id;

        io.to(user.room).emit("message", msgPayload);
      } catch (err) {
        console.error("[SafeChat] Error saving message to database:", err.message);
        // Fallback: still broadcast message so communication continues uninterrupted
        const fallbackPayload = generateMessage(user.username, message);
        io.to(user.room).emit("message", fallbackPayload);
      }
    }
    if (typeof callback === "function") callback();
  });

  socket.on("sendLocation", async (coords, callback) => {
    const user = getUser(socket.id);
    if (user) {
      const url = `https://google.com/maps?q=${coords.latitude},${coords.longitude}`;
      const newMessage = new Message({
        username: user.username,
        room: user.room,
        roomName: user.roomName,
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
        roomName: user.roomName,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

// Crash protection guards
process.on("uncaughtException", (err) => {
  console.error("[SafeChat CrashGuard] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[SafeChat CrashGuard] Unhandled Rejection at:", promise, "reason:", reason);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`[SafeChat] Server is running on port ${port}`);
});
