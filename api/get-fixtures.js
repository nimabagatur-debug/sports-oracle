export default async function handler(req, res) {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY missing." });
  }

  const urlParams = new URL(req.url, `https://${req.headers.host}`).searchParams;
  const hoursWindow = parseInt(urlParams.get('hours')) || 24;
  const leagues = urlParams.get('leagues') || 'Premier League, La Liga, Serie A, Champions League';
  const limit = parseInt(urlParams.get('limit')) || 5;
  const sport = urlParams.get('sport') || 'football';

  try {
    // Prompt Gemini to search the web for real-time upcoming matches matching user choices
    const prompt = `You are a professional sports data oracle. Search the web for real, upcoming ${sport} matches in these leagues/tournaments: [${leagues}] happening within the next ${hoursWindow} hours. 
    Select up to ${limit} best matches. 
    You MUST respond with ONLY a valid JSON array (no markdown code blocks, no extra text) containing objects with these exact keys:
    - "homeTeam": string (exact team name)
    - "awayTeam": string (exact team name)
    - "league": string (league or tournament name)
    - "country": string (country name)
    - "time": string (kickoff time or hours from now)
    - "oddsA": number (realistic decimal odds for home win, e.g. 1.75)
    - "oddsB": number (realistic decimal odds for away/other win, e.g. 2.10)
    - "bookmaker": string (e.g. "Bet365", "DraftKings", "FanDuel")
    - "confidence": string ("High" or "Medium")
    - "analysis": string (short professional tactical analysis sentence)`;

    // Call Gemini API with Google Search enabled for live web grounding
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        tools: [{ "googleSearch": {} }] // Enables live web search grounding
      })
    });

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(500).json({ error: "Failed to retrieve data from AI Oracle." });
    }

    // Clean up potential markdown formatting if the model included it
    let cleanJsonStr = candidateText.trim();
    if (cleanJsonStr.startsWith("```json")) {
      cleanJsonStr = cleanJsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const fixtures = JSON.parse(cleanJsonStr);

    return res.status(200).json({ fixtures });
  } catch (error) {
    return res.status(500).json({ error: "AI Oracle processing error: " + error.message });
  }
}
