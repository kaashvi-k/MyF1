import { useEffect, useState } from 'react';
import { driverByNumber } from './drivers';

function App() {
  const [races, setRaces] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({});       // { meetingKey: [resultRows] }
  const [loadingResults, setLoadingResults] = useState(null); // which meeting is currently fetching

  useEffect(() => {
    fetch('https://api.openf1.org/v1/meetings?year=2026')
      .then(res => res.json())
      .then(data => setRaces(data.filter(m => !m.meeting_name.toLowerCase().includes('testing'))))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
          if (a.position == null) return 1;   // no position (DNF) → push to the end
          if (b.position == null) return -1;
          return a.position - b.position;
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

                {results[meeting.meeting_key] && (
                    results[meeting.meeting_key] === 'unavailable' ? (
                      <p style={{ color: 'gray' }}>Results not available for this race.</p>
                    ) : (
                      <ol>
                        {results[meeting.meeting_key].map(r => {
                          const driver = driverByNumber[r.driver_number];
                          return (
                            <li key={r.driver_number}>
                              P{r.position ?? '–'} — {driver ? `${driver.name} (${driver.team})` : `Driver #${r.driver_number}`}
                              {' — '}
                              {r.dnf ? 'DNF' : `${r.points ?? 0} pts`}
                            </li>
                          );
                        })}
                      </ol>
                    )
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