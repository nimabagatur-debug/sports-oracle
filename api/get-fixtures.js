export default async function handler(req, res) {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY missing." });
  }

  const urlParams = new URL(req.url, `https://${req.headers.host}`).searchParams;
  const hoursWindow = parseInt(urlParams.get('hours')) || 24;
  const sport = urlParams.get('sport') || 'football';

  try {
    const prompt = `Generate exactly 3 upcoming ${sport} matches scheduled within the next ${hoursWindow} hours. 
    Return ONLY a valid JSON array. No explanations, no markdown blocks, no extra text. 
    Each object in the array must have these exact keys:
    "homeTeam" (string), "awayTeam" (string), "league" (string), "country" (string), "time" (string), "oddsA" (number), "oddsB" (number), "bookmaker" (string), "confidence" (string), "analysis" (string).`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-light:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
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

    // Safely parse JSON even if hidden characters or formatting exist
    const jsonMatch = candidateText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Model failed to output a valid JSON array." });
    }

    const fixtures = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ fixtures });

  } catch (error) {
    return res.status(500).json({ error: "Server error: " + error.message });
  }
}
