export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY missing." });
  }

  const currentDate = new Date().toISOString();

  try {
    const prompt = `You are an elite sports handicapper. The current date is ${currentDate}.
    Use Google Search to find 2 to 3 REAL, upcoming sports matches (Soccer, Basketball, or Tennis) within the next 24 hours.
    Build a single "Accumulator" (Parlay) bet combining these matches. 
    CRITICAL RULES:
    1. The picks must be highly probable, safe bets (e.g., heavy favorites to win, or very safe Over/Under lines).
    2. The individual decimal odds for each leg should be low (e.g., 1.25 to 1.50).
    3. The TOTAL multiplied decimal odds for the entire accumulator MUST be strictly between 2.00 and 3.00.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }], 
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Catchy title for this accumulator" },
              totalOdds: { type: "NUMBER", description: "The combined total odds (must be 2.0 to 3.0)" },
              legs: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    matchup: { type: "STRING" },
                    sport: { type: "STRING" },
                    league: { type: "STRING", description: "The specific league or tournament name (e.g., Premier League, NBA)" },
                    pick: { type: "STRING" },
                    odds: { type: "NUMBER", description: "Individual leg odds" }
                  },
                  // Added "league" to the required fields
                  required: ["matchup", "sport", "league", "pick", "odds"]
                }
              },
              analysis: { type: "STRING", description: "Why this combined accumulator is a high-confidence bet" }
            },
            required: ["title", "totalOdds", "legs", "analysis"]
          }
        }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(500).json({ error: data.error.message || "Gemini API Error" });
    }

    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(500).json({ error: "Empty response from AI model." });
    }

    const accumulator = JSON.parse(candidateText);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(accumulator);

  } catch (error) {
    return res.status(500).json({ error: "Server error: " + error.message });
  }
}
