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
    const response = await fetch('https://api.jolpi.ca/ergast/f1/2026.json');
    if (!response.ok) throw new Error('Jolpica request failed');
    const data = await response.json();
    const races = data.MRData.RaceTable.Races;

    await db.collection('cache').doc('calendar-2026').set({
      races,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({ races, source: 'live' });
  } catch (err) {
    console.error('Live calendar fetch failed, falling back to cache:', err);
    try {
      const cached = await db.collection('cache').doc('calendar-2026').get();
      if (cached.exists) {
        return res.status(200).json({ races: cached.data().races, source: 'cache' });
      }
    } catch (cacheErr) {
      console.error('Cache fallback also failed:', cacheErr);
    }
    return res.status(503).json({ error: 'Calendar temporarily unavailable' });
  }
}