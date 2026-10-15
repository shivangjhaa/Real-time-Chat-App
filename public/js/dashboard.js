// public/js/dashboard.js
let categoryChartInstance = null;
let severityChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  refreshData();
  setupSampleButtons();
});

// ─── Fetch Analytics & Populate UI ───────────────────────────────────────────

async function refreshData() {
  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) refreshBtn.textContent = "⏳ Updating...";

  try {
    const res = await fetch("/api/analytics/stats");
    const data = await res.json();

    if (!data.success) {
      console.error("Failed to load analytics stats:", data);
      return;
    }

    // 1. Populate KPIs
    document.getElementById("stat-total-messages").textContent = data.totals.totalMessages || 0;
    document.getElementById("stat-flagged-count").textContent = data.totals.flaggedCount || 0;
    document.getElementById("stat-incident-count").textContent = data.totals.incidentCount || 0;
    document.getElementById("stat-protection-rate").textContent = `${data.totals.protectionRate || 100}%`;

    // 2. Render Charts
    renderCategoryChart(data.categoryDistribution);
    renderSeverityChart(data.threatLevels);

    // 3. Populate Flagged Messages Audit Log
    renderFlaggedTable(data.recentFlagged || []);

    // 4. Load Incidents
    loadIncidents();
  } catch (err) {
    console.error("Error refreshing dashboard:", err);
  } finally {
    if (refreshBtn) refreshBtn.textContent = "🔄 Refresh Metrics";
  }
}

// ─── Chart.js Visualizations ─────────────────────────────────────────────────

function renderCategoryChart(categories = {}) {
  const ctx = document.getElementById("categoryChart");
  if (!ctx) return;

  const labels = Object.keys(categories);
  const data = Object.values(categories);

  // If completely empty, show friendly placeholder
  const isAllZero = data.every((val) => val === 0);
  const chartData = isAllZero ? [1, 1, 1, 1, 1] : data;
  const chartLabels = isAllZero ? labels.map((l) => `${l} (0)`) : labels;

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  categoryChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: chartLabels,
      datasets: [
        {
          data: chartData,
          backgroundColor: [
            "#f59e0b", // Scam: Amber
            "#ec4899", // Harassment: Pink
            "#8b5cf6", // Ragging: Violet
            "#ef4444", // Blackmail: Red
            "#3b82f6", // Repeated Unsafe: Blue
          ],
          borderColor: "#101018",
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#a1a1aa", font: { family: "DM Sans", size: 12 } },
        },
      },
    },
  });
}

function renderSeverityChart(levels = {}) {
  const ctx = document.getElementById("severityChart");
  if (!ctx) return;

  const labels = ["Dangerous", "Warning", "Caution", "Safe"];
  const counts = [
    levels["Dangerous"] || 0,
    levels["Warning"] || 0,
    levels["Caution"] || 0,
    levels["Safe"] || 0,
  ];

  if (severityChartInstance) {
    severityChartInstance.destroy();
  }

  severityChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Messages",
          data: counts,
          backgroundColor: ["#ef4444", "#f59e0b", "#eab308", "#10b981"],
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#8383a4" },
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#8383a4", stepSize: 1 },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// ─── Table Renderers ─────────────────────────────────────────────────────────

function renderFlaggedTable(messages = []) {
  const tbody = document.getElementById("flagged-table-body");
  if (!tbody) return;

  if (messages.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#8383a4; padding:24px;">No flagged messages intercepted yet. Clean communication detected.</td></tr>`;
    return;
  }

  tbody.innerHTML = messages
    .map((msg) => {
      const level = msg.threatLevel || (msg.riskScore > 60 ? "Dangerous" : "Warning");
      const badgeClass =
        level === "Dangerous"
          ? "badge-danger"
          : level === "Warning"
          ? "badge-warning"
          : "badge-caution";
      const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      return `
      <tr>
        <td><strong>${escapeHtml(msg.sender)}</strong></td>
        <td><span class="mono">${escapeHtml(msg.room)}</span></td>
        <td style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(msg.message)}">
          ${escapeHtml(msg.message)}
        </td>
        <td><span class="badge ${badgeClass}">${escapeHtml(msg.category)}</span></td>
        <td><strong>${msg.riskScore}</strong></td>
        <td><span class="badge ${badgeClass}">${level}</span></td>
        <td style="color:#8383a4;">${time}</td>
      </tr>
    `;
    })
    .join("");
}

async function loadIncidents() {
  const tbody = document.getElementById("incidents-table-body");
  const filter = document.getElementById("incident-status-filter")?.value || "all";
  if (!tbody) return;

  try {
    const res = await fetch(`/api/incidents?status=${filter}`);
    const data = await res.json();

    if (!data.success || !data.incidents || data.incidents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#8383a4; padding:24px;">No formal incidents recorded under current filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.incidents
      .map((inc) => {
        const statusBadge =
          inc.status === "pending"
            ? "badge-warning"
            : inc.status === "investigating"
            ? "badge-caution"
            : "badge-success";

        return `
        <tr>
          <td><span class="mono" style="color:var(--accent-2); font-weight:600;">${inc.incidentId}</span></td>
          <td>${escapeHtml(inc.reporter)}</td>
          <td><strong style="color:#f87171;">${escapeHtml(inc.reportedUser)}</strong></td>
          <td>${escapeHtml(inc.category)}</td>
          <td><strong>${inc.riskScore}</strong>/100</td>
          <td><span class="badge ${statusBadge}">${inc.status.toUpperCase()}</span></td>
          <td>
            <span class="mono" title="${inc.evidenceChecksum}" style="cursor:help;">
              🔒 ${inc.evidenceChecksum.substring(0, 10)}…
            </span>
          </td>
          <td>
            <button onclick="viewIncidentDetails('${inc.incidentId}')" class="btn btn-secondary" style="padding:4px 10px; font-size:11.5px;">
              Inspect
            </button>
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    console.error("Error loading incidents:", err);
  }
}

// ─── Incident Modal Details ──────────────────────────────────────────────────

let currentModalIncidentId = null;

async function viewIncidentDetails(incidentId) {
  currentModalIncidentId = incidentId;
  const modal = document.getElementById("incident-modal");
  const modalBody = document.getElementById("modal-body");
  const title = document.getElementById("modal-incident-id");

  title.textContent = `Incident: ${incidentId}`;
  modalBody.innerHTML = `<div style="text-align:center; padding:20px; color:#8383a4;">Loading evidence packet...</div>`;
  modal.classList.add("open");

  try {
    const res = await fetch(`/api/incidents`);
    const data = await res.json();
    const inc = (data.incidents || []).find((i) => i.incidentId === incidentId);

    if (!inc) {
      modalBody.innerHTML = `<div style="color:#ef4444;">Incident not found.</div>`;
      return;
    }

    const contextHtml = (inc.evidenceContext || [])
      .map(
        (c) => `
        <div style="background:var(--surface-2); padding:8px 12px; border-radius:6px; margin-bottom:6px; font-size:12.5px;">
          <strong>${escapeHtml(c.username)}:</strong> ${escapeHtml(c.text)}
        </div>
      `
      )
      .join("");

    modalBody.innerHTML = `
      <div style="margin-bottom:14px;">
        <span class="badge badge-danger" style="margin-right:6px;">${inc.category}</span>
        <span class="badge badge-warning">Risk: ${inc.riskScore}/100</span>
        <span class="badge badge-caution">Level: ${inc.threatLevel}</span>
      </div>

      <div style="margin-bottom:12px;">
        <strong style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">Flagged Message:</strong>
        <div style="background:var(--bg); border:1px solid var(--border); border-left:3px solid #ef4444; padding:10px 14px; border-radius:6px; margin-top:4px;">
          "${escapeHtml(inc.messageText)}"
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <strong style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">Evidence Context Trail (Surrounding Messages):</strong>
        <div style="max-height:160px; overflow-y:auto; margin-top:4px;">
          ${contextHtml || "<span style='color:#8383a4;'>No context trail recorded</span>"}
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <strong style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">Evidence Checksum (SHA-256):</strong>
        <div class="mono" style="background:var(--bg); padding:6px 10px; border-radius:6px; border:1px solid var(--border); font-size:11px; word-break:break-all; margin-top:4px;">
          ${inc.evidenceChecksum}
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <label style="color:var(--text-muted); font-size:12px; text-transform:uppercase; display:block; margin-bottom:4px;">Update Status:</label>
        <select id="modal-status-select" style="background:var(--surface-2); color:var(--text); border:1px solid var(--border); padding:8px 12px; border-radius:8px; width:100%;">
          <option value="pending" ${inc.status === "pending" ? "selected" : ""}>Pending Review</option>
          <option value="investigating" ${inc.status === "investigating" ? "selected" : ""}>Investigating</option>
          <option value="resolved" ${inc.status === "resolved" ? "selected" : ""}>Resolved (Sanction / User Action Taken)</option>
          <option value="dismissed" ${inc.status === "dismissed" ? "selected" : ""}>Dismissed (False Positive)</option>
        </select>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button onclick="closeModal()" class="btn btn-secondary">Close</button>
        <button onclick="updateIncidentStatus('${inc.incidentId}')" class="btn btn-primary">Save Changes</button>
      </div>
    `;
  } catch (err) {
    modalBody.innerHTML = `<div style="color:#ef4444;">Error loading details: ${err.message}</div>`;
  }
}

async function updateIncidentStatus(incidentId) {
  const statusSelect = document.getElementById("modal-status-select");
  if (!statusSelect) return;

  try {
    const res = await fetch(`/api/incidents/${incidentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusSelect.value }),
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      loadIncidents();
    } else {
      alert(data.error || "Failed to update incident");
    }
  } catch (err) {
    alert("Error updating incident: " + err.message);
  }
}

function closeModal() {
  document.getElementById("incident-modal").classList.remove("open");
}

// ─── AI Sandbox Threat Tester ────────────────────────────────────────────────

async function testSandboxMessage() {
  const input = document.getElementById("sandbox-input");
  const btn = document.getElementById("sandbox-btn");
  const resultCard = document.getElementById("sandbox-result");
  const text = (input?.value || "").trim();

  if (!text) {
    input.focus();
    return;
  }

  btn.textContent = "Analyzing…";
  btn.disabled = true;

  try {
    const res = await fetch("/api/moderation/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, room: "sandbox-demo", username: "sandbox-tester" }),
    });

    const data = await res.json();
    if (!data.success) {
      alert("Analysis failed: " + (data.error || "Unknown error"));
      return;
    }

    const mod = data.moderation;

    // Populate Results Card
    document.getElementById("res-category").textContent = mod.category;
    document.getElementById("res-risk").textContent = `${mod.risk} / 100`;
    document.getElementById("res-urgency").textContent = mod.urgencyDetected ? "YES (HIGH PRESSURE)" : "NO";
    document.getElementById("res-sentiment").textContent = mod.aiSentiment || "N/A";

    const signalsList = (mod.matchedSignals || []).join(", ") || "None";
    document.getElementById("res-signals").textContent = signalsList;

    document.getElementById("res-explanation").textContent = mod.explanation || "No risk pattern detected.";
    document.getElementById("res-action").textContent = mod.actionAdvice || "Standard precautions apply.";

    const levelBadge = document.getElementById("res-threat-level");
    levelBadge.textContent = (mod.threatLevel || "Safe").toUpperCase();
    levelBadge.className = `threat-tag ${mod.threatLevel || "Safe"}`;

    resultCard.style.display = "block";
  } catch (err) {
    alert("Analysis error: " + err.message);
  } finally {
    btn.textContent = "Analyze Message";
    btn.disabled = false;
  }
}

// Quick Sample Loaders
const samplePhrases = {
  1: "Dear user, your bank account is blocked due to pending KYC. Share your OTP immediately to verify your identity at bit.ly/sbi-verify",
  2: "Listen fresher! Obey the seniors, do my assignment right now and meet behind the hostel ground at midnight attendance",
  3: "Pay me $500 right now or else I will leak your private photos to your family and ruin your career",
  4: "You are a pathetic idiot and a worthless loser, shut up and get lost nobody likes you",
  5: "Hey everyone! Looking forward to our project presentation tomorrow. Can someone share the slide deck?",
};

function loadSample(key) {
  const input = document.getElementById("sandbox-input");
  if (input && samplePhrases[key]) {
    input.value = samplePhrases[key];
    testSandboxMessage();
  }
}

function setupSampleButtons() {
  const input = document.getElementById("sandbox-input");
  input?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      testSandboxMessage();
    }
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
