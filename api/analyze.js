module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST required" });
  }

  try {
    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: "Invalid JSON" });
      }
    }

    const message = body?.message;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "GROQ_API_KEY is missing in Vercel"
      });
    }

    const systemPrompt = `
You are rex ScamShield, a scam detection AI.

Analyze the user's message using meaning and context.

Return ONLY JSON in this exact format:

{
  "risk": "LOW",
  "category": "OTHER"
}

risk must be one of:
LOW
MEDIUM
HIGH

category must be one of:
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
          temperature: 0,
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
      return res.status(500).json({
        error: "Groq rejected request",
        status: groqResponse.status,
        details: data
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "No AI response"
      });
    }

    const result = JSON.parse(content);

    return res.status(200).json({
      risk: result.risk,
      category: result.category
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
};
