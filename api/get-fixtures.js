export default async function handler(req, res) {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY missing." });
  }

  const urlParams = new URL(req.url, `https://${req.headers.host}`).searchParams;
  const hoursWindow = parseInt(urlParams.get('hours')) || 24;
  const sport = urlParams.get('sport') || 'football';
  const limit = 3; // Strictly capped to 3 results as requested

  try {
    const prompt = `Act as an expert sports analytics oracle. Generate exactly ${limit} real, upcoming ${sport} matches scheduled within the next ${hoursWindow} hours. 
    You MUST respond with ONLY a valid raw JSON array and nothing else (no markdown blocks like \`\`\`json, no backticks, no introduction text). The array must contain objects with these exact keys:
    - "homeTeam": string (team name)
    - "awayTeam": string (team name)
    - "league": string (league or tournament name)
    - "country": string (country name)
    - "time": string (kickoff time or hours from now)
    - "oddsA": number (realistic decimal odds for home win, e.g. 1.75)
    - "oddsB": number (realistic decimal odds for away win, e.g. 2.10)
    - "bookmaker": string (e.g. "Bet365", "DraftKings")
    - "confidence": string ("High" or "Medium")
    - "analysis": string (short tactical analysis sentence)`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(500).json({ error: "Gemini API Error: " + (data.error.message || JSON.stringify(data.error)) });
    }

    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(500).json({ error: "Empty response received from AI model." });
    }

    // Clean up potential markdown formatting safely
    let cleanJsonStr = candidateText.trim();
    if (cleanJsonStr.startsWith("```json")) {
      cleanJsonStr = cleanJsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const fixtures = JSON.parse(cleanJsonStr);
    return res.status(200).json({ fixtures });

  } catch (error) {
    return res.status(500).json({ error: "Server processing error: " + error.message });
  }
}
