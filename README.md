# MyF1

A full-stack Formula 1 statistics and tracking platform built with React, Firebase, and Vercel. Live at [my-f1-mu.vercel.app](https://my-f1-mu.vercel.app)

---

## Features

- **Race Calendar** — Full 2026 F1 season schedule with circuit and location details
- **Race Results** — Detailed finishing order with DNF/DSQ/DNS/NC classification for every completed race
- **Driver & Constructor Standings** — Live championship standings with subtab navigation
- **Driver Cards** — Career stats (wins, races, titles) with team-color-coded number avatars for all 22 drivers
- **Follow System** — Per-user driver and team follow preferences, persisted across sessions
- **Push Notifications** — Browser push alerts for upcoming races and personalized post-race driver/team finish results
- **AI Race Chatbot** — Multi-turn conversational AI powered by Gemini, grounded in live race data with hallucination constraints, accessible via a persistent floating widget

---

## Architecture
Browser (React + Vite)
│
▼
Vercel Serverless Functions (6 endpoints)
│                    │
▼                    ▼
Jolpica F1 API      Firestore Cache
(schedule, results, (calendar, results,
standings, stats)   standings, user data)
│
▼
Firebase Auth    Firebase FCM    Gemini AI API
(Google Sign-In) (push notifs)  (race chatbot)


All external API traffic is proxied through the serverless layer — the browser never calls a third-party API directly. Firestore acts as a fallback cache for schedule and results data, ensuring availability even if the upstream data provider is temporarily unreachable.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router |
| Styling | Custom pixel theme (Press Start 2P, VT323) |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Backend | Vercel Serverless Functions (Node.js) |
| Scheduled Jobs | Vercel Cron (daily @ 08:00 UTC) |
| F1 Data | Jolpica F1 API (Ergast-compatible) |
| AI | Google Gemini 2.5 Flash |
| Hosting | Vercel |

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/calendar` | 2026 race schedule with Firestore fallback cache |
| `GET /api/results` | Race results by season/round, permanently cached on first fetch |
| `GET /api/standings` | Current driver and constructor championship standings |
| `GET /api/driver-stats` | Career wins, races, and titles per driver |
| `POST /api/race-highlights` | Multi-turn Gemini AI conversation grounded in race result data |
| `GET /api/send-reminders` | Cron-triggered: sends personalized push notifications to followers |

---

## Key Engineering Decisions

**Backend-for-frontend caching layer**
The Jolpica F1 API is a volunteer-run community service with no uptime guarantee. Rather than calling it directly from the browser, all data fetches go through owned serverless functions that write results to Firestore on success. On failure, the function returns the last cached value — the frontend never knows the upstream was unavailable. Race results are cached permanently since historical data never changes, while the calendar is refreshed on every call.

**Atomic Firestore operations for follow state**
User follow preferences use `arrayUnion` and `arrayRemove` rather than read-modify-write patterns. This prevents race conditions if a user clicks follow/unfollow rapidly across multiple tabs — the server applies the operation atomically rather than overwriting the full array.

**Stateless multi-turn AI context**
Vercel serverless functions have no memory between invocations. The full conversation history is sent with every request from the client, and the backend reconstructs context from scratch each time before calling Gemini. This keeps the backend stateless and horizontally scalable while preserving the appearance of a continuous conversation in the UI.

**Hallucination grounding for sports commentary**
LLMs have training cutoffs and frequently confuse current-season standings with historical data. The Gemini system instruction explicitly prohibits claiming any "first win," "rookie," championship standing, or career count unless that data appears in the race results payload sent with the request. This prevents the model from confidently stating outdated facts (e.g., calling a driver the reigning champion when they are not).

**Foreground and background push notification handling**
Firebase Cloud Messaging splits into two distinct code paths: a service worker (`firebase-messaging-sw.js`) handles notifications when the tab is closed or backgrounded, while an `onMessage` listener in the React app handles them when the tab is focused. Both paths are required — neither handles the other's case.

---

## Project Structure
myf1/
├── api/                        # Vercel serverless functions
│   ├── calendar.js
│   ├── results.js
│   ├── standings.js
│   ├── driver-stats.js
│   ├── race-highlights.js
│   └── send-reminders.js
├── public/
│   └── firebase-messaging-sw.js  # FCM background handler
├── src/
│   ├── components/
│   │   ├── Nav.jsx
│   │   ├── ChatWidget.jsx
│   │   └── DriverCard.jsx
│   ├── pages/
│   │   ├── CalendarPage.jsx
│   │   ├── DriversPage.jsx
│   │   ├── TeamsPage.jsx
│   │   └── StandingsPage.jsx
│   ├── App.jsx                 # Root component, auth + chat state
│   ├── firebase.js             # Firebase SDK initialisation
│   ├── drivers.js              # 2026 driver/team roster + team colors
│   └── pixel.css               # Global pixel theme tokens
├── vercel.json                 # Cron schedule + SPA rewrite rules
└── README.md

---

## Local Development

```bash
git clone https://github.com/kaashvi-k/MyF1
cd MyF1
npm install
npm run dev
```

> **Note:** The AI chatbot and push notification features require the Vercel serverless functions and will not work on `localhost`. Deploy to Vercel and test on the live URL for those features.

### Environment Variables (Vercel)

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK private key |
| `CRON_SECRET` | Authorization token for the cron endpoint |

---

## Limitations & Future Work

- **No TypeScript** — migrating to TypeScript would improve type safety across the API response handling, which currently relies on optional chaining for unknown shapes
- **No automated tests** — unit tests for `formatStatus`, result sorting logic, and date comparison helpers would add meaningful coverage
- **No CI pipeline** — GitHub Actions build + test check on every push would catch the class of deployment failures encountered during development
- **Driver stats not cached** — career statistics are fetched from Jolpica on every Drivers page load; Firestore caching would reduce load on the volunteer-run API
- **Single cron job limit** — Vercel Hobby plan allows one scheduled job, so race reminders and result notifications are combined into one daily function; a Pro plan would allow separate, more precisely timed triggers
- **Email notifications not yet implemented** — planned as a Resend-powered post-race summary email consolidating all followed driver/team results

---

## Data Sources

- **[Jolpica F1 API](https://api.jolpi.ca)** — Community-maintained Ergast-compatible F1 data API. Free, no authentication required. Please use responsibly — it is volunteer-run with no SLA.
- **[Google Gemini API](https://ai.google.dev)** — Used on the free tier (Gemini 2.5 Flash). Prompt/response data may be used by Google to improve their models on the free tier.
- **[Firebase](https://firebase.google.com)** — Auth and Firestore on the Spark (free) plan. FCM is free with no message limits.

---

*Built by [Kaashvi](https://github.com/kaashvi-k) — Feb 2026*