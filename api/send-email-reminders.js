import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Resend } from "resend";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  try {
    // -----------------------------
    // Fetch 2026 calendar
    // -----------------------------
    const calRes = await fetch(
      "https://api.jolpi.ca/ergast/f1/2026.json"
    );

    const calData = await calRes.json();

    const races = calData.MRData.RaceTable.Races;

    const now = new Date();

    // Most recently completed race
    const recentRace = races
      .filter((race) => new Date(race.date) < now)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!recentRace) {
      return res.status(200).json({
        message: "No completed race yet.",
      });
    }

    // -----------------------------
    // Prevent duplicate emails
    // -----------------------------
    const raceId = `${recentRace.season}-${recentRace.round}`;

    const emailRef = db.collection("notifications").doc(`email-${raceId}`);

    const emailSnap = await emailRef.get();

    if (emailSnap.exists && emailSnap.data()?.emailsSent) {
      return res.status(200).json({
        message: "Emails already sent.",
      });
    }

    // -----------------------------
    // Download race results
    // -----------------------------
    const resultsRes = await fetch(
      `https://api.jolpi.ca/ergast/f1/${recentRace.season}/${recentRace.round}/results.json`
    );

    const resultsData = await resultsRes.json();

    const raceResults =
      resultsData.MRData.RaceTable.Races[0]?.Results || [];

    if (raceResults.length === 0) {
      return res.status(200).json({
        message: "Race results unavailable.",
      });
    }

    // -----------------------------
    // Build lookup maps
    // -----------------------------
    const driverResults = {};
    const teamResults = {};

    raceResults.forEach((result) => {
      const driverNumber = parseInt(
        result.Driver.permanentNumber
      );

      const driverName =
        `${result.Driver.givenName} ${result.Driver.familyName}`;

      const team = result.Constructor.name;

      const position = result.position;

      driverResults[driverNumber] = {
        name: driverName,
        team,
        position,
      };

      if (!teamResults[team]) {
        teamResults[team] = [];
      }

      teamResults[team].push({
        name: driverName,
        position,
      });
    });

    const winner = raceResults[0];

    const winnerName =
      `${winner.Driver.givenName} ${winner.Driver.familyName}`;

    // -----------------------------
    // Load users
    // -----------------------------
    const usersSnap = await db.collection("users").get();

    let emailsSent = 0;
    // ----------------------------------
    // Send one consolidated email per user
    // ----------------------------------

    for (const userDoc of usersSnap.docs) {

      const user = userDoc.data();

      if (!user.email) continue;

      const followedDrivers = user.followedDrivers || [];
      const followedTeams = user.followedTeams || [];

      if (
        followedDrivers.length === 0 &&
        followedTeams.length === 0
      ) {
        continue;
      }

      let driverSection = "";

      if (followedDrivers.length > 0) {

        driverSection += `
          <h2 style="color:#E10600;margin-bottom:10px;">
            ⭐ Followed Drivers
          </h2>

          <table
            style="
              width:100%;
              border-collapse:collapse;
              margin-bottom:30px;
            "
          >
            <tr>
              <th align="left">Driver</th>
              <th align="left">Team</th>
              <th align="center">Finish</th>
            </tr>
        `;

        followedDrivers.forEach(driverNum => {

          const result = driverResults[driverNum];

          if (!result) return;

          driverSection += `
            <tr>
              <td style="padding:8px 0;">
                ${result.name}
              </td>

              <td>
                ${result.team}
              </td>

              <td align="center">
                P${result.position}
              </td>
            </tr>
          `;

        });

        driverSection += `
          </table>
        `;

      }

      let teamSection = "";

      if (followedTeams.length > 0) {

        teamSection += `
          <h2 style="color:#E10600;margin-bottom:10px;">
            🏎️ Followed Teams
          </h2>
        `;

        followedTeams.forEach(team => {

          const drivers = teamResults[team];

          if (!drivers) return;

          teamSection += `
            <div
              style="
                border:1px solid #ddd;
                padding:15px;
                margin-bottom:20px;
                border-radius:10px;
              "
            >

            <h3 style="margin-top:0;">
              ${team}
            </h3>

            <ul>
          `;

          drivers
            .sort((a, b) => Number(a.position) - Number(b.position))
            .forEach(driver => {

              teamSection += `
                <li>
                  ${driver.name} — P${driver.position}
                </li>
              `;

            });

          teamSection += `
              </ul>

            </div>
          `;

        });

      }

      const html = `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

</head>

<body
style="
font-family:Arial,sans-serif;
background:#f4f4f4;
padding:30px;
"
>

<div
style="
max-width:700px;
margin:auto;
background:white;
padding:35px;
border-radius:12px;
"
>

<h1
style="
color:#E10600;
text-align:center;
"
>
🏁 ${recentRace.raceName}
</h1>

<p>

Hi <strong>${user.displayName || "F1 Fan"}</strong>,

</p>

<p>

Here's your personalized race recap from
<strong>${recentRace.raceName}</strong>.

</p>

<p>

🥇 Winner:
<strong>${winnerName}</strong>

</p>

<hr>

${driverSection}

${teamSection}
<hr
style="
margin-top:40px;
margin-bottom:25px;
"
>

<p
style="
font-size:16px;
"
>
See the complete race results, standings and analytics on
<strong>ApexF1</strong>.
</p>

<p
style="
text-align:center;
margin-top:30px;
"
>

<a
href="https://my-f1-mu.vercel.app"
style="
background:#E10600;
color:white;
padding:14px 28px;
border-radius:8px;
text-decoration:none;
display:inline-block;
font-weight:bold;
"
>

Open ApexF1

</a>

</p>

<p
style="
margin-top:40px;
font-size:12px;
color:#777;
text-align:center;
"
>
You're receiving this email because you've enabled race recap emails in ApexF1.
</p>

</div>

</body>

</html>
`;

      await resend.emails.send({
        from: "ApexF1 <onboarding@resend.dev>",
        to: user.email,
        subject: `🏁 ${recentRace.raceName} Results`,
        html,
      });

      emailsSent++;
    }

    // -----------------------------
    // Mark this race as emailed
    // -----------------------------
    await emailRef.set({
      emailsSent: true,
      race: recentRace.raceName,
      sentAt: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      race: recentRace.raceName,
      winner: winnerName,
      emailsSent,
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: err.message,
    });

  }

}