import { useEffect, useState } from 'react';
import { driverByNumber, DRIVERS_2026, TEAMS_2026 } from './drivers';
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

  // NEW: calendar now comes from our own backend (which sources from Jolpica,
  // with Firestore caching as a fallback) instead of fetching OpenF1 directly.
  useEffect(() => {
    fetch('/api/calendar')
      .then(res => res.json())
      .then(data => setRaces(data.races || []))
      .catch(() => setError('Calendar temporarily unavailable.'))
      .finally(() => setLoading(false));
  }, []);

  // --- Below: results/highlights logic, unchanged for now, not yet wired
  // into the UI since it still expects OpenF1's data shape (meeting_key,
  // driver_number). We're updating this in the next step. ---

  function statusRank(r) {
    if (r.position) return 0;
    if (r.dnf) return 1;
    if (r.dsq) return 2;
    if (r.dns) return 3;
    return 4;
  }

  async function viewResults(meetingKey) {
    setLoadingResults(meetingKey);
    try {
      const sessionsRes = await fetch(
        `https://api.openf1.org/v1/sessions?meeting_key=${meetingKey}&session_name=Race`
      );
      const sessions = sessionsRes.ok ? await sessionsRes.json() : [];

      if (!Array.isArray(sessions) || sessions.length === 0) {
        setResults(prev => ({ ...prev, [meetingKey]: 'unavailable' }));
        return;
      }

      const sessionKey = sessions[0].session_key;
      const resultsRes = await fetch(
        `https://api.openf1.org/v1/session_result?session_key=${sessionKey}`
      );
      const raceResults = resultsRes.ok ? await resultsRes.json() : [];

      if (!Array.isArray(raceResults) || raceResults.length === 0) {
        setResults(prev => ({ ...prev, [meetingKey]: 'unavailable' }));
        return;
      }

      raceResults.sort((a, b) => {
        const rankDiff = statusRank(a) - statusRank(b);
        if (rankDiff !== 0) return rankDiff;
        return (a.position ?? 0) - (b.position ?? 0);
      });

      setResults(prev => ({ ...prev, [meetingKey]: raceResults }));
    } catch (err) {
      console.error('Failed to fetch results:', err);
      setResults(prev => ({ ...prev, [meetingKey]: 'unavailable' }));
    } finally {
      setLoadingResults(null);
    }
  }

  async function getHighlights(meeting) {
    const raceResults = results[meeting.meeting_key];
    if (!Array.isArray(raceResults)) return;

    setHighlights(prev => ({ ...prev, [meeting.meeting_key]: 'loading' }));

    const formattedResults = raceResults.map(r => {
      const driver = driverByNumber[r.driver_number];
      return {
        position: r.position,
        driverName: driver ? driver.name : `Driver #${r.driver_number}`,
        team: driver ? driver.team : 'Unknown',
        status: r.position ? `${r.points ?? 0} pts`
          : r.dnf ? 'DNF' : r.dsq ? 'DSQ' : r.dns ? 'DNS' : 'NC',
      };
    });

    try {
      const res = await fetch('/api/race-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceName: meeting.meeting_name,
          raceDate: meeting.date_start?.slice(0, 10),
          results: formattedResults,
        }),
      });
      const data = await res.json();
      setHighlights(prev => ({
        ...prev,
        [meeting.meeting_key]: data.summary || 'Failed to load highlights.',
      }));
    } catch (err) {
      console.error('Failed to get highlights:', err);
      setHighlights(prev => ({ ...prev, [meeting.meeting_key]: 'Failed to load highlights.' }));
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
            {/* Results/highlights button intentionally removed for this step —
                coming back in the next message once viewResults is updated
                for Jolpica's data shape. */}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;