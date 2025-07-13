const socket = io();

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

// Receive text message
socket.on("message", (message) => {
  const html = Mustache.render(messageTemplate, {
    message: message.text,
    createdAt: moment(message.createdAt).format("h:mm a"),
  });
  $messages.insertAdjacentHTML("beforeend", html);
});

// Receive location message
socket.on("locationMessage", (message) => {
  const html = Mustache.render(locationMessageTemplate, {
    url: message.url,
    createdAt: moment(message.createdAt).format("h:mm a"),
  });
  $messages.insertAdjacentHTML("beforeend", html);
});

// Sending new message
$messageForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // Disable button while sending
  $messageFormButton.setAttribute("disabled", "disabled");

  const message = $messageFormInput.value;

  socket.emit("sendMessage", message, (error) => {
    // Re-enable, reset input, focus
    $messageFormButton.removeAttribute("disabled");
    $messageFormInput.value = "";
    $messageFormInput.focus();

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
