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

let currentMode = "create";

// ─── Mode Switching (Create vs Join) ─────────────────────────────────────────
function switchMode(mode) {
  currentMode = mode;
  const tabCreate = document.getElementById("tab-create");
  const tabJoin = document.getElementById("tab-join");
  const createFields = document.getElementById("create-mode-fields");
  const joinFields = document.getElementById("join-mode-fields");
  const submitBtnText = document.getElementById("submit-btn-text");
  const headingTitle = document.getElementById("heading-title");
  const headingSub = document.getElementById("heading-sub");

  if (tabCreate) tabCreate.classList.toggle("active", mode === "create");
  if (tabJoin) tabJoin.classList.toggle("active", mode === "join");

  if (mode === "create") {
    if (createFields) createFields.style.display = "block";
    if (joinFields) joinFields.style.display = "none";
    if (submitBtnText) submitBtnText.innerHTML = 'Create & Enter Room <span class="btn-arrow">→</span>';
    if (headingTitle) headingTitle.textContent = "Create a New Room";
    if (headingSub) headingSub.textContent = "Start your own private room and invite your team.";
  } else {
    if (createFields) createFields.style.display = "none";
    if (joinFields) joinFields.style.display = "block";
    if (submitBtnText) submitBtnText.innerHTML = 'Join Chat Room <span class="btn-arrow">→</span>';
    if (headingTitle) headingTitle.textContent = "Join an Existing Room";
    if (headingSub) headingSub.textContent = "Enter your friend's Room Code to connect.";
  }
}

// ─── Room Code Generator ────────────────────────────────────────────────────
function generateRandomSuffix(len = 4) {
  const chars = "abcdefhkmnprstuvwxyz23456789";
  let res = "";
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

function generateNewRoomCode() {
  const roomNameEl = document.getElementById("room-name-create");
  const codeEl = document.getElementById("room-code-create");
  const rawName = roomNameEl && roomNameEl.value.trim() ? roomNameEl.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") : "room";
  const newCode = `${rawName || "room"}-${generateRandomSuffix(4)}`;
  if (codeEl) {
    codeEl.value = newCode;
    codeEl.focus();
  }
  showToast(`Generated code: ${newCode}`, "info");
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

// ─── Main Submit Handler ─────────────────────────────────────────────────────
function handleSubmit() {
  const usernameEl = document.getElementById("username");
  const username = usernameEl ? usernameEl.value.trim() : "";

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

  let finalRoomId = "";
  let finalRoomName = "";

  if (currentMode === "create") {
    const roomNameEl = document.getElementById("room-name-create");
    const roomCodeEl = document.getElementById("room-code-create");
    finalRoomName = roomNameEl ? roomNameEl.value.trim() : "";
    let customCode = roomCodeEl ? roomCodeEl.value.trim() : "";

    if (!finalRoomName) {
      showToast("Please enter a room name (e.g. tech).", "error");
      roomNameEl && roomNameEl.focus();
      return;
    }

    if (finalRoomName.length < 2) {
      showToast("Room name must be at least 2 characters.", "error");
      roomNameEl && roomNameEl.focus();
      return;
    }

    const sanitizedName = finalRoomName.toLowerCase().replace(/[^a-z0-9_-]/g, "");

    // If user left code blank, generate random 4-character suffix
    if (!customCode) {
      customCode = generateRandomSuffix(4);
      if (roomCodeEl) roomCodeEl.value = `${sanitizedName}-${customCode}`;
    }

    const sanitizedCode = customCode.toLowerCase().replace(/[^a-z0-9_-]/g, "");

    // CRITICAL FIX: Namespace the room ID with sanitizedName so rooms with different names NEVER collide!
    if (sanitizedCode.startsWith(`${sanitizedName}-`)) {
      finalRoomId = sanitizedCode;
    } else {
      finalRoomId = `${sanitizedName}-${sanitizedCode}`;
    }
  } else {
    // JOIN MODE
    const roomCodeEl = document.getElementById("room-code-join");
    const roomNameEl = document.getElementById("room-name-join");
    const enteredCode = roomCodeEl ? roomCodeEl.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") : "";
    let enteredName = roomNameEl ? roomNameEl.value.trim() : "";

    if (!enteredCode) {
      showToast("Please enter the Room Code shared by your friend.", "error");
      roomCodeEl && roomCodeEl.focus();
      return;
    }

    if (enteredCode.includes("-")) {
      finalRoomId = enteredCode;
      if (!enteredName) {
        enteredName = enteredCode.split("-")[0];
      }
      finalRoomName = enteredName;
    } else {
      // User entered a bare passcode like "1234"
      if (!enteredName) {
        showToast(`Please enter the Room Name (e.g. tech) along with code ${enteredCode}`, "error");
        roomNameEl && roomNameEl.focus();
        return;
      }
      const sanitizedName = enteredName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      finalRoomId = `${sanitizedName}-${enteredCode}`;
      finalRoomName = enteredName;
    }
  }

  setLoading(true);
  showToast(`Connecting to ${finalRoomName} (${finalRoomId})…`, "info");

  setTimeout(() => {
    const params = new URLSearchParams({
      username: username,
      room:     finalRoomId,
      roomName: finalRoomName,
    });
    window.location.href = "/chat.html?" + params.toString();
  }, 500);
}

// ─── Direct URL Query Support (e.g. ?code=tech-8491&room=tech) ──────────────
function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const codeParam = params.get("code") || params.get("room");
  const nameParam = params.get("roomName") || params.get("name") || (codeParam && codeParam.includes("-") ? codeParam.split("-")[0] : "");

  if (codeParam) {
    switchMode("join");
    const codeEl = document.getElementById("room-code-join");
    const nameEl = document.getElementById("room-name-join");
    if (codeEl) codeEl.value = codeParam;
    if (nameEl && nameParam) nameEl.value = nameParam;
    showToast(`Invite code loaded: ${codeParam}`, "info");
  } else {
    switchMode("create");
  }
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
  if (e.key === "Enter") handleSubmit();
});

// ─── Boot ────────────────────────────────────────────────────────────────────
guardPage();
handleUrlParams();
