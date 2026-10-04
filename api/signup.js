function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk.toString();
    });

    req.on("end", () => {
      resolve(data);
    });

    req.on("error", (error) => {
      reject(error);
    });
  });
}

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
    let body;

    // Try Vercel's parsed body first.
    if (req.body !== undefined && req.body !== null) {
      body = req.body;
    } else {
      // Otherwise read the raw request stream.
      const rawBody = await readRequestBody(req);

      try {
        body = JSON.parse(rawBody);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid JSON body",
          rawBody: rawBody
        });
      }
    }

    // If the parsed body is still a string, parse it.
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid JSON"
        });
      }
    }

    const email = body?.email;
    const password = body?.password;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
        receivedBody: body
      });
    }

    if (!process.env.FIREBASE_API_KEY) {
      return res.status(500).json({
        error: "FIREBASE_API_KEY is missing in Vercel"
      });
    }

    const firebaseResponse = await fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" +
        process.env.FIREBASE_API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email,
          password: password,
          returnSecureToken: true
        })
      }
    );

    const data = await firebaseResponse.json();

    if (!firebaseResponse.ok) {
      return res.status(firebaseResponse.status).json({
        success: false,
        error: data?.error?.message || "Firebase signup failed"
      });
    }

    return res.status(200).json({
      success: true,
      uid: data.localId,
      email: data.email,
      idToken: data.idToken,
      refreshToken: data.refreshToken
    });

  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      success: false,
      error: "Server error",
      details: error.message
    });
  }
};
