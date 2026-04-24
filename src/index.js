require("dotenv").config({ path: "./.env" });
require("./db/mongoose");
const Message = require("./models/Message");

// console.log("Message import:", Message);
// console.log("Type:", typeof Message);
// console.log("Keys:", Object.keys(Message));

const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const {
  generateMessage,
  generateLocationMessage,
} = require("./utils/messages");
const server = http.createServer(app);
const io = socketio(server);
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/users");

const viewsPath = path.join(__dirname, "../public");
app.use(express.static(viewsPath));

io.on("connection", (socket) => {
  socket.on("join", async ({ username, room }, callback) => {
  const { error, user } = addUser({
    id: socket.id,
    username,
    room,
  });

  if (error) {
    return callback(error);
  }

  socket.join(user.room);

  // Welcome message
  socket.emit(
    "message",
    generateMessage("Admin", `Welcome ${user.username}!`)
  );

  // Load old messages
  const oldMessages = await Message.find({ room: user.room })
    .sort({ createdAt: 1 })
    .limit(50);

  oldMessages.forEach((msg) => {
    if (msg.type === "text") {
      socket.emit(
        "message",
        generateMessage(msg.username, msg.text)
      );
    } else {
      socket.emit(
        "locationMessage",
        generateLocationMessage(msg.username, msg.url)
      );
    }
  });

  // Notify others
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
      type: "text"
    });

    await newMessage.save();

    io.to(user.room).emit(
      "message",
      generateMessage(user.username, message)
    );
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
      type: "location"
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
      io.to(user.room).emit(
        "message",
        generateMessage("Admin", `${user.username} has left!`)
      );
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Server is running on port ");
});
