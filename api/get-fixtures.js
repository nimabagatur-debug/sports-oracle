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
    const prompt = `Generate ${limit} real, upcoming ${sport} matches for these tournaments: [${leagues}] scheduled within the next ${hoursWindow} hours. 
    You MUST respond with ONLY a valid raw JSON array and nothing else. No markdown blocks, no backticks, no introduction, no explanation. The array must contain objects with these exact keys:
    - "homeTeam": string
    - "awayTeam": string
    - "league": string
    - "country": string
    - "time": string
    - "oddsA": number
    - "oddsB": number
    - "bookmaker": string
    - "confidence": string
    - "analysis": string`;

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

    // Clean up any potential markdown text wrapping safely
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
