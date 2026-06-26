import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();

export default async function handler(req, res) {
  const { season, round } = req.query;
  if (!season || !round) {
    return res.status(400).json({ error: 'Missing season or round' });
  }

  const cacheKey = `results-${season}-${round}`;
  const cacheRef = db.collection('cache').doc(cacheKey);

  // Completed race results never change — if we've cached this race before, just return it.
  try {
    const cached = await cacheRef.get();
    if (cached.exists) {
      return res.status(200).json({ results: cached.data().results, source: 'cache' });
    }
  } catch (err) {
    console.error('Cache read failed:', err);
  }

  try {
    const response = await fetch(`https://api.jolpi.ca/ergast/f1/${season}/${round}/results.json`);
    if (!response.ok) throw new Error('Jolpica request failed');
    const data = await response.json();
    const races = data.MRData.RaceTable.Races;

    if (races.length === 0 || !races[0].Results) {
      return res.status(200).json({ results: [], source: 'live' });
    }

    const results = races[0].Results;
    await cacheRef.set({ results, cachedAt: new Date().toISOString() });

    return res.status(200).json({ results, source: 'live' });
  } catch (err) {
    console.error('Results fetch failed:', err);
    return res.status(503).json({ error: 'Results temporarily unavailable' });
  }
}