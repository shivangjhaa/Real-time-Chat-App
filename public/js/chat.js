// public/js/chat.js
const fileMessageTemplate = document.querySelector("#file-message-template").innerHTML;
const token = localStorage.getItem("token");

const socket = io({
  auth: {
    token,
  },
});

// Elements
const $messageForm = document.querySelector("#message-form");
const $messageFormInput = $messageForm.querySelector("input");
const $messageFormButton = $messageForm.querySelector("button");
const $sendLocationButton = document.querySelector("#send-location");
const $messages = document.querySelector("#messages");
const $aiCategory = document.querySelector("#ai-category");
const $aiRisk = document.querySelector("#ai-risk");
const $aiUrgency = document.querySelector("#ai-urgency");
const $aiLevel = document.querySelector("#ai-level");
const $fileInput = document.querySelector("#file-input");
const $sendFileButton = document.querySelector("#send-file");

// Templates
const messageTemplate = document.querySelector("#message-template").innerHTML;
const locationMessageTemplate = document.querySelector(
  "#location-message-template"
).innerHTML;
const sidebarTemplate = document.querySelector("#sidebar-template").innerHTML;

// Parse Query Parameters
const { username: rawUsername, room: rawRoom, roomName: rawRoomName } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

const currentUsername = (rawUsername || "").trim();
const currentRoom = (rawRoom || "").trim().toLowerCase();
const currentRoomName = (rawRoomName || (currentRoom.includes("-") ? currentRoom.split("-")[0] : currentRoom)).trim();

// Track blocked users locally
let blockedUsersSet = new Set();

async function loadBlockedUsers() {
  if (!currentUsername) return;
  try {
    const res = await fetch(`/api/blocks/${encodeURIComponent(currentUsername)}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.blockedUsers)) {
      blockedUsersSet = new Set(data.blockedUsers.map((u) => u.toLowerCase()));
    }
  } catch (err) {
    console.warn("Could not load blocked users:", err);
  }
}
loadBlockedUsers();

/**
 * Scroll to bottom ensuring messages remain visible
 */
const scrollToBottom = (smooth = true) => {
  if (!$messages) return;
  requestAnimationFrame(() => {
    $messages.scrollTo({
      top: $messages.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  });
};

/**
 * Determines alignment class, display name, and sender role
 */
const getMessageDisplayInfo = (senderUsername) => {
  const normSender = (senderUsername || "").toLowerCase();
  const isSystem = normSender === "admin" || normSender === "system";
  const isSelf = !isSystem && normSender === currentUsername.toLowerCase();
  const messageClass = isSystem ? "message--system" : (isSelf ? "message--self" : "message--other");
  const displayName = isSelf ? "You" : (senderUsername || "Anonymous");
  const canReport = !isSystem && !isSelf;
  return { isSystem, isSelf, canReport, messageClass, displayName };
};

const getModerationView = (moderation = {}) => {
  const risk = Number(moderation.risk || 0);
  const threatLevel = moderation.threatLevel || (risk >= 71 ? "Dangerous" : risk >= 51 ? "Warning" : risk >= 31 ? "Caution" : "Safe");
  const isDangerous = threatLevel === "Dangerous";
  const isWarning = threatLevel === "Warning";
  const isCaution = threatLevel === "Caution";
  const isFlagged = risk > 30;

  const badgeClass = isDangerous
    ? "risk-badge--dangerous"
    : isWarning
    ? "risk-badge--warning"
    : "risk-badge--caution";

  const riskClass = isDangerous
    ? "message--dangerous"
    : isWarning
    ? "message--warning"
    : isCaution
    ? "message--caution"
    : "";

  const signalsList = Array.isArray(moderation.matchedSignals)
    ? moderation.matchedSignals.join(", ")
    : "";

  return {
    risk,
    category: moderation.category || "Safe",
    warning: moderation.warning || "No major threat detected",
    threatLevel,
    urgencyDetected: moderation.urgencyDetected ? "YES" : "NO",
    explanation: moderation.explanation || "No harmful intent detected.",
    actionAdvice: moderation.actionAdvice || "Standard precautions apply.",
    signalsList,
    isFlagged,
    riskClass,
    badgeClass,
  };
};

const updateThreatPanel = (moderation = {}) => {
  const view = getModerationView(moderation);
  const levelClass = view.threatLevel.toLowerCase();

  if ($aiCategory) $aiCategory.textContent = view.category;
  if ($aiRisk) $aiRisk.textContent = view.risk;
  if ($aiUrgency) $aiUrgency.textContent = view.urgencyDetected;
  if ($aiLevel) {
    $aiLevel.textContent = view.threatLevel.toUpperCase();
    $aiLevel.className = levelClass;
  }
};

const showModerationWarning = (moderation = {}) => {
  const view = getModerationView(moderation);
  if (!view.isFlagged || typeof showToast !== "function") return;

  const toastType = view.threatLevel === "Dangerous" ? "error" : "info";
  showToast(
    `[SafeChat Alert] Potential ${view.category} detected — Risk: ${view.risk}/100`,
    toastType
  );
};

function safeEscape(str = "") {
  return String(str)
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, " ");
}

// ─── Socket Event Listeners ──────────────────────────────────────────────────

socket.on("message", (message) => {
  // If sender is blocked by this user, suppress or show placeholder
  const senderNorm = (message.username || "").toLowerCase();
  if (blockedUsersSet.has(senderNorm)) {
    return; // message blocked from view
  }

  const moderationView = getModerationView(message.moderation);
  const displayInfo = getMessageDisplayInfo(message.username);

  const html = Mustache.render(messageTemplate, {
    _id: message._id || "",
    username: message.username,
    message: message.text,
    escapedMessage: safeEscape(message.text),
    escapedExplanation: safeEscape(moderationView.explanation),
    escapedActionAdvice: safeEscape(moderationView.actionAdvice),
    createdAt: moment(message.createdAt).format("h:mm a"),
    ...displayInfo,
    ...moderationView,
  });

  $messages.insertAdjacentHTML("beforeend", html);
  updateThreatPanel(message.moderation);
  if (displayInfo.canReport) {
    showModerationWarning(message.moderation);
  }
  scrollToBottom(true);
});

socket.on("locationMessage", (message) => {
  if (blockedUsersSet.has((message.username || "").toLowerCase())) return;

  const displayInfo = getMessageDisplayInfo(message.username);
  const locationLabel = displayInfo.isSelf ? "My current location" : `${displayInfo.displayName}'s location`;

  const html = Mustache.render(locationMessageTemplate, {
    username: message.username,
    url: message.url,
    createdAt: moment(message.createdAt).format("h:mm a"),
    locationLabel,
    ...displayInfo,
  });

  $messages.insertAdjacentHTML("beforeend", html);
  scrollToBottom(true);
});

socket.on("fileMessage", (message) => {
  if (blockedUsersSet.has((message.username || "").toLowerCase())) return;

  const displayInfo = getMessageDisplayInfo(message.username);
  const isImage = message.fileType && message.fileType.startsWith("image/");

  const html = Mustache.render(fileMessageTemplate, {
    username: message.username,
    fileUrl: message.fileUrl,
    fileName: message.fileName,
    isImage,
    createdAt: moment(message.createdAt).format("h:mm a"),
    ...displayInfo,
  });

  $messages.insertAdjacentHTML("beforeend", html);
  scrollToBottom(true);
});

// Join the room
socket.emit(
  "join",
  { username: currentUsername, room: currentRoom, roomName: currentRoomName },
  (error) => {
    if (error) {
      alert(error);
      location.href = "/join.html";
    }
  }
);

socket.on("roomData", ({ room, roomName, users }) => {
  const displayTitle = roomName || currentRoomName || room;
  const html = Mustache.render(sidebarTemplate, {
    room,
    roomTitle: displayTitle,
    users,
  });
  const $sidebarContent = document.querySelector("#sidebar-content");
  if ($sidebarContent) {
    $sidebarContent.innerHTML = html;
  }
});

// ─── Sending Messages ────────────────────────────────────────────────────────

$messageForm.addEventListener("submit", (e) => {
  e.preventDefault();

  $messageFormButton.setAttribute("disabled", "disabled");
  const message = $messageFormInput.value;

  socket.emit("sendMessage", message, (error) => {
    $messageFormInput.value = "";
    $messageFormInput.focus();
    $messageFormButton.removeAttribute("disabled");

    if (error) {
      return console.log("Error delivering message:", error);
    }
    scrollToBottom(true);
  });
});

$sendLocationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    return typeof showToast === "function"
      ? showToast("Geolocation is not supported by your browser.", "error")
      : alert("Geolocation is not supported by your browser.");
  }

  $sendLocationButton.setAttribute("disabled", "disabled");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      socket.emit(
        "sendLocation",
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        () => {
          $sendLocationButton.removeAttribute("disabled");
          scrollToBottom(true);
        }
      );
    },
    (err) => {
      $sendLocationButton.removeAttribute("disabled");
      if (typeof showToast === "function") {
        showToast("Unable to fetch location: " + err.message, "error");
      }
    }
  );
});

// ─── File Upload ─────────────────────────────────────────────────────────────

$sendFileButton.addEventListener("click", () => {
  $fileInput.click();
});

$fileInput.addEventListener("change", async () => {
  const file = $fileInput.files[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    if (typeof showToast === "function") {
      showToast("File exceeds the 10 MB size limit.", "error");
    } else {
      alert("File exceeds the 10 MB size limit.");
    }
    $fileInput.value = "";
    return;
  }

  $sendFileButton.setAttribute("disabled", "disabled");
  $sendFileButton.textContent = "⏳";
  if (typeof showToast === "function") {
    showToast(`Uploading ${file.name}…`, "info");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("room", currentRoom);
  formData.append("roomName", currentRoomName);
  formData.append("username", currentUsername);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error || "Upload failed. Please try again.";
      if (typeof showToast === "function") {
        showToast(errMsg, "error");
      } else {
        alert(errMsg);
      }
    } else {
      if (typeof showToast === "function") {
        showToast("File shared successfully!", "success");
      }
      scrollToBottom(true);
    }
  } catch (err) {
    console.error("Upload error:", err);
    if (typeof showToast === "function") {
      showToast("Upload failed. Check your network connection.", "error");
    }
  } finally {
    $sendFileButton.removeAttribute("disabled");
    $sendFileButton.textContent = "📎";
    $fileInput.value = "";
  }
});

// ─── SafeChat Threat Advisory & Incident Reporting Modal Logic ───────────────

let activeReportPayload = null;

window.openThreatModal = function (
  msgId,
  sender,
  category,
  risk,
  threatLevel,
  messageText,
  explanation,
  actionAdvice,
  signalsStr
) {
  const modal = document.getElementById("threat-modal");
  if (!modal) return;

  document.getElementById("tm-category-badge").textContent = category;
  document.getElementById("tm-risk-badge").textContent = `Risk: ${risk}/100`;
  document.getElementById("tm-level-badge").textContent = `Level: ${threatLevel}`;
  document.getElementById("tm-message-text").textContent = `"${messageText}"`;
  document.getElementById("tm-explanation").textContent = explanation || "Potential security hazard detected.";
  document.getElementById("tm-signals").textContent = signalsStr || "Multiple high-risk threat indicators";
  document.getElementById("tm-advice").textContent = actionAdvice || "Exercise extreme caution.";

  // Wire modal action buttons
  const blockBtn = document.getElementById("tm-block-btn");
  if (blockBtn) {
    blockBtn.onclick = () => {
      closeThreatModal();
      blockUserAction(sender);
    };
  }

  const reportBtn = document.getElementById("tm-report-btn");
  if (reportBtn) {
    reportBtn.onclick = () => {
      closeThreatModal();
      openReportModal(msgId, sender, messageText, category, risk, threatLevel, explanation);
    };
  }

  modal.classList.add("open");
};

window.closeThreatModal = function () {
  const modal = document.getElementById("threat-modal");
  if (modal) modal.classList.remove("open");
};

window.openReportModal = function (
  msgId,
  sender,
  messageText,
  category,
  risk,
  threatLevel,
  explanation
) {
  const modal = document.getElementById("report-modal");
  if (!modal) return;

  activeReportPayload = {
    reporter: currentUsername,
    reportedUser: sender,
    room: currentRoom,
    roomName: currentRoomName,
    messageText,
    category: category || "Unspecified",
    riskScore: Number(risk) || 50,
    threatLevel: threatLevel || "Warning",
    explanation: explanation || "",
  };

  document.getElementById("rm-user").textContent = sender;
  document.getElementById("rm-message").textContent = `"${messageText}"`;
  document.getElementById("rm-notes").value = "";

  modal.classList.add("open");
};

window.closeReportModal = function () {
  const modal = document.getElementById("report-modal");
  if (modal) modal.classList.remove("open");
  activeReportPayload = null;
};

window.submitIncidentReport = async function () {
  if (!activeReportPayload) return;

  const btn = document.getElementById("rm-submit-btn");
  const notes = document.getElementById("rm-notes").value;
  activeReportPayload.userNotes = notes;

  btn.textContent = "Securing Evidence…";
  btn.disabled = true;

  try {
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(activeReportPayload),
    });

    const data = await res.json();
    if (data.success) {
      closeReportModal();
      if (typeof showToast === "function") {
        showToast(
          `Incident ${data.incidentId} filed! Evidence secured (SHA-256: ${data.incident.evidenceChecksum.substring(0, 8)}…)`,
          "success"
        );
      }
    } else {
      alert("Reporting failed: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    alert("Network error reporting incident: " + err.message);
  } finally {
    btn.textContent = "Submit Incident Report";
    btn.disabled = false;
  }
};

window.blockUserAction = async function (targetUser) {
  if (!targetUser) return;
  const confirmed = confirm(
    `Are you sure you want to block ${targetUser}? You will no longer receive messages from this user.`
  );
  if (!confirmed) return;

  try {
    const res = await fetch("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocker: currentUsername,
        blockedUser: targetUser,
        reason: "User flagged for inappropriate communication",
      }),
    });

    const data = await res.json();
    if (data.success) {
      blockedUsersSet.add(targetUser.toLowerCase());
      if (typeof showToast === "function") {
        showToast(`User ${targetUser} has been blocked.`, "info");
      }
      // Hide existing messages from this user in view
      document.querySelectorAll(`[data-sender="${targetUser}"]`).forEach((el) => {
        el.style.display = "none";
      });
    } else {
      alert(data.error || "Failed to block user");
    }
  } catch (err) {
    alert("Error blocking user: " + err.message);
  }
};

// ─── Clear Room Chat History ────────────────────────────────────────────────
window.clearRoomChat = function () {
  const confirmed = confirm(
    `Are you sure you want to clear all chat messages in "${currentRoomName || currentRoom}"? This will delete previous messages from this room for all participants.`
  );
  if (!confirmed) return;

  socket.emit("clearRoomMessages", (res) => {
    if (res && res.error) {
      if (typeof showToast === "function") {
        showToast("Error clearing chat: " + res.error, "error");
      } else {
        alert("Error clearing chat: " + res.error);
      }
    }
  });
};

socket.on("chatCleared", (data) => {
  if ($messages) {
    $messages.innerHTML = `
      <div class="empty-state" id="empty-state" style="display:flex;">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.3" style="width:38px; height:38px; opacity:0.28;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"/>
        </svg>
        <p>🧹 All messages in this room were cleared by ${data.by || "a participant"}. Say hello! 👋</p>
      </div>
    `;
  }
  if (typeof showToast === "function") {
    showToast(data.message || "Room chat cleared", "info");
  }
});
