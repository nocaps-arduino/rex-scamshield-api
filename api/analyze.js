module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST required"
    });
  }

  try {
    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid JSON"
        });
      }
    }

    const message = body?.message;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        error: "Message is too long"
      });
    }

    const systemPrompt = `
You are the semantic scam detection engine for rex ScamShield.

Analyze a message for scam, fraud, phishing, impersonation,
social engineering, or financial manipulation.

Analyze meaning and context, not just keywords.

Consider:
- Banking/KYC phishing
- OTP or password theft
- UPI/payment manipulation
- Fake prizes
- Advance-fee scams
- Investment scams
- Fake job offers
- Delivery/parcel/customs scams
- Impersonation
- Requests for money
- Requests for sensitive information
- Artificial urgency
- Threats such as account suspension
- Suspicious links or instructions

A legitimate OTP notification that tells the recipient NOT to share
their OTP should not automatically be classified as a scam.

Return ONLY JSON with this structure:

{
  "risk": "LOW",
  "category": "OTHER"
}

risk must be exactly:
LOW
MEDIUM
HIGH

category must be exactly:
BANKING
UPI
INVESTMENT
JOB
DELIVERY
PRIZE
IMPERSONATION
OTHER
`;

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: message
            }
          ],
          temperature: 0.1,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "scam_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  risk: {
                    type: "string",
                    enum: ["LOW", "MEDIUM", "HIGH"]
                  },
                  category: {
                    type: "string",
                    enum: [
                      "BANKING",
                      "UPI",
                      "INVESTMENT",
                      "JOB",
                      "DELIVERY",
                      "PRIZE",
                      "IMPERSONATION",
                      "OTHER"
                    ]
                  }
                },
                required: ["risk", "category"],
                additionalProperties: false
              }
            }
          }
        })
      }
    );

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Groq API error:", data);

      return res.status(500).json({
        error: "AI provider error"
      });
    }

    const content =
      data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No AI response received");
    }

    const result = JSON.parse(content);

    return res.status(200).json({
      risk: result.risk,
      category: result.category
    });

  } catch (error) {
    console.error("Scam analysis error:", error);

    return res.status(500).json({
      error: "Analysis failed"
    });
  }
};
