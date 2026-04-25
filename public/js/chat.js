const fileMessageTemplate = document.querySelector("#file-message-template").innerHTML;
const token = localStorage.getItem("token");

const socket = io({
  auth: {
    token
  }
});

// Elements
const $messageForm = document.querySelector("#message-form");
const $messageFormInput = $messageForm.querySelector("input");
const $messageFormButton = $messageForm.querySelector("button");
const $sendLocationButton = document.querySelector("#send-location");
const $messages = document.querySelector("#messages");

// Templates
const messageTemplate = document.querySelector("#message-template").innerHTML;
const locationMessageTemplate = document.querySelector(
  "#location-message-template"
).innerHTML;
const sidebarTemplate = document.querySelector("#sidebar-template").innerHTML;

const autoscroll = () => {
  // New message element (last one)
  const $newMessage = $messages.lastElementChild;

  // Height of the new message including margin
  const newMessageStyles = getComputedStyle($newMessage);
  const newMessageMargin = parseInt(newMessageStyles.marginBottom);
  const newMessageHeight = $newMessage.offsetHeight + newMessageMargin;

  // Visible height of the container
  const visibleHeight = $messages.offsetHeight;

  // Total height of messages container
  const containerHeight = $messages.scrollHeight;

  // How far have I scrolled from top + visible
  const scrollOffset = $messages.scrollTop + visibleHeight;

  // If user was already at the bottom before new message
  if (containerHeight - newMessageHeight <= scrollOffset) {
    $messages.scrollTop = $messages.scrollHeight; // Scroll to bottom
  }
};

// Receive text message
socket.on("message", (message) => {
  const html = Mustache.render(messageTemplate, {
    username: message.username,
    message: message.text,
    createdAt: moment(message.createdAt).format("h:mm a"),
  });
  $messages.insertAdjacentHTML("beforeend", html);
  autoscroll();
});

// Receive location message
socket.on("locationMessage", (message) => {
  const html = Mustache.render(locationMessageTemplate, {
    username: message.username,
    url: message.url,
    createdAt: moment(message.createdAt).format("h:mm a"),
  });
  $messages.insertAdjacentHTML("beforeend", html);
  autoscroll();
});

const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});
socket.emit("join", { username, room }, (error) => {
  if (error) {
    alert(error);
    location.href = "/";
  }
});

socket.on("roomData", ({ room, users }) => {
  const html = Mustache.render(sidebarTemplate, {
    room,
    users,
  });
  document.querySelector("#sidebar").innerHTML = html;
});

// Sending new message
$messageForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // Disable button while sending
  $messageFormButton.setAttribute("disabled", "disabled");

  const message = $messageFormInput.value;

  socket.emit("sendMessage", message, (error) => {
    // Re-enable, reset input, focus
    $messageFormInput.value = "";
    $messageFormInput.focus();
    $messageFormButton.removeAttribute("disabled");

    if (error) {
      return console.log("Error delivering message:", error);
    }

    console.log("Message delivered!");
  });
});

// Sending location
$sendLocationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    return alert("Geolocation is not supported by your browser.");
  }

  // Disable while fetching location
  $sendLocationButton.setAttribute("disabled", "disabled");

  navigator.geolocation.getCurrentPosition((position) => {
    socket.emit(
      "sendLocation",
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      () => {
        console.log("Location shared!");
        $sendLocationButton.removeAttribute("disabled");
      }
    );
  });
});

// =====================================================
// FILE SHARING — add to bottom of public/js/chat.js
// =====================================================

const $fileInput = document.querySelector("#file-input");
const $sendFileButton = document.querySelector("#send-file");

// Receive file message from Socket.IO
socket.on("fileMessage", (message) => {
  const isImage = message.fileType && message.fileType.startsWith("image/");
  const html = Mustache.render(fileMessageTemplate, {
    username: message.username,
    fileUrl: message.fileUrl,
    fileName: message.fileName,
    isImage,
    createdAt: moment(message.createdAt).format("h:mm a"),
  });
  $messages.insertAdjacentHTML("beforeend", html);
  autoscroll();
});

// Send file button click
$sendFileButton.addEventListener("click", () => {
  $fileInput.click(); // Open native file picker
});

// When user picks a file
$fileInput.addEventListener("change", async () => {
  const file = $fileInput.files[0];
  if (!file) return;

  // Disable button while uploading
  $sendFileButton.setAttribute("disabled", "disabled");
  $sendFileButton.textContent = "Uploading…";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("room", room);
  formData.append("username", username);

  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Do NOT set Content-Type manually — browser sets it with boundary for multipart
      },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Upload failed: ${data.error}`);
    }
    // Success: server already emitted fileMessage via Socket.IO
  } catch (err) {
    alert("Upload failed. Check your connection.");
    console.error(err);
  } finally {
    $sendFileButton.removeAttribute("disabled");
    $sendFileButton.textContent = "📎";
    $fileInput.value = ""; // Reset so same file can be re-selected
  }
});
