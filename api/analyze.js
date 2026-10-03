const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST required",
    });
  }

  try {
    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid JSON",
        });
      }
    }

    const message = body?.message;

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
You are the semantic scam detection system for rex ScamShield.

Analyze this message for signs of scams, fraud, phishing,
social engineering, impersonation, or financial manipulation.

Analyze the meaning and context, not just keywords.

Look for:
- Banking or KYC phishing
- OTP or password theft
- UPI/payment manipulation
- Fake prizes
- Advance-fee scams
- Fraudulent investment schemes
- Fake job offers
- Parcel/customs/delivery scams
- Impersonation
- Requests for money
- Requests for sensitive information
- Artificial urgency
- Threats such as account suspension
- Suspicious links or instructions

Important:
A legitimate OTP notification that tells the recipient NOT to share
their OTP should not automatically be classified as a scam.

Return ONLY valid JSON in exactly this format:

{
  "risk": "LOW",
  "category": "OTHER"
}

risk must be exactly one of:
LOW
MEDIUM
HIGH

category must be exactly one of:
BANKING
UPI
INVESTMENT
JOB
DELIVERY
PRIZE
IMPERSONATION
OTHER

Do not return markdown.
Do not return an explanation.
Do not return anything except the JSON object.

MESSAGE:

${JSON.stringify(message)}
`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input: prompt,
    });

    const raw = interaction.output_text.trim();

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

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

    if (
      !validRisks.includes(result.risk) ||
      !validCategories.includes(result.category)
    ) {
      throw new Error("Invalid AI response");
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
