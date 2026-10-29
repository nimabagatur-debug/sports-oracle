export default async function handler(req, res) {
  // CORS Security Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY missing." });
  }

  const urlParams = new URL(req.url, `https://${req.headers.host}`).searchParams;
  const hoursWindow = parseInt(urlParams.get('hours')) || 24;
  const sport = urlParams.get('sport') || 'football';
  const currentDate = new Date().toISOString();

  try {
    const prompt = `You are a professional sports data oracle. The current date and time is ${currentDate}. 
    Provide exactly 3 upcoming ${sport} matches scheduled globally within the next ${hoursWindow} hours. 
    Ensure high-profile matches and realistic, up-to-date decimal odds.`;

    // FIXED: Using the official 'gemini-1.5-flash' endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                homeTeam: { type: "STRING", description: "Home team name" },
                awayTeam: { type: "STRING", description: "Away team name" },
                league: { type: "STRING", description: "Tournament or league name" },
                country: { type: "STRING", description: "Host country" },
                time: { type: "STRING", description: "Time until kickoff, e.g., 'In 4 hours'" },
                oddsA: { type: "NUMBER", description: "Decimal odds for home team to win, e.g., 2.10" },
                oddsB: { type: "NUMBER", description: "Decimal odds for away team to win, e.g., 1.85" },
                bookmaker: { type: "STRING", description: "Name of a major sportsbook, e.g., 'Bet365'" },
                confidence: { type: "STRING", description: "Prediction confidence: 'High' or 'Medium'" },
                analysis: { type: "STRING", description: "One sentence tactical analysis explaining the odds" }
              },
              required: ["homeTeam", "awayTeam", "league", "country", "time", "oddsA", "oddsB", "bookmaker", "confidence", "analysis"]
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

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    
    return res.status(200).json({ fixtures });

  } catch (error) {
    return res.status(500).json({ error: "Server error: " + error.message });
  }
}
