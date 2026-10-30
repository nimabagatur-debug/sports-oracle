export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) return res.status(500).json({ error: "Server error: GEMINI_API_KEY missing." });

  const options = { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  const currentUBTime = new Date().toLocaleString('en-US', options);

  try {
    const prompt = `You are a highly accurate sports betting analyst. The current date and time in Ulaanbaatar, Mongolia is ${currentUBTime}.
    
    You have access to Google Search. To prevent generating fake data, you MUST follow these steps exactly:
    1. Search for REAL sports fixtures (Soccer, Basketball, or Tennis) officially scheduled for this upcoming Friday. Focus on major competitions (e.g., Premier League, La Liga, NBA, ATP).
    2. Verify the matches actually exist.
    3. Search for the current Match Winner (1X2) odds for these specific verified matches.
    4. Select up to 10 matches where the odds for a "Win" or "Draw" are confirmed to be strictly GREATER than 1.40 (e.g., 1.45, 1.60, 1.85).

    CRITICAL RULES:
    - DO NOT invent matches or guess odds. If you cannot verify the match is happening this Friday with real odds, exclude it entirely.
    - Only pick "Win" or "Draw". No handicaps or over/under.
    - Convert all match kickoff times to Ulaanbaatar time (e.g., "Friday, 21:00").
    - Output all text, team names, leagues, and analysis strictly in ENGLISH.

    Return ONLY valid JSON matching the schema, with no markdown formatting.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }], 
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1, // Low temperature forces the AI to be more factual and less creative
          responseSchema: {
            type: "OBJECT",
            properties: {
              picks: {
                type: "ARRAY",
                description: "Array of up to 10 verified matches",
                items: {
                  type: "OBJECT",
                  properties: {
                    matchup: { type: "STRING", description: "Team A vs Team B" },
                    league: { type: "STRING", description: "League or tournament name" },
                    pick: { type: "STRING", description: "The recommended Win or Draw pick" },
                    odds: { type: "NUMBER", description: "Individual leg odds (must be > 1.40)" },
                    ubTime: { type: "STRING", description: "Match time in Ulaanbaatar time" }
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

    // Strip formatting and parse
    const cleanText = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const fridayData = JSON.parse(cleanText);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(fridayData);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
