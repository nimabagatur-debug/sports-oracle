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

  try {
    const prompt = `You are a professional sports handicapper. The current date/time is ${currentDate}.
    First, use Google Search to find exactly ${limit} REAL upcoming ${sport} matches scheduled globally within the next ${hoursWindow} hours.
    Then, for EACH real match you found, provide a specific prediction exclusively for the "${market}" betting market.
    Ensure the teams and match times are 100% accurate and real.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Gives the 3.5 Lite model live internet access to fix hallucinated matches
        tools: [{ googleSearch: {} }], 
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
                pick: { type: "STRING", description: "The specific prediction (e.g., 'Home Team -1.5', 'Over 2.5 Goals', 'Away Win')" },
                odds: { type: "NUMBER", description: "Realistic decimal odds for this specific pick (e.g., 1.90)" },
                analysis: { type: "STRING", description: "One sentence explaining why this pick is valuable" }
              },
              required: ["matchup", "league", "time", "pick", "odds", "analysis"]
            }
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

    const fixtures = JSON.parse(candidateText);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ fixtures });

  } catch (error) {
    return res.status(500).json({ error: "Server error: " + error.message });
  }
}
