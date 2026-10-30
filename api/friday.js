export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Зөвхөн GET хүсэлт хүлээн авна' });
    }

    // Vercel Environment Variables дотор тохируулсан API-SPORTS түлхүүр
    const API_KEY = process.env.API_SPORTS_KEY; 
    if (!API_KEY) {
        return res.status(500).json({ error: 'API_SPORTS_KEY тохируулагдаагүй байна.' });
    }

    try {
        // 1. Улаанбаатарын цагаар (UTC+8) дараагийн Баасан гарагийн огноог олох
        const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ulaanbaatar"}));
        const dayOfWeek = now.getDay();
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7; 
        
        const targetDateObj = new Date(now);
        targetDateObj.setDate(now.getDate() + daysUntilFriday);
        const targetDate = targetDateObj.toISOString().split('T')[0]; // YYYY-MM-DD

        const headers = {
            'x-apisports-key': API_KEY
        };

        // 2. Тухайн өдрийн тоглолтууд болон Коэффициентийг зэрэг татах (Bookmaker 8 = Bet365)
        const [fixturesRes, oddsRes] = await Promise.all([
            fetch(`https://v3.football.api-sports.io/fixtures?date=${targetDate}`, { headers }),
            fetch(`https://v3.football.api-sports.io/odds?date=${targetDate}&bookmaker=8`, { headers })
        ]);

        const fixturesData = await fixturesRes.json();
        const oddsData = await oddsRes.json();

        if (!fixturesData.response || !oddsData.response) {
            return res.status(500).json({ error: "API-аас дата татахад алдаа гарлаа" });
        }

        // 3. Тоглолтын нэр, цагийг ID-гаар нь холбож бэлдэх
        const fixtureMap = new Map();
        fixturesData.response.forEach(item => {
            fixtureMap.set(item.fixture.id, {
                league: item.league.name,
                home: item.teams.home.name,
                away: item.teams.away.name,
                date: item.fixture.date
            });
        });

        let validPicks = [];

        // 4. Коэффициентуудыг шүүх
        for (const matchOdds of oddsData.response) {
            const fixtureInfo = fixtureMap.get(matchOdds.fixture.id);
            if (!fixtureInfo) continue;

            const bookmaker = matchOdds.bookmakers[0];
            if (!bookmaker) continue;

            const matchWinnerMarket = bookmaker.bets.find(b => b.name === "Match Winner" || b.id === 1);
            if (!matchWinnerMarket) continue;

            // 1.4-өөс дээш, 1.85 хүртэлх (Өндөр магадлалтай) сонголтыг хайх
            for (const value of matchWinnerMarket.values) {
                const odd = parseFloat(value.odd);
                
                if (odd > 1.40 && odd <= 1.85) {
                    let pickName = "";
                    if (value.value === "Home") pickName = `${fixtureInfo.home} Хожих (1)`;
                    else if (value.value === "Away") pickName = `${fixtureInfo.away} Хожих (2)`;
                    else if (value.value === "Draw") pickName = "Тэнцэх (X)";

                    // Тоглолтын цагийг УБ цаг руу хөрвүүлэх
                    const matchDate = new Date(fixtureInfo.date);
                    const ubTimeStr = matchDate.toLocaleString("mn-MN", { 
                        timeZone: "Asia/Ulaanbaatar", 
                        hour: '2-digit', 
                        minute:'2-digit' 
                    });

                    validPicks.push({
                        league: fixtureInfo.league,
                        matchup: `${fixtureInfo.home} vs ${fixtureInfo.away}`,
                        pick: pickName,
                        odds: odd.toFixed(2),
                        ubTime: `Баасан гараг, ${ubTimeStr}`,
                        winProbability: (1 / odd) // Эрэмбэлэхэд зориулсан магадлал
                    });
                    break; // Нэг тоглолтоос зөвхөн хамгийн өндөр магадлалтай нэг сонголтыг л авна
                }
            }
        }

        // 5. Хамгийн өндөр магадлалтайгаас нь эхлэн эрэмбэлэх (Хамгийн бага коэффициенттэй нь эхэндээ)
        validPicks.sort((a, b) => b.winProbability - a.winProbability);

        // 6. Шилдэг 15 сонголтыг салгаж авах
        const finalPicks = validPicks.slice(0, 15).map(pick => {
            // Магадлалыг хувь болгож харуулах (жишээ нь: 1.42 odds = 70.4% chance)
            pick.probabilityInfo = (pick.winProbability * 100).toFixed(1) + "%";
            delete pick.winProbability;
            return pick;
        });

        return res.status(200).json({ picks: finalPicks });

    } catch (error) {
        console.error("API алдаа:", error);
        return res.status(500).json({ error: "Сервертэй холбогдоход алдаа гарлаа." });
    }
}
