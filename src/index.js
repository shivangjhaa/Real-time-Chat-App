const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const { generateMessage } = require("./utils/messages");
const server = http.createServer(app);
const io = socketio(server);

const viewsPath = path.join(__dirname, "../public");
app.use(express.static(viewsPath));

io.on("connection", (socket) => {
  console.log("New WebSocket connection");

  socket.emit("message", generateMessage("welcome"));
  socket.broadcast.emit("message", generateMessage("new user connected"));
  socket.on("sendMessage", (message) => {
    io.emit("message", generateMessage(message));
  });

  socket.on("disconnect", () => {
    io.emit("message", generateMessage("a user disconnected"));
  });

  socket.on("sendLocation", (coords, callback) => {
    io.emit(
      "locationMessage",
      `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
    );
    callback();
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Server is running on port ");
});
