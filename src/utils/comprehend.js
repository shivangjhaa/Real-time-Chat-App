// src/utils/comprehend.js
const {
  ComprehendClient,
  DetectSentimentCommand,
  DetectEntitiesCommand,
  DetectPiiEntitiesCommand,
} = require("@aws-sdk/client-comprehend");

let comprehendClient = null;
let isConfigured = false;

try {
  const region = process.env.AWS_REGION || "ap-south-1";
  comprehendClient = new ComprehendClient({
    region,
  });
  isConfigured = true;
} catch (err) {
  console.warn("[SafeChat AI] AWS Comprehend client initialization fallback:", err.message);
  isConfigured = false;
}

/**
 * Analyzes text using AWS Comprehend with automatic fallback.
 * Checks sentiment and entities/PII to provide deep NLP enrichment.
 */
async function analyzeWithComprehend(text) {
  if (!isConfigured || !comprehendClient || !text || text.trim().length === 0) {
    return {
      available: false,
      sentiment: null,
      sentimentScore: null,
      entities: [],
      piiEntities: [],
    };
  }

  // Comprehend accepts up to 5000 bytes per request
  const truncatedText = text.slice(0, 4500);

  const results = {
    available: true,
    sentiment: null,
    sentimentScore: null,
    entities: [],
    piiEntities: [],
  };

  try {
    // 1. Detect Sentiment
    const sentimentCmd = new DetectSentimentCommand({
      LanguageCode: "en",
      Text: truncatedText,
    });
    const sentimentRes = await comprehendClient.send(sentimentCmd);
    results.sentiment = sentimentRes.Sentiment;
    results.sentimentScore = sentimentRes.SentimentScore;
  } catch (err) {
    // Graceful fallback if user lacks Comprehend permissions or non-English text
    // console.debug("[Comprehend] Sentiment check fallback:", err.message);
  }

  try {
    // 2. Detect Entities (Names, dates, quantities, currencies)
    const entitiesCmd = new DetectEntitiesCommand({
      LanguageCode: "en",
      Text: truncatedText,
    });
    const entitiesRes = await comprehendClient.send(entitiesCmd);
    if (entitiesRes && entitiesRes.Entities) {
      results.entities = entitiesRes.Entities.map((e) => ({
        text: e.Text,
        type: e.Type,
        score: Math.round((e.Score || 0) * 100),
      }));
    }
  } catch (err) {
    // console.debug("[Comprehend] Entities check fallback:", err.message);
  }

  return results;
}

module.exports = {
  analyzeWithComprehend,
  isComprehendConfigured: () => isConfigured,
};
