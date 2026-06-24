import { useEffect, useState } from 'react';
import { driverByNumber, DRIVERS_2026, TEAMS_2026 } from './drivers';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

function App() {
  const [races, setRaces] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({});
  const [loadingResults, setLoadingResults] = useState(null);
  const [user, setUser] = useState(null);
  const [followedDrivers, setFollowedDrivers] = useState([]);
  const [followedTeams, setFollowedTeams] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  // Load this user's follows whenever they sign in (or clear them on sign-out)
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

  useEffect(() => {
    fetch('https://api.openf1.org/v1/meetings?year=2026')
      .then(res => res.json())
      .then(data => {
        const filtered = data.filter(
          m => !m.meeting_name.toLowerCase().includes('testing')
        );
        setRaces(filtered);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
        </div>
      ) : (
        <p>Sign in to follow drivers and teams.</p>
      )}

      {loading && <p>Loading races...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <ul>
        {races.map(meeting => (
          <li key={meeting.meeting_key} style={{ marginBottom: '1rem' }}>
            {meeting.meeting_name} — {meeting.location}, {meeting.country_name} — {meeting.date_start?.slice(0, 10)}

            {isPast(meeting.date_start) && (
              <>
                {' '}
                <button onClick={() => viewResults(meeting.meeting_key)}>
                  {loadingResults === meeting.meeting_key ? 'Loading...' : 'View Results'}
                </button>

                {results[meeting.meeting_key] === 'unavailable' && (
                  <p style={{ color: 'gray' }}>Results not available for this race.</p>
                )}

                {Array.isArray(results[meeting.meeting_key]) && (
                  <ol>
                    {results[meeting.meeting_key].map(r => {
                      const driver = driverByNumber[r.driver_number];
                      const label = driver ? `${driver.name} (${driver.team})` : `Driver #${r.driver_number}`;
                      const status = r.position ? `${r.points ?? 0} pts`
                        : r.dnf ? 'DNF'
                        : r.dsq ? 'DSQ'
                        : r.dns ? 'DNS'
                        : 'NC';

                      return (
                        <li key={r.driver_number}>
                          P{r.position ?? '–'} — {label} — {status}
                        </li>
                      );
                    })}
                  </ol>
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