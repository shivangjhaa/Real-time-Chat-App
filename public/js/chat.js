const socket = io();
socket.on("message", (message) => {
  console.log(message);
});

const messagebox = document.getElementById("message");
const sendButton = document.getElementById("submit");
const updatedMessage = document.getElementById("updatedMessage");
const kahahai = document.getElementById("location");
sendButton.addEventListener("click", (e) => {
  e.preventDefault();
  console.log("Click", messagebox.value);
  socket.emit("sendMessage", messagebox.value);
});

document.querySelector("#sendLocation").addEventListener("click", () => {
  if (!navigator.geolocation) {
    return alert("Geolocation is not supported by your browser.");
  }

  navigator.geolocation.getCurrentPosition((position) => {
    socket.emit("sendLocation", {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
  });
});
