const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST required",
    });
  }

  try {
    const message = req.body?.message;

    // Validate input
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        error: "Message is too long",
      });
    }

    const prompt = `
You are the semantic scam-detection component of rex ScamShield.

Analyze the following message for signs of fraud, phishing,
social engineering, impersonation, or financial manipulation.

Analyze the MEANING and CONTEXT of the message, not just keywords.

Look for:
- banking or KYC phishing
- OTP or credential theft
- UPI/payment manipulation
- fake prizes
- advance-fee scams
- fraudulent investment promises
- fake job offers
- parcel/customs/delivery scams
- impersonation
- requests for money
- requests for sensitive information
- artificial urgency
- threats such as account suspension
- suspicious links or instructions

IMPORTANT:
A legitimate OTP notification telling the recipient NOT to share
their OTP should not automatically be classified as a scam.

Return ONLY valid JSON.

Use exactly this structure:

{
  "risk": "LOW",
  "category": "OTHER"
}

"risk" MUST be one of:
LOW
MEDIUM
HIGH

"category" MUST be one of:
BANKING
UPI
INVESTMENT
JOB
DELIVERY
PRIZE
IMPERSONATION
OTHER

Do not include markdown.
Do not include explanations.
Do not include text before or after the JSON.

MESSAGE TO ANALYZE:

${JSON.stringify(message)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const raw = response.text.trim();

    // Remove markdown fences if the model unexpectedly adds them
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "");

    const result = JSON.parse(cleaned);

    const validRisks = [
      "LOW",
      "MEDIUM",
      "HIGH",
    ];

    const validCategories = [
      "BANKING",
      "UPI",
      "INVESTMENT",
      "JOB",
      "DELIVERY",
      "PRIZE",
      "IMPERSONATION",
      "OTHER",
    ];

    // Validate AI response
    if (
      !validRisks.includes(result.risk) ||
      !validCategories.includes(result.category)
    ) {
      throw new Error("Invalid model response");
    }

    return res.status(200).json({
      risk: result.risk,
      category: result.category,
    });
  } catch (error) {
    console.error("Scam analysis error:", error);

    return res.status(500).json({
      error: "Analysis failed",
    });
  }
};
