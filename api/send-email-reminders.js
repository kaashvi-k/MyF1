import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';

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
const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Most recently completed race
    const recentRace = races
      .filter(r => new Date(r.date) < now)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!recentRace) {
      return res.status(200).json({ message: 'No completed race yet.' });
    }

    // Prevent duplicate emails
    const raceId = `${recentRace.season}-${recentRace.round}`;
    const emailRef = db.collection('notifications').doc(`email-${raceId}`);
    const emailSnap = await emailRef.get();

    if (emailSnap.exists && emailSnap.data()?.emailsSent) {
      return res.status(200).json({ message: 'Emails already sent for this race.' });
    }

    // Fetch race results
    const resultsRes = await fetch(
      `https://api.jolpi.ca/ergast/f1/${recentRace.season}/${recentRace.round}/results.json`
    );
    const resultsData = await resultsRes.json();
    const raceResults = resultsData.MRData.RaceTable.Races[0]?.Results || [];

    if (raceResults.length === 0) {
      return res.status(200).json({ message: 'Race results unavailable yet.' });
    }

    // Build lookup maps
    const driverResults = {};
    const teamResults = {};

    raceResults.forEach(r => {
      const num = parseInt(r.Driver.permanentNumber);
      const name = `${r.Driver.givenName} ${r.Driver.familyName}`;
      const team = r.Constructor.name;
      const position = r.position;
      const status = r.status;

      driverResults[num] = { name, team, position, status };

      if (!teamResults[team]) teamResults[team] = [];
      teamResults[team].push({ name, position, status });
    });

    const winner = raceResults[0];
    const winnerName = `${winner.Driver.givenName} ${winner.Driver.familyName}`;
    const winnerTeam = winner.Constructor.name;

    // Load all users from Firestore
    const usersSnap = await db.collection('users').get();
    let emailsSent = 0;

    for (const userDoc of usersSnap.docs) {
      const user = userDoc.data();

      if (!user.email) continue;

      const followedDrivers = user.followedDrivers || [];
      const followedTeams = user.followedTeams || [];

      if (followedDrivers.length === 0 && followedTeams.length === 0) continue;

      // Build driver section
      let driverRows = '';
      followedDrivers.forEach(num => {
        const result = driverResults[num];
        if (!result) return;
        const pos = result.position ? `P${result.position}` : result.status;
        driverRows += `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #1a1a2e;">
              <span style="color:#F5F5F0;">${result.name}</span>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #1a1a2e;color:#75757f;">
              ${result.team}
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #1a1a2e;text-align:right;">
              <span style="color:#39FF6A;font-weight:bold;">${pos}</span>
            </td>
          </tr>`;
      });

      // Build team section
      let teamRows = '';
      followedTeams.forEach(team => {
        const drivers = teamResults[team];
        if (!drivers) return;
        const sorted = [...drivers].sort((a, b) => parseInt(a.position) - parseInt(b.position));
        sorted.forEach((d, i) => {
          const pos = d.position ? `P${d.position}` : d.status;
          teamRows += `
            <tr>
              <td style="padding:10px 8px;border-bottom:1px solid #1a1a2e;">
                <span style="color:#F5F5F0;">${d.name}</span>
              </td>
              <td style="padding:10px 8px;border-bottom:1px solid #1a1a2e;color:#75757f;">
                ${i === 0 ? team : ''}
              </td>
              <td style="padding:10px 8px;border-bottom:1px solid #1a1a2e;text-align:right;">
                <span style="color:#39FF6A;font-weight:bold;">${pos}</span>
              </td>
            </tr>`;
        });
      });

      if (!driverRows && !teamRows) continue;

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D14;font-family:monospace;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">

  <!-- Header -->
  <div style="margin-bottom:24px;">
    <h1 style="margin:0 0 4px;color:#E10600;font-size:20px;letter-spacing:2px;">MYF1</h1>
    <div style="height:6px;background:repeating-linear-gradient(90deg,#0D0D14 0 10px,#F5F5F0 10px 20px);margin-bottom:16px;"></div>
    <h2 style="margin:0 0 4px;color:#F5F5F0;font-size:16px;">${recentRace.raceName}</h2>
    <p style="margin:0;color:#75757f;font-size:13px;">
      ${recentRace.Circuit.Location.locality}, ${recentRace.Circuit.Location.country} &mdash; ${recentRace.date}
    </p>
  </div>

  <!-- Winner banner -->
  <div style="background:#15151f;border-left:3px solid #FFB800;padding:14px 16px;margin-bottom:24px;">
    <p style="margin:0;color:#FFB800;font-size:11px;letter-spacing:1px;margin-bottom:4px;">RACE WINNER</p>
    <p style="margin:0;color:#F5F5F0;font-size:15px;">
      <strong>${winnerName}</strong>
      <span style="color:#75757f;font-size:13px;"> &mdash; ${winnerTeam}</span>
    </p>
  </div>

  ${driverRows ? `
  <!-- Followed Drivers -->
  <p style="margin:0 0 8px;color:#FFB800;font-size:11px;letter-spacing:1px;">YOUR DRIVERS</p>
  <table style="width:100%;border-collapse:collapse;background:#15151f;margin-bottom:24px;">
    <thead>
      <tr style="color:#75757f;font-size:11px;letter-spacing:1px;">
        <th style="padding:8px;text-align:left;font-weight:normal;">DRIVER</th>
        <th style="padding:8px;text-align:left;font-weight:normal;">TEAM</th>
        <th style="padding:8px;text-align:right;font-weight:normal;">RESULT</th>
      </tr>
    </thead>
    <tbody>${driverRows}</tbody>
  </table>` : ''}

  ${teamRows ? `
  <!-- Followed Teams -->
  <p style="margin:0 0 8px;color:#FFB800;font-size:11px;letter-spacing:1px;">YOUR TEAMS</p>
  <table style="width:100%;border-collapse:collapse;background:#15151f;margin-bottom:24px;">
    <thead>
      <tr style="color:#75757f;font-size:11px;letter-spacing:1px;">
        <th style="padding:8px;text-align:left;font-weight:normal;">DRIVER</th>
        <th style="padding:8px;text-align:left;font-weight:normal;">TEAM</th>
        <th style="padding:8px;text-align:right;font-weight:normal;">RESULT</th>
      </tr>
    </thead>
    <tbody>${teamRows}</tbody>
  </table>` : ''}

  <!-- CTA -->
  <div style="height:6px;background:repeating-linear-gradient(90deg,#0D0D14 0 10px,#F5F5F0 10px 20px);margin-bottom:20px;"></div>
  <a href="https://my-f1-mu.vercel.app"
     style="display:inline-block;background:#E10600;color:#fff;padding:12px 24px;text-decoration:none;font-size:13px;letter-spacing:1px;">
    VIEW FULL RESULTS →
  </a>

  <!-- Footer -->
  <p style="margin-top:24px;color:#75757f;font-size:11px;">
    You're receiving this because you follow drivers or teams on MYF1.
  </p>

</div>
</body>
</html>`;

      await resend.emails.send({
        from: 'MYF1 <onboarding@resend.dev>',
        to: [user.email],
        subject: `🏁 ${recentRace.raceName} — Your Race Recap`,
        html,
      });

      emailsSent++;
    }

    // Mark race as emailed
    await emailRef.set({
      emailsSent: true,
      race: recentRace.raceName,
      sentAt: new Date().toISOString(),
      recipients: emailsSent,
    });

    return res.status(200).json({
      success: true,
      race: recentRace.raceName,
      winner: winnerName,
      emailsSent,
    });

  } catch (err) {
    console.error('Email job failed:', err);
    return res.status(500).json({ error: err.message });
  }
}