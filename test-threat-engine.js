// test-threat-engine.js
/**
 * SafeChat Threat Detection Benchmark & Evaluation Suite
 * Evaluates detection across all 5 threat categories, benign conversations, and evasion techniques.
 */

const { analyzeMessage } = require("./src/utils/moderation");

const testCases = [
  // ─── Category 1: Online Scams & Financial Fraud ────────────────────────────
  {
    category: "Scam/Fraud",
    text: "Dear customer, your SBI net banking account is suspended. Update your KYC now at bit.ly/sbi-verify or account blocked",
    expectedCategory: "Scam/Fraud",
    minRisk: 50,
  },
  {
    category: "Scam/Fraud",
    text: "Please share me your OTP immediately to claim your 50,000 lottery cash prize!",
    expectedCategory: "Scam/Fraud",
    minRisk: 60,
  },
  {
    category: "Scam/Fraud",
    text: "Send money to my Google Pay right now or your registration fee will lapse",
    expectedCategory: "Scam/Fraud",
    minRisk: 40,
  },

  // ─── Category 2: Harassment & Abuse ────────────────────────────────────────
  {
    category: "Harassment",
    text: "You are a worthless loser and an idiot, shut up and get lost",
    expectedCategory: "Harassment",
    minRisk: 35,
  },
  {
    category: "Harassment",
    text: "I will hunt you down and kill you, watch your back you are dead",
    expectedCategory: "Harassment",
    minRisk: 70,
  },
  {
    category: "Harassment",
    text: "Go die and kill yourself nobody cares about you",
    expectedCategory: "Harassment",
    minRisk: 70,
  },

  // ─── Category 3: Ragging & Coercion ─────────────────────────────────────────
  {
    category: "Ragging/Coercion",
    text: "Obey the seniors! You fresher listen to junior rules and respect your seniors",
    expectedCategory: "Ragging/Coercion",
    minRisk: 40,
  },
  {
    category: "Ragging/Coercion",
    text: "Do my assignment right now and clean our room or you cant survive here",
    expectedCategory: "Ragging/Coercion",
    minRisk: 65,
  },
  {
    category: "Ragging/Coercion",
    text: "Meet behind the hostel at midnight attendance, wont let you attend classes tomorrow",
    expectedCategory: "Ragging/Coercion",
    minRisk: 50,
  },

  // ─── Category 4: Blackmail & Extortion ──────────────────────────────────────
  {
    category: "Blackmail",
    text: "Pay me $500 or else I will leak your private photos to your family and friends",
    expectedCategory: "Blackmail",
    minRisk: 80,
  },
  {
    category: "Blackmail",
    text: "I have your recordings and private chats. Send money or I will expose you and ruin your career",
    expectedCategory: "Blackmail",
    minRisk: 80,
  },
  {
    category: "Blackmail",
    text: "Give in to our demands or face consequences, I will defame you everywhere",
    expectedCategory: "Blackmail",
    minRisk: 60,
  },

  // ─── Category 5: Repeated Unsafe Pattern ───────────────────────────────────
  // We'll test rolling window for this user below

  // ─── Safe / Benign Everyday Messages (False Positive Resistance) ───────────
  {
    category: "Benign/Safe",
    text: "Hey, are we still meeting for the project discussion tomorrow at 4 PM in the library?",
    expectedCategory: "Safe",
    maxRisk: 0,
  },
  {
    category: "Benign/Safe",
    text: "Thanks for sharing the lecture notes, let me review them tonight.",
    expectedCategory: "Safe",
    maxRisk: 0,
  },
  {
    category: "Benign/Safe",
    text: "Can someone share the link to the React documentation?",
    expectedCategory: "Safe",
    maxRisk: 30, // should not be high risk or dangerous
  },
];

console.log("==================================================================");
console.log("SafeChat Threat Detection Engine - Comprehensive Benchmark Suite");
console.log("==================================================================\n");

let passedCount = 0;
const startTime = Date.now();

testCases.forEach((tc, index) => {
  const t0 = process.hrtime.bigint();
  const result = analyzeMessage(tc.text, { room: "benchmark", username: "user" + index });
  const t1 = process.hrtime.bigint();
  const latencyMs = Number(t1 - t0) / 1e6;

  let passed = true;
  if (tc.expectedCategory === "Safe") {
    if (result.risk > (tc.maxRisk !== undefined ? tc.maxRisk : 30)) {
      passed = false;
    }
  } else {
    if (result.category !== tc.expectedCategory || result.risk < tc.minRisk) {
      passed = false;
    }
  }

  if (passed) passedCount++;

  console.log(`[Test ${index + 1}/${testCases.length}] Category: ${tc.category} | ${passed ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`  Input: "${tc.text.substring(0, 60)}..."`);
  console.log(`  Result: Category="${result.category}", Risk=${result.risk}/100, Level="${result.threatLevel}", Latency=${latencyMs.toFixed(2)}ms`);
  console.log(`  Signals: [${result.matchedSignals.join(", ")}]`);
  console.log(`  Explanation: ${result.explanation.substring(0, 70)}...`);
  console.log(`  Action: ${result.actionAdvice.substring(0, 70)}...`);
  console.log("");
});

// Test Category 5: Repeated Unsafe Pattern
console.log("─── Testing Category 5: Pattern & Repeated Unsafe Interactions ───");
const room = "pattern-test-room";
const abusiveUser = "troll_user_42";

// 1st attack
const r1 = analyzeMessage("You are an idiot and shut up", { room, username: abusiveUser });
// 2nd attack
const r2 = analyzeMessage("I will hurt you loser", { room, username: abusiveUser });
// 3rd attack (should trigger Pattern Escalation)
const r3 = analyzeMessage("Watch your back you are dead", { room, username: abusiveUser });

const patternPassed = r3.matchedSignals.some((s) => s.includes("Repeated unsafe interaction pattern"));
if (patternPassed) passedCount++;

console.log(`  Message 1 Risk: ${r1.risk}`);
console.log(`  Message 2 Risk: ${r2.risk}`);
console.log(`  Message 3 Risk: ${r3.risk} (Pattern Triggered: ${patternPassed ? "✓ YES" : "✗ NO"})`);
console.log(`  Message 3 Signals: [${r3.matchedSignals.join(", ")}]`);
console.log(`  Pattern Test: ${patternPassed ? "✓ PASS" : "✗ FAIL"}\n`);

const totalTests = testCases.length + 1;
const totalDuration = Date.now() - startTime;
const accuracy = Math.round((passedCount / totalTests) * 100);

console.log("==================================================================");
console.log(`Summary: ${passedCount}/${totalTests} Passed (${accuracy}%) in ${totalDuration}ms`);
console.log("==================================================================");
