export default async function handler(req, res) {
  const { driverId } = req.query;
  if (!driverId) return res.status(400).json({ error: 'Missing driverId' });

  const CHAMPIONSHIPS = {
    norris: 1, piastri: 0, max_verstappen: 4, hadjar: 0,
    lawson: 0, lindblad: 0, leclerc: 0, hamilton: 7,
    russell: 0, antonelli: 0, alonso: 2, stroll: 0,
    gasly: 0, colapinto: 0, ocon: 0, bearman: 0,
    hulkenberg: 0, bortoleto: 0, albon: 0, sainz: 0,
    perez: 0, bottas: 0,
  };

  try {
    const [winsRes, racesRes] = await Promise.all([
      fetch(`https://api.jolpi.ca/ergast/f1/drivers/${driverId}/results/1.json?limit=1`),
      fetch(`https://api.jolpi.ca/ergast/f1/drivers/${driverId}/results.json?limit=1`),
    ]);

    async function safeJson(r) {
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || !ct.includes('application/json')) return null;
      try { return await r.json(); } catch { return null; }
    }

    const [winsData, racesData] = await Promise.all([
      safeJson(winsRes),
      safeJson(racesRes),
    ]);

    const stats = {
      wins: parseInt(winsData?.MRData?.total) || 0,
      races: parseInt(racesData?.MRData?.total) || 0,
      championships: CHAMPIONSHIPS[driverId] ?? 0,
    };

    return res.status(200).json({ ...stats, source: 'live' });
  } catch (err) {
    console.error('Stats fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}