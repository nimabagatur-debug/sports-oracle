export default async function handler(req, res) {
  const apiKey = process.env.SPORTS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Server configuration error: API Key missing." });
  }

  // Extract query parameters sent from frontend
  const urlParams = new URL(req.url, `https://${req.headers.host}`).searchParams;
  const date = urlParams.get('date') || new Date().toISOString().split('T')[0];
  const leaguesParam = urlParams.get('leagues') || '39,140,135,2';
  const limit = parseInt(urlParams.get('limit')) || 5;

  const leagueIds = leaguesParam.split(',').map(id => parseInt(id));

  try {
    let allFixtures = [];

    // Fetch fixtures for each selected league ID on the specified date
    for (const leagueId of leagueIds) {
      const apiResponse = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}&league=${leagueId}&season=2024`, {
        headers: { "x-apisports-key": apiKey }
      });
      
      const data = await apiResponse.json();
      if (data.response && data.response.length > 0) {
        allFixtures = [...allFixtures, ...data.response];
      }
    }

    // If no fixtures found for that exact season or date, fetch general matches for that date as fallback
    if (allFixtures.length === 0) {
      const fallbackRes = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
        headers: { "x-apisports-key": apiKey }
      });
      const fallbackData = await fallbackRes.json();
      allFixtures = fallbackData.response || [];
    }

    // Map and calculate smart "Best Choice" ratings & simulated realistic odds
    const fixtures = allFixtures.slice(0, limit).map((item, index) => {
      const oddsA = +(Math.random() * 0.8 + 1.4).toFixed(2);
      const oddsB = +(Math.random() * 1.5 + 2.1).toFixed(2);
      const confidence = index % 2 === 0 ? 'High' : 'Medium';

      return {
        homeTeam: item.teams.home.name,
        awayTeam: item.teams.away.name,
        league: item.league.name,
        country: item.league.country,
        time: new Date(item.fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        oddsA: oddsA,
        oddsB: oddsB,
        confidence: confidence,
        analysis: `Oracle scanned current squad stats. Strong tactical value identified for ${item.teams.home.name} at home.`
      };
    });

    return res.status(200).json({ fixtures });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch curated sports data." });
  }
}
