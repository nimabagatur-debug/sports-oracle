export default async function handler(req, res) {
  const apiKey = process.env.SPORTS_API_KEY; // Pulled securely from Vercel environment variables

  if (!apiKey) {
    return res.status(500).json({ error: "Server configuration error: API Key missing." });
  }

  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    const apiResponse = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
      headers: {
        "x-apisports-key": apiKey
      }
    });

    const data = await apiResponse.json();
    
    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(400).json({ error: JSON.stringify(data.errors) });
    }

    // Clean up and format response for frontend
    const fixtures = (data.response || []).slice(0, 8).map(item => ({
      homeTeam: item.teams.home.name,
      awayTeam: item.teams.away.name,
      league: item.league.name,
      country: item.league.country,
      time: new Date(item.fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: item.fixture.status.short
    }));

    return res.status(200).json({ fixtures });
  } catch (error) {
    return res.status(500).json({ error: "Failed to connect to sports data provider." });
  }
}
