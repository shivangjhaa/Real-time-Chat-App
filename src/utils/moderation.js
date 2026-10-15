// src/utils/moderation.js
/**
 * SafeChat Intelligent Threat Detection & Explainable Risk Assessment Engine
 * 
 * Supports 5 Comprehensive Threat Categories:
 * 1. Online Scams & Financial Fraud
 * 2. Harassment, Cyberbullying & Abusive Language
 * 3. Ragging & Coercion (Campus / Workplace Intimidation)
 * 4. Blackmail & Extortion
 * 5. Repeated Unsafe Interactions (Pattern & Escalation Detection)
 */

const MAX_RISK = 100;

// Conversation history buffer for pattern detection (in-memory sliding window: 15 min TTL)
const userHistoryWindow = new Map(); // key: `${room}:${username}`, value: [{ text, risk, timestamp }]

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, history] of userHistoryWindow.entries()) {
    const fresh = history.filter((item) => now - item.timestamp < 15 * 60 * 1000);
    if (fresh.length === 0) {
      userHistoryWindow.delete(key);
    } else {
      userHistoryWindow.set(key, fresh);
    }
  }
}, CLEANUP_INTERVAL_MS);

// ─── Rule Definitions by Category ────────────────────────────────────────────

const SCAM_RULES = [
  {
    id: "scam_otp_request",
    category: "Scam/Fraud",
    label: "OTP or credential harvesting request",
    severity: "critical",
    score: 45,
    pattern: /\b(share|send|give|tell|forward|enter)\s+(me\s+)?(your\s+)?(otp|one\s*time\s*password|verification\s*code|auth\s*code|pin|upi\s*pin|cvv|password|passcode)\b/i,
  },
  {
    id: "scam_kyc_bank",
    category: "Scam/Fraud",
    label: "Fake KYC or banking account suspension alert",
    severity: "high",
    score: 35,
    pattern: /\b(kyc\s*(update|suspended|expire|pending)|account\s*(blocked|suspended|deactivated)|bank\s*details|net\s*banking|credit\s*card\s*limit|pan\s*card\s*link|aadhaar\s*link)\b/i,
  },
  {
    id: "scam_suspicious_url",
    category: "Scam/Fraud",
    label: "Suspicious link or URL shortener",
    severity: "medium",
    score: 25,
    pattern: /\b(bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|free-gift|login-secure|verify-account|claim-bonus|gift-card|telegram\.me|wa\.me)\b/i,
  },
  {
    id: "scam_lottery_prize",
    category: "Scam/Fraud",
    label: "Prize lottery or unrealistic financial reward",
    severity: "high",
    score: 30,
    pattern: /\b(you\s*(have\s*)?won|lottery\s*winner|claim\s*(your\s*)?(prize|reward|gift|cashback)|double\s*your\s*money|guaranteed\s*return|crypto\s*airdrop|free\s*iphone)\b/i,
  },
  {
    id: "scam_payment_demand",
    category: "Scam/Fraud",
    label: "Urgent money transfer or fee payment request",
    severity: "medium",
    score: 25,
    pattern: /\b(send\s*(money|cash|funds|rs|inr|\$|\d+)|transfer\s*now|pay\s*(the\s*)?(fee|money|\$|\d+)|processing\s*charge|registration\s*fee|scan\s*qr|gpay\s*me|phonepe\s*me|paytm\s*me)\b/i,
  },
];

const HARASSMENT_RULES = [
  {
    id: "harass_violence_threat",
    category: "Harassment",
    label: "Direct threat of physical violence or harm",
    severity: "critical",
    score: 50,
    pattern: /\b(i\s*will\s*(kill|murder|hurt|stab|shoot|strangle|break\s*your|destroy|end)\s*you|hunt\s*you\s*down)\b/i,
  },
  {
    id: "harass_ominous_warning",
    category: "Harassment",
    label: "Ominous threat or death warning",
    severity: "high",
    score: 35,
    pattern: /\b(you\s*are\s*dead|watch\s*your\s*back|gonna\s*regret\s*this|consequences\s*coming)\b/i,
  },
  {
    id: "harass_self_harm",
    category: "Harassment",
    label: "Encouraging self-harm or suicide",
    severity: "critical",
    score: 55,
    pattern: /\b(kill\s*yourself|go\s*die|kys|end\s*your\s*life|you\s*should\s*die)\b/i,
  },
  {
    id: "harass_abusive_slurs",
    category: "Harassment",
    label: "Severe abusive, vulgar, or bullying profanity",
    severity: "high",
    score: 35,
    pattern: /\b(bitch|bastard|asshole|idiot|loser|worthless|pathetic|scum|retard|slut|whore|dumbass|piece\s*of\s*shit)\b/i,
  },
  {
    id: "harass_intimidation",
    category: "Harassment",
    label: "Hostile intimidation or persistent insults",
    severity: "medium",
    score: 25,
    pattern: /\b(shut\s*up|no\s*one\s*likes\s*you|get\s*lost|nobody\s*cares|ugly|disgusting|freak)\b/i,
  },
];

const RAGGING_RULES = [
  {
    id: "ragging_senior_dominance",
    category: "Ragging/Coercion",
    label: "Campus seniority intimidation or forced obedience",
    severity: "high",
    score: 45,
    pattern: /\b(obey\s*(the\s*)?seniors?|senior\s*order|respect\s*your\s*seniors?|fresher\s*listen|fresher\s*discipline|know\s*your\s*place|junior\s*rules|ragging)\b/i,
  },
  {
    id: "ragging_forced_actions",
    category: "Ragging/Coercion",
    label: "Forced servitude, forced chores, or humiliating command",
    severity: "high",
    score: 40,
    pattern: /\b(do\s*(my|our)\s*assignment|complete\s*(my|our)\s*homework|wash\s*(my|our)\s*clothes|bring\s*(me\s*)?cigarettes|clean\s*(my|our)\s*room|serve\s*food\s*to\s*seniors?|kneel\s*down|do\s*as\s*i\s*say|you\s*have\s*to\s*do\s*what\s*i\s*tell)\b/i,
  },
  {
    id: "ragging_campus_threat",
    category: "Ragging/Coercion",
    label: "Hostel/campus coercion or isolation summons",
    severity: "high",
    score: 35,
    pattern: /\b(meet\s*behind\s*(the\s*)?(hostel|building|ground)|come\s*to\s*senior|report\s*to\s*senior|midnight\s*attendance|you\s*cant\s*survive\s*here|we\s*will\s*see\s*you\s*in\s*college|wont\s*let\s*you\s*attend)\b/i,
  },
  {
    id: "ragging_intimidation_warning",
    category: "Ragging/Coercion",
    label: "Academic/campus retaliation threat",
    severity: "medium",
    score: 25,
    pattern: /\b(wont\s*let\s*you\s*attend\s*classes|consequences\s*in\s*(college|campus|hostel))\b/i,
  },
];

const BLACKMAIL_RULES = [
  {
    id: "blackmail_leak_threat",
    category: "Blackmail",
    label: "Threat to expose private media, chats, or records",
    severity: "critical",
    score: 55,
    pattern: /\b(leak\s*(your\s*)?(private\s*|secret\s*|intimate\s*)?(photos?|pics?|videos?|nudes?|chats?|recordings?)|expose\s*you|upload\s*(your\s*)?(private\s*)?(pics?|videos?|photos?)|send\s*(it|them)\s*to\s*(your\s*)?(family|parents|friends|college|boss|contact)|viral\s*your\s*(pics?|video))\b/i,
  },
  {
    id: "blackmail_extortion_demand",
    category: "Blackmail",
    label: "Extortion ultimatum or conditional coercion",
    severity: "critical",
    score: 50,
    pattern: /\b(pay\s*(me\s*)?(\$?\d+|money|cash)?\s*or\s*(else|i\s*will)|send\s*(\$?\d+|money|cash)?\s*or\s*(else|i\s*will)|do\s*this\s*or\s*else|or\s*i\s*will\s*ruin\s*you|give\s*in\s*(to\s*our\s*demands\s*)?or\s*face\s*consequences|blackmail)\b/i,
  },
  {
    id: "blackmail_reputation_harm",
    category: "Blackmail",
    label: "Threat to destroy reputation or professional career",
    severity: "high",
    score: 40,
    pattern: /\b(ruin\s*your\s*(life|reputation|career|family)|destroy\s*your\s*name|defame\s*you|tell\s*everyone\s*what\s*you\s*did)\b/i,
  },
];

const URGENCY_PATTERN = /\b(urgent|immediately|right\s*now|within\s*\d+\s*(mins?|minutes?|hours?)|asap|hurry|last\s*warning|final\s*chance|limited\s*time|before\s*its\s*too\s*late)\b/i;

const ALL_RULES = [
  ...SCAM_RULES,
  ...HARASSMENT_RULES,
  ...RAGGING_RULES,
  ...BLACKMAIL_RULES,
];

const CATEGORY_PRIORITY = [
  "Blackmail",
  "Ragging/Coercion",
  "Harassment",
  "Scam/Fraud",
  "Repeated Unsafe",
];

/**
 * Normalizes text to defend against character spacing and leetspeak obfuscation
 */
function normalizeText(text = "") {
  let normalized = String(text).toLowerCase();

  // De-obfuscate common leetspeak substitutions
  normalized = normalized
    .replace(/[@]/g, "a")
    .replace(/[$]/g, "s")
    .replace(/[0]/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/[3]/g, "e");

  // Collapse single space separators inside words (e.g., "o t p" -> "otp")
  normalized = normalized.replace(/\b([a-z])\s+([a-z])\s+([a-z])\b/g, "$1$2$3");
  normalized = normalized.replace(/\b([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\b/g, "$1$2$3$4");

  // Normalize multi-whitespace
  return normalized.replace(/\s+/g, " ").trim();
}

/**
 * Maps risk score to human-readable Threat Level
 */
function getThreatLevel(risk) {
  if (risk >= 71) return "Dangerous";
  if (risk >= 51) return "Warning";
  if (risk >= 31) return "Caution";
  return "Safe";
}

/**
 * Generates an explainable risk advisory and actionable instructions for the user
 */
function generateAdvisory(category, threatLevel, signals, urgencyDetected) {
  let explanation = "";
  let actionAdvice = "";

  switch (category) {
    case "Blackmail":
      explanation =
        "The message contains extortion patterns or threats to leak private photos, videos, or confidential information.";
      actionAdvice =
        "Do NOT comply with demands or send money. Preserve chat evidence immediately, block the sender, and report to platform admins or cyber crime authorities.";
      break;

    case "Ragging/Coercion":
      explanation =
        "The message displays campus or hierarchical coercion, forced obedience, or intimidating commands from seniors.";
      actionAdvice =
        "Ragging and forced servitude are prohibited by institutional guidelines. Save this evidence and report to the Anti-Ragging Committee or campus administration.";
      break;

    case "Harassment":
      explanation =
        "Hostile intimidation, profanity, or threatening language was identified.";
      actionAdvice =
        "You do not have to tolerate abusive communication. You can report this incident and block this user to prevent further contact.";
      break;

    case "Scam/Fraud":
      explanation =
        "Indicators of financial fraud, unverified payment demands, credential harvesting (OTP/PIN), or suspicious links were detected.";
      actionAdvice =
        "Never share OTPs, passwords, or bank PINs with anyone. Do not open unverified links or transfer funds.";
      break;

    case "Repeated Unsafe":
      explanation =
        "A repeated pattern of unsafe, coercive, or aggressive messages has been detected from this sender over a short interval.";
      actionAdvice =
        "This user is repeatedly triggering safety alerts. We strongly recommend blocking this contact and filing an incident report.";
      break;

    default:
      explanation = "No harmful intent or threat patterns were detected.";
      actionAdvice = "Standard safety precautions apply.";
      break;
  }

  if (urgencyDetected && threatLevel !== "Safe") {
    explanation += " High psychological urgency tactics were also detected.";
  }

  return { explanation, actionAdvice };
}

/**
 * Core Threat Analysis Engine
 * 
 * @param {string} message - The message text
 * @param {object} context - Context containing room and username for pattern detection
 * @returns {object} Full explainable moderation result
 */
function analyzeMessage(message = "", context = {}) {
  const originalText = String(message || "");
  const normalizedText = normalizeText(originalText);

  const matchedSignals = [];
  const signals = [];
  const categoryScores = {
    "Scam/Fraud": 0,
    "Harassment": 0,
    "Ragging/Coercion": 0,
    "Blackmail": 0,
    "Repeated Unsafe": 0,
  };

  // Evaluate rules
  for (const rule of ALL_RULES) {
    if (rule.pattern.test(normalizedText) || rule.pattern.test(originalText)) {
      matchedSignals.push(rule.label);
      signals.push({
        signalId: rule.id,
        type: rule.id.split("_")[0],
        label: rule.label,
        severity: rule.severity,
        weight: rule.score,
      });
      categoryScores[rule.category] = (categoryScores[rule.category] || 0) + rule.score;
    }
  }

  const urgencyDetected = URGENCY_PATTERN.test(normalizedText);
  if (urgencyDetected) {
    // Add urgency signal if other threats were detected or high pressure exists
    const hasAnyThreat = signals.length > 0;
    if (hasAnyThreat) {
      matchedSignals.push("Urgency & pressure tactic");
      signals.push({
        signalId: "urgency_pressure",
        type: "urgency",
        label: "Urgency & pressure tactic",
        severity: "medium",
        weight: 15,
      });
      // Boost the highest category slightly
      for (const cat of Object.keys(categoryScores)) {
        if (categoryScores[cat] > 0) {
          categoryScores[cat] += 15;
        }
      }
    }
  }

  // ─── Pattern & Repeated Unsafe Interactions Tracking ────────────────────────
  const { room, username } = context;
  let patternTriggered = false;

  if (room && username) {
    const key = `${room}:${username.toLowerCase()}`;
    const now = Date.now();
    const history = userHistoryWindow.get(key) || [];

    // Filter within 15-minute rolling window
    const recent = history.filter((item) => now - item.timestamp < 15 * 60 * 1000);

    // Count recent flagged messages from this user
    const recentFlaggedCount = recent.filter((item) => item.risk > 30).length;

    if (recentFlaggedCount >= 2 && signals.length > 0) {
      patternTriggered = true;
      matchedSignals.push("Repeated unsafe interaction pattern");
      signals.push({
        signalId: "pattern_repeated_threats",
        type: "pattern",
        label: `Persistent threats (${recentFlaggedCount + 1} flagged messages within 15m)`,
        severity: "critical",
        weight: 25,
      });
      categoryScores["Repeated Unsafe"] = (categoryScores["Repeated Unsafe"] || 0) + 30;
    }

    // Record this message in rolling window
    const currentPreRisk = Math.min(
      MAX_RISK,
      Object.values(categoryScores).reduce((acc, score) => acc + score, 0)
    );
    recent.push({ text: originalText, risk: currentPreRisk, timestamp: now });
    userHistoryWindow.set(key, recent.slice(-10)); // keep last 10 messages
  }

  // Calculate aggregated risk score
  const totalRawScore = Object.values(categoryScores).reduce(
    (total, score) => total + score,
    0
  );
  const risk = Math.min(MAX_RISK, totalRawScore);

  // Determine primary category
  const categoriesDetected = Object.keys(categoryScores).filter(
    (cat) => categoryScores[cat] > 0
  );

  let category = "Safe";
  if (risk > 0) {
    category =
      CATEGORY_PRIORITY.find((catName) => categoryScores[catName] > 0) || "Safe";
  }

  const threatLevel = getThreatLevel(risk);

  // Generate explainability insights
  const { explanation, actionAdvice } = generateAdvisory(
    category,
    threatLevel,
    signals,
    urgencyDetected
  );

  const warning =
    threatLevel === "Safe"
      ? "No major threat detected"
      : `Potential ${category} identified (${threatLevel})`;

  return {
    risk,
    threatLevel,
    category,
    categoriesDetected,
    warning,
    explanation,
    actionAdvice,
    urgencyDetected,
    matchedSignals,
    signals,
    evaluatedAt: new Date().toISOString(),
  };
}

module.exports = {
  analyzeMessage,
  getThreatLevel,
  ALL_RULES,
  CATEGORY_PRIORITY,
};
