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

async function sendToTokens(tokens, title, body) {
  if (tokens.length === 0) return { successCount: 0, failureCount: 0 };
  const response = await messaging.sendEachForMulticast({ tokens, notification: { title, body } });
  return { successCount: response.successCount, failureCount: response.failureCount };
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch 2026 calendar
    const calRes = await fetch('https://api.jolpi.ca/ergast/f1/2026.json');
    const calData = await calRes.json();
    const races = calData.MRData.RaceTable.Races;
    const now = new Date();
    const report = [];

    // --- NOTIFICATION TYPE 1: Upcoming race reminder ---
    const upcomingRace = races
      .filter(r => new Date(r.date) > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    if (upcomingRace) {
      const daysUntil = (new Date(upcomingRace.date) - now) / (1000 * 60 * 60 * 24);
      if (daysUntil <= 3) {
        const usersSnap = await db.collection('users').get();
        const tokens = [];
        usersSnap.forEach(docSnap => {
          const data = docSnap.data();
          const hasFollows = (data.followedDrivers?.length || 0) > 0 || (data.followedTeams?.length || 0) > 0;
          if (hasFollows && data.fcmToken) tokens.push(data.fcmToken);
        });
        const result = await sendToTokens(
          tokens,
          'Upcoming F1 Race 🏁',
          `${upcomingRace.raceName} is on ${upcomingRace.date} — don't miss it!`
        );
        report.push({ type: 'upcoming', race: upcomingRace.raceName, ...result });
      }
    }

    // --- NOTIFICATION TYPES 2 & 3: Driver/team finish results ---
    const recentRace = races
      .filter(r => new Date(r.date) < now)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (recentRace) {
      const raceId = `${recentRace.season}-${recentRace.round}`;
      const sentRef = db.collection('notifications').doc(raceId);
      const sentSnap = await sentRef.get();

      if (!sentSnap.exists || !sentSnap.data().resultsSent) {
        // Fetch results for this race
        const resultsRes = await fetch(
          `https://api.jolpi.ca/ergast/f1/${recentRace.season}/${recentRace.round}/results.json`
        );
        const resultsData = await resultsRes.json();
        const raceResults = resultsData.MRData.RaceTable.Races[0]?.Results || [];

        if (raceResults.length > 0) {
          // Build lookup maps from results
          const driverResults = {}; // driverNumber -> { name, team, position }
          const teamResults = {};   // teamName -> [{ name, position }]

          raceResults.forEach(r => {
            const num = parseInt(r.Driver.permanentNumber);
            const name = `${r.Driver.givenName} ${r.Driver.familyName}`;
            const team = r.Constructor.name;
            const position = r.position;

            driverResults[num] = { name, team, position };

            if (!teamResults[team]) teamResults[team] = [];
            teamResults[team].push({ name, position });
          });

          // Load all users and send personalized notifications
          const usersSnap = await db.collection('users').get();
          const driverNotifs = [];
          const teamNotifs = [];

          usersSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.fcmToken) return;

            // Driver notifications
            (data.followedDrivers || []).forEach(driverNum => {
              const result = driverResults[driverNum];
              if (result) {
                driverNotifs.push({
                  token: data.fcmToken,
                  title: `${recentRace.raceName} Results`,
                  body: `${result.name} finished P${result.position} for ${result.team}`,
                });
              }
            });

            // Team notifications
            (data.followedTeams || []).forEach(teamName => {
              const drivers = teamResults[teamName];
              if (drivers && drivers.length > 0) {
                const sorted = [...drivers].sort((a, b) => parseInt(a.position) - parseInt(b.position));
                const positions = sorted.map(d => `${d.name} P${d.position}`).join(', ');
                teamNotifs.push({
                  token: data.fcmToken,
                  title: `${recentRace.raceName} — ${teamName}`,
                  body: positions,
                });
              }
            });
          });

          // Send driver notifications
          if (driverNotifs.length > 0) {
            const driverSendRes = await messaging.sendEach(
              driverNotifs.map(n => ({
                token: n.token,
                notification: { title: n.title, body: n.body },
              }))
            );
            report.push({ type: 'driver_results', sent: driverNotifs.length, success: driverSendRes.successCount });
          }

          // Send team notifications
          if (teamNotifs.length > 0) {
            const teamSendRes = await messaging.sendEach(
              teamNotifs.map(n => ({
                token: n.token,
                notification: { title: n.title, body: n.body },
              }))
            );
            report.push({ type: 'team_results', sent: teamNotifs.length, success: teamSendRes.successCount });
          }

          // Mark results as sent so we don't re-notify tomorrow
          await sentRef.set({
            resultsSent: true,
            race: recentRace.raceName,
            sentAt: new Date().toISOString(),
          });
        }
      } else {
        report.push({ type: 'results_already_sent', race: recentRace.raceName });
      }
    }

    return res.status(200).json({ message: 'Cron complete', report });
  } catch (err) {
    console.error('Reminder job failed:', err);
    return res.status(500).json({ error: err.message });
  }
}