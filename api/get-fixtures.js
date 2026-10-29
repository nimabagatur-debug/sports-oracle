// Standard Prediction Fetch
        async function getPredictions() {
            // Gets the sport text (e.g., "Soccer") to display it
            const sportSelect = document.getElementById('sport-select');
            const sportText = sportSelect.options[sportSelect.selectedIndex].text;
            
            const sport = sportSelect.value;
            const market = document.getElementById('market-select').value;
            const btn = document.getElementById('submit-btn');
            const resultsDiv = document.getElementById('results');
            document.getElementById('accumulator-result').innerHTML = ''; // Clear accumulator

            btn.disabled = true;
            btn.innerText = "Analyzing Markets...";
            resultsDiv.innerHTML = `<div class="col-span-full text-center py-10 text-cyan-500 animate-pulse">Querying AI for ${selectedCount} ${market} picks...</div>`;

            try {
                const response = await fetch(`/api/get-fixtures?sport=${encodeURIComponent(sport)}&market=${encodeURIComponent(market)}&hours=${selectedTime}&limit=${selectedCount}`);
                const data = await response.json();

                if (data.error) throw new Error(data.error);

                resultsDiv.innerHTML = data.fixtures.map(item => `
                    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                        <div>
                            <!-- UPDATED: Now shows Sport • League • Time -->
                            <div class="text-xs font-semibold text-slate-500 mb-2 uppercase">${sportText} • ${item.league} • ${item.time}</div>
                            <div class="font-bold text-slate-200 text-sm mb-4">${item.matchup}</div>
                        </div>
                        <div class="bg-slate-950 rounded-lg p-3 border border-slate-800">
                            <div class="text-xs text-slate-400 mb-1">Recommended Pick</div>
                            <div class="flex justify-between items-end">
                                <span class="text-cyan-400 font-bold">${item.pick}</span>
                                <span class="text-slate-200 font-semibold text-sm">Odds: ${item.odds}</span>
                            </div>
                        </div>
                        <p class="text-xs text-slate-400 mt-3 leading-relaxed">💡 ${item.analysis}</p>
                    </div>
                `).join('');
            } catch (err) {
                resultsDiv.innerHTML = `<div class="col-span-full text-center py-10 text-red-400">Error: ${err.message}</div>`;
            } finally {
                btn.disabled = false;
                btn.innerText = "Generate Standard Predictions";
            }
        }
