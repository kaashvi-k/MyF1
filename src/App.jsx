import { useEffect, useState } from 'react';
import { DRIVERS_2026, TEAMS_2026 } from './drivers';
import { auth, googleProvider, db, messaging } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';

const VAPID_KEY = 'BFnkYtDMzOQFz05eMPEVVbiTlMBOaiFkfMNKVY4CKPAqAyQHoCxT-IdPjN8fA2QwhnKV00H0CWJ81wHNVVj6xxQ';

function App() {
  const [races, setRaces] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({});
  const [loadingResults, setLoadingResults] = useState(null);
  const [user, setUser] = useState(null);
  const [followedDrivers, setFollowedDrivers] = useState([]);
  const [followedTeams, setFollowedTeams] = useState([]);
  const [highlights, setHighlights] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setFollowedDrivers([]);
      setFollowedTeams([]);
      return;
    }
    const userDocRef = doc(db, 'users', user.uid);
    getDoc(userDocRef)
      .then(snap => {
        const data = snap.exists() ? snap.data() : {};
        setFollowedDrivers(data.followedDrivers || []);
        setFollowedTeams(data.followedTeams || []);
      })
      .catch(err => console.error('Failed to load follows:', err));
  }, [user]);

  useEffect(() => {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      new Notification(payload.notification.title, {
        body: payload.notification.body,
      });
    });
    return unsubscribe;
  }, []);

  function handleSignIn() {
    signInWithPopup(auth, googleProvider).catch(err => console.error('Sign-in failed:', err));
  }

  function handleSignOut() {
    signOut(auth).catch(err => console.error('Sign-out failed:', err));
  }

  async function toggleFollowDriver(driverNumber) {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const isFollowing = followedDrivers.includes(driverNumber);
    try {
      await setDoc(userDocRef, {
        followedDrivers: isFollowing ? arrayRemove(driverNumber) : arrayUnion(driverNumber)
      }, { merge: true });
      setFollowedDrivers(prev =>
        isFollowing ? prev.filter(n => n !== driverNumber) : [...prev, driverNumber]
      );
    } catch (err) {
      console.error('Failed to update follow:', err);
    }
  }

  async function toggleFollowTeam(teamName) {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const isFollowing = followedTeams.includes(teamName);
    try {
      await setDoc(userDocRef, {
        followedTeams: isFollowing ? arrayRemove(teamName) : arrayUnion(teamName)
      }, { merge: true });
      setFollowedTeams(prev =>
        isFollowing ? prev.filter(t => t !== teamName) : [...prev, teamName]
      );
    } catch (err) {
      console.error('Failed to update follow:', err);
    }
  }

  async function enableNotifications() {
    if (!user) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission denied.');
        return;
      }
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const registration = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
      if (token) {
        await setDoc(doc(db, 'users', user.uid), { fcmToken: token }, { merge: true });
        alert('Notifications enabled!');
      }
    } catch (err) {
      console.error('Failed to enable notifications:', err);
    }
  }

  useEffect(() => {
    fetch('/api/calendar')
      .then(res => res.json())
      .then(data => setRaces(data.races || []))
      .catch(() => setError('Calendar temporarily unavailable.'))
      .finally(() => setLoading(false));
  }, []);

  // NEW: results now come from our own cached backend (Jolpica-sourced).
  // Jolpica gives full driver/constructor names and plain-English status
  // text directly, so no more number-lookups or DNF/DSQ/DNS categorizing.
  async function viewResults(season, round) {
    setLoadingResults(round);
    try {
      const res = await fetch(`/api/results?season=${season}&round=${round}`);
      const data = await res.json();

      if (!res.ok || !Array.isArray(data.results) || data.results.length === 0) {
        setResults(prev => ({ ...prev, [round]: 'unavailable' }));
        return;
      }

      setResults(prev => ({ ...prev, [round]: data.results }));
    } catch (err) {
      console.error('Failed to fetch results:', err);
      setResults(prev => ({ ...prev, [round]: 'unavailable' }));
    } finally {
      setLoadingResults(null);
    }
  }

  // "Finished" and "+1 Lap"/"+2 Laps" etc. mean classified with points;
  // anything else (Retired, Accident, Disqualified...) is Jolpica's own
  // plain-English explanation, so we just show it directly.
  function formatStatus(r) {
      const points = parseFloat(r.points);
      if (points > 0) return `${r.points} pts`;

      // Genuinely classified with zero points (finished outside scoring positions)
      const classifiedPattern = /^(Finished|\+\d+\s?Laps?|Lapped)$/i;
      if (classifiedPattern.test(r.status)) return `${r.points} pts`;

      // Anything else (Retired, Accident, Disqualified, etc.) — show the real reason
      return r.status;
    }

  async function getHighlights(race) {
    const raceResults = results[race.round];
    if (!Array.isArray(raceResults)) return;

    setHighlights(prev => ({ ...prev, [race.round]: 'loading' }));

    const formattedResults = raceResults.map(r => ({
      position: r.position,
      driverName: `${r.Driver.givenName} ${r.Driver.familyName}`,
      team: r.Constructor.name,
      status: formatStatus(r),
    }));

    try {
      const res = await fetch('/api/race-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceName: race.raceName,
          raceDate: race.date,
          results: formattedResults,
        }),
      });
      const data = await res.json();
      setHighlights(prev => ({
        ...prev,
        [race.round]: data.summary || 'Failed to load highlights.',
      }));
    } catch (err) {
      console.error('Failed to get highlights:', err);
      setHighlights(prev => ({ ...prev, [race.round]: 'Failed to load highlights.' }));
    }
  }

  const isPast = (dateStr) => new Date(dateStr) < new Date();

  return (
    <div>
      <h1>2026 F1 Calendar</h1>

      <div style={{ marginBottom: '1rem' }}>
        {user ? (
          <>
            <span>Signed in as {user.displayName}</span>{' '}
            <button onClick={handleSignOut}>Sign Out</button>
          </>
        ) : (
          <button onClick={handleSignIn}>Sign In with Google</button>
        )}
      </div>

      {user ? (
        <div style={{ marginBottom: '2rem' }}>
          <h2>Follow Drivers</h2>
          <ul>
            {DRIVERS_2026.map(d => (
              <li key={d.number}>
                {d.name} ({d.team}){' '}
                <button onClick={() => toggleFollowDriver(d.number)}>
                  {followedDrivers.includes(d.number) ? 'Unfollow' : 'Follow'}
                </button>
              </li>
            ))}
          </ul>

          <h2>Follow Teams</h2>
          <ul>
            {TEAMS_2026.map(team => (
              <li key={team}>
                {team}{' '}
                <button onClick={() => toggleFollowTeam(team)}>
                  {followedTeams.includes(team) ? 'Unfollow' : 'Follow'}
                </button>
              </li>
            ))}
          </ul>

          <button onClick={enableNotifications}>Enable Push Notifications</button>
        </div>
      ) : (
        <p>Sign in to follow drivers and teams.</p>
      )}

      {loading && <p>Loading races...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <ul>
        {races.map(race => (
          <li key={race.round} style={{ marginBottom: '1rem' }}>
            {race.raceName} — {race.Circuit.Location.locality}, {race.Circuit.Location.country} — {race.date}

            {isPast(race.date) && (
              <>
                {' '}
                <button onClick={() => viewResults(race.season, race.round)}>
                  {loadingResults === race.round ? 'Loading...' : 'View Results'}
                </button>

                {results[race.round] === 'unavailable' && (
                  <p style={{ color: 'gray' }}>Results not available for this race.</p>
                )}

                {Array.isArray(results[race.round]) && (
                  <>
                    <ol>
                      {results[race.round].map(r => (
                        <li key={r.Driver.driverId}>
                          P{r.position} — {r.Driver.givenName} {r.Driver.familyName} ({r.Constructor.name}) — {formatStatus(r)}
                        </li>
                      ))}
                    </ol>
                    <button onClick={() => getHighlights(race)}>
                      {highlights[race.round] === 'loading' ? 'Generating...' : 'Get AI Highlights'}
                    </button>
                    {highlights[race.round] && highlights[race.round] !== 'loading' && (
                      <p style={{ fontStyle: 'italic', marginTop: '0.5rem' }}>{highlights[race.round]}</p>
                    )}
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;