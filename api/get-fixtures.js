export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY missing." });
  }

  const urlParams = new URL(req.url, `https://${req.headers.host}`).searchParams;
  const sport = urlParams.get('sport') || 'Football';
  const market = urlParams.get('market') || 'Win / Draw';
  const hoursWindow = parseInt(urlParams.get('hours')) || 24;
  const limit = parseInt(urlParams.get('limit')) || 3;
  const currentDate = new Date().toISOString();

  const prompt = `You are a professional sports handicapper. The current date/time is ${currentDate}.
  Provide exactly ${limit} upcoming ${sport} matches scheduled globally within the next ${hoursWindow} hours.
  For EACH match, provide a specific prediction exclusively for the "${market}" betting market.`;

  const fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              matchup: { type: "STRING", description: "Format: 'Team A vs Team B'" },
              league: { type: "STRING", description: "Tournament or league name" },
              time: { type: "STRING", description: "e.g., 'In 4 hours'" },
              pick: { type: "STRING", description: "The specific prediction (e.g., 'Home Team -1.5', 'Over 2.5 Goals')" },
              odds: { type: "NUMBER", description: "Realistic decimal odds for this specific pick (e.g., 1.90)" },
              analysis: { type: "STRING", description: "One sentence explaining why this pick is valuable" }
            },
            required: ["matchup", "league", "time", "pick", "odds", "analysis"]
          }
        }
      }
    })
  };

  // --- AUTOMATIC RETRY LOGIC ---
  const maxRetries = 3;
  let attempt = 0;
  let delay = 1500; // Start with a 1.5-second delay

  while (attempt < maxRetries) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiKey}`, fetchOptions);
      const data = await response.json();
      
      if (data.error) {
        // If the error is related to high demand or overloading, trigger a retry
        if (data.error.message.includes("high demand") || data.error.code === 503) {
          throw new Error("High Demand");
        }
        return res.status(500).json({ error: data.error.message || "Gemini API Error" });
      }

      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        return res.status(500).json({ error: "Empty response from AI model." });
      }

      const fixtures = JSON.parse(candidateText);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      return res.status(200).json({ fixtures });

    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        return res.status(500).json({ error: "AI servers are currently overloaded. Please try again in a few minutes." });
      }
      // Wait before retrying (Exponential Backoff: 1.5s, 3s)
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; 
    }
  }
}
