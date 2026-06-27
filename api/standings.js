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
  try {
    const [driversRes, constructorsRes] = await Promise.all([
      fetch('https://api.jolpi.ca/ergast/f1/2026/driverStandings.json'),
      fetch('https://api.jolpi.ca/ergast/f1/2026/constructorStandings.json'),
    ]);

    if (!driversRes.ok || !constructorsRes.ok) throw new Error('Jolpica request failed');

    const driversData = await driversRes.json();
    const constructorsData = await constructorsRes.json();

    const driverStandings = driversData.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
    const constructorStandings = constructorsData.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];

    await db.collection('cache').doc('standings-2026').set({
      driverStandings,
      constructorStandings,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({ driverStandings, constructorStandings, source: 'live' });
  } catch (err) {
    console.error('Live standings fetch failed, falling back to cache:', err);
    try {
      const cached = await db.collection('cache').doc('standings-2026').get();
      if (cached.exists) {
        const data = cached.data();
        return res.status(200).json({
          driverStandings: data.driverStandings,
          constructorStandings: data.constructorStandings,
          source: 'cache',
        });
      }
    } catch (cacheErr) {
      console.error('Cache fallback also failed:', cacheErr);
    }
    return res.status(503).json({ error: 'Standings temporarily unavailable' });
  }
}