const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

module.exports = async function handler(req, res) {
  // Allow requests from MIT App Inventor / Hoppscotch
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
    // Read request body
    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
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

Analyze the following message and determine whether it appears
to be a scam, phishing attempt, fraud attempt, or social
engineering message.

Analyze the MEANING and CONTEXT, not just individual keywords.

Look for:

- Banking and KYC phishing
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

IMPORTANT:

A legitimate message containing words such as OTP, bank,
payment, or password is NOT automatically a scam.

For example:

"Your OTP is 123456. Never share this OTP with anyone."

should normally be LOW risk unless there are other suspicious
elements.

Return ONLY valid JSON.

Use exactly this structure:

{
  "risk": "LOW",
  "category": "OTHER"
}

risk MUST be exactly one of:

LOW
MEDIUM
HIGH

category MUST be exactly one of:

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

Do not include any text before or after the JSON.

MESSAGE TO ANALYZE:

${JSON.stringify(message)}
`;

    // Gemini 3.8 Flash - Interactions API
    const interaction = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input: prompt,
    });

    const raw = interaction.output_text.trim();

    // Remove markdown fences just in case
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
