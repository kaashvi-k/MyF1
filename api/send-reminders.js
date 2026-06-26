import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

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
const messaging = getMessaging();

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const meetingsRes = await fetch('https://api.openf1.org/v1/meetings?year=2026');
    const meetings = await meetingsRes.json();

    const upcoming = meetings
      .filter(m => new Date(m.date_start) > new Date())
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    const nextRace = upcoming[0];
    if (!nextRace) {
      return res.status(200).json({ message: 'No upcoming race found.' });
    }

    const daysUntil = (new Date(nextRace.date_start) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysUntil > 3) {
      return res.status(200).json({ message: `Next race is ${Math.round(daysUntil)} days away, skipping.` });
    }

    const usersSnap = await db.collection('users').get();
    const tokens = [];

    usersSnap.forEach(docSnap => {
      const data = docSnap.data();
      const hasFollows = (data.followedDrivers?.length || 0) > 0 || (data.followedTeams?.length || 0) > 0;
      if (hasFollows && data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return res.status(200).json({ message: 'No tokens to notify.' });
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: 'Upcoming F1 Race',
        body: `${nextRace.meeting_name} is on ${nextRace.date_start.slice(0, 10)} — don't miss it!`,
      },
    });

    return res.status(200).json({
      message: 'Reminders sent',
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (err) {
    console.error('Reminder job failed:', err);
    return res.status(500).json({ error: err.message });
  }
}