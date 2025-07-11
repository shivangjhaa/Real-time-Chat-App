const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const server = http.createServer(app);
const io = socketio(server);

const viewsPath = path.join(__dirname, "../public");

io.on("connection", () => {
  console.log("New WebSocket connection");
});
app.use(express.static(viewsPath));
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Server is running on port ");
});
