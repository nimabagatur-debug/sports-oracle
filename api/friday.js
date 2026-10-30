glis// api/friday.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) return res.status(500).json({ error: "Server error: GEMINI_API_KEY missing." });

  // Get current time in Ulaanbaatar to provide context to Gemini
  const options = { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  const currentUBTime = new Date().toLocaleString('en-US', options);

  try {
    const prompt = `You are an elite sports handicapper. The current date and time in Ulaanbaatar, Mongolia is ${currentUBTime}.
    Use Google Search to find REAL, upcoming sports matches (Soccer, Basketball, Esports, or Tennis) scheduled for this upcoming FRIDAY (Ulaanbaatar time zone).
    
    CRITICAL RULES:
    1. Find up to 15 highly probable matches happening on Friday.
    2. The betting pick MUST be a "Win" or "Draw" (1X) market only. No over/under or handicaps.
    3. The individual decimal odds for EACH pick MUST be strictly higher than 1.40 (e.g., 1.45, 1.55, 1.80).
    4. Choose matches with high win probabilities based on your analysis
    

    Return ONLY valid JSON matching the schema, no markdown blocks.`;

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
              picks: {
                type: "ARRAY",
                description: "Array of up to 15 matches",
                items: {
                  type: "OBJECT",
                  properties: {
                    matchup: { type: "STRING", description: "Team A vs Team B (in English)" },
                    league: { type: "STRING", description: "League or tournament name (in English)" },
                    pick: { type: "STRING", description: "The recommended Win or Draw pick (in English)" },
                    odds: { type: "NUMBER", description: "Individual leg odds (must be > 1.40)" },
                    ubTime: { type: "STRING", description: "The match time in Ulaanbaatar time (e.g., Баасан гараг, 22:00)" }
                  },
                  required: ["matchup", "league", "pick", "odds", "ubTime"]
                }
              }
            },
            required: ["picks"]
          }
        }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "Gemini API Error");

    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) throw new Error("Empty response from AI model.");

    // Strip Markdown block formatting from the AI response
    const cleanText = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const fridayData = JSON.parse(cleanText);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(fridayData);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
