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
  const { driverId } = req.query;
  if (!driverId) return res.status(400).json({ error: 'Missing driverId' });

  const cacheRef = db.collection('cache').doc(`driver-stats-${driverId}`);

  try {
    const cached = await cacheRef.get();
    if (cached.exists) {
      return res.status(200).json({ ...cached.data(), source: 'cache' });
    }
  } catch (err) {
    console.error('Cache read failed:', err);
  }

  try {
    const [winsRes, racesRes, champsRes] = await Promise.all([
      fetch(`https://api.jolpi.ca/ergast/f1/drivers/${driverId}/results/1.json?limit=1`),
      fetch(`https://api.jolpi.ca/ergast/f1/drivers/${driverId}/results.json?limit=1`),
      fetch(`https://api.jolpi.ca/ergast/f1/drivers/${driverId}/driverStandings/1.json?limit=100`),
    ]);

    const [winsData, racesData, champsData] = await Promise.all([
      winsRes.json(),
      racesRes.json(),
      champsRes.json(),
    ]);

    const stats = {
      wins: parseInt(winsData.MRData.total) || 0,
      races: parseInt(racesData.MRData.total) || 0,
      championships: champsData.MRData.StandingsTable?.StandingsLists?.length || 0,
    };

    await cacheRef.set({ ...stats, cachedAt: new Date().toISOString() });
    return res.status(200).json({ ...stats, source: 'live' });
  } catch (err) {
    console.error('Stats fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}