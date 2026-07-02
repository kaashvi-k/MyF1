try {
  const [winsRes, racesRes, champsRes] = await Promise.all([
    fetch(`https://api.jolpi.ca/ergast/f1/drivers/${driverId}/results/1.json?limit=1`),
    fetch(`https://api.jolpi.ca/ergast/f1/drivers/${driverId}/results.json?limit=1`),
    fetch(`https://api.jolpi.ca/ergast/f1/drivers/${driverId}/driverStandings/1.json?limit=100`),
  ]);

  async function safeJson(res) {
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) return null;
    try { return await res.json(); } catch { return null; }
  }

  const [winsData, racesData, champsData] = await Promise.all([
    safeJson(winsRes),
    safeJson(racesRes),
    safeJson(champsRes),
  ]);

  const stats = {
    wins: parseInt(winsData?.MRData?.total) || 0,
    races: parseInt(racesData?.MRData?.total) || 0,
    championships: champsData?.MRData?.StandingsTable?.StandingsLists?.length || 0,
  };

  await cacheRef.set({ ...stats, cachedAt: new Date().toISOString() });
  return res.status(200).json({ ...stats, source: 'live' });
} catch (err) {
  console.error('Stats fetch failed:', err);
  return res.status(500).json({ error: 'Failed to fetch stats' });
}