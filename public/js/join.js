/**
 * join.js
 * Handles the Join Room page:
 *  - Guards the page: redirects to index.html if not logged in
 *  - Populates the logged-in user pill from localStorage
 *  - Validates inputs and redirects to chat.html with query params
 */

// ─── Cognito Pool (same as auth.js) ────────────────────────────────────────
const poolData = {
  UserPoolId: "ap-south-1_zkpv1rOQe",
  ClientId:   "7jba75ak4gs48c4uoa0s7c3bho"
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// ─── Auth Guard ─────────────────────────────────────────────────────────────
/**
 * Returns the currently authenticated Cognito user, or null.
 * Validates the session is still active before granting access.
 */
function getCurrentUser() {
  const user = userPool.getCurrentUser();
  if (!user) return null;
  return user;
}

function guardPage() {
  const user = getCurrentUser();

  if (!user) {
    // No session → back to login
    window.location.replace("/index.html");
    return;
  }

  // Validate the session is still fresh
  user.getSession((err, session) => {
    if (err || !session.isValid()) {
      window.location.replace("/index.html");
      return;
    }

    // Session valid — populate UI
    const email = localStorage.getItem("email") || user.getUsername() || "User";
    populateUserPill(email);
  });
}

// ─── UI Helpers ─────────────────────────────────────────────────────────────
function populateUserPill(email) {
  const label  = document.getElementById("user-email-label");
  const avatar = document.getElementById("user-avatar");

  if (label)  label.textContent  = email;
  if (avatar) avatar.textContent = email.charAt(0).toUpperCase();

  // Pre-fill username field with the part before @ for convenience
  const usernameInput = document.getElementById("username");
  if (usernameInput && !usernameInput.value) {
    usernameInput.value = email.split("@")[0];
  }
}

function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toast-msg");
  if (!toast || !msgEl) return;

  toast.className = "toast " + type;
  msgEl.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function setLoading(on) {
  const btn = document.getElementById("join-btn");
  if (btn) btn.classList.toggle("loading", on);
}

// ─── Room Chip Quick-Select ──────────────────────────────────────────────────
function pickRoom(name) {
  const roomInput = document.getElementById("room");
  if (!roomInput) return;
  roomInput.value = name;
  roomInput.focus();
}

// ─── Join Handler ────────────────────────────────────────────────────────────
function handleJoin() {
  const usernameEl = document.getElementById("username");
  const roomEl     = document.getElementById("room");

  const username = usernameEl ? usernameEl.value.trim() : "";
  const room     = roomEl     ? roomEl.value.trim()     : "";

  // Validation
  if (!username) {
    showToast("Please enter a display name.", "error");
    usernameEl && usernameEl.focus();
    return;
  }

  if (username.length < 2) {
    showToast("Display name must be at least 2 characters.", "error");
    usernameEl && usernameEl.focus();
    return;
  }

  if (!room) {
    showToast("Please enter a room name.", "error");
    roomEl && roomEl.focus();
    return;
  }

  if (room.length < 2) {
    showToast("Room name must be at least 2 characters.", "error");
    roomEl && roomEl.focus();
    return;
  }

  // Brief loading state for feedback
  setLoading(true);
  showToast("Joining " + room + "…", "info");

  // Small delay so the user sees the toast, then redirect
  setTimeout(() => {
    const params = new URLSearchParams({
      username: username,
      room:     room
    });
    window.location.href = "/chat.html?" + params.toString();
  }, 600);
}

// ─── Logout ──────────────────────────────────────────────────────────────────
function handleLogout() {
  const user = getCurrentUser();
  if (user) user.signOut();

  localStorage.removeItem("token");
  localStorage.removeItem("email");

  showToast("Signed out. See you soon!", "success");

  setTimeout(() => {
    window.location.replace("/index.html");
  }, 900);
}

// ─── Enter key support ───────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleJoin();
});

// ─── Boot ────────────────────────────────────────────────────────────────────
guardPage();
