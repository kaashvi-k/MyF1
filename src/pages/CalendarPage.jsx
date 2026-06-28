import { useEffect, useState } from 'react';

function CalendarPage({ onOpenHighlights }) {
  const [races, setRaces] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({});
  const [loadingResults, setLoadingResults] = useState(null);

  useEffect(() => {
    fetch('/api/calendar')
      .then(res => res.json())
      .then(data => setRaces(data.races || []))
      .catch(() => setError('Calendar temporarily unavailable.'))
      .finally(() => setLoading(false));
  }, []);

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

  function formatStatus(r) {
    const points = parseFloat(r.points);
    if (points > 0) return `${r.points} pts`;
    const classifiedPattern = /^(Finished|\+\d+\s?Laps?|Lapped)$/i;
    if (classifiedPattern.test(r.status)) return `${r.points} pts`;
    if (/disqualified/i.test(r.status)) return 'DSQ';
    if (/did not start|withdrew/i.test(r.status)) return 'DNS';
    return r.status;
  }

  function handleGetHighlights(race) {
  console.log('DEBUG: handleGetHighlights called', race.round);
  const raceResults = results[race.round];
  console.log('DEBUG: raceResults is array?', Array.isArray(raceResults));
  if (!Array.isArray(raceResults)) return;
  const formattedResults = raceResults.map(r => ({
    position: r.position,
    driverName: `${r.Driver.givenName} ${r.Driver.familyName}`,
    team: r.Constructor.name,
    status: formatStatus(r),
  }));
  console.log('DEBUG: calling onOpenHighlights', typeof onOpenHighlights);
  onOpenHighlights(race, formattedResults);
}
  const isPast = (dateStr) => new Date(dateStr) < new Date();

  return (
    <div>
      {loading && <p>Loading races...</p>}
      {error && <p style={{ color: 'var(--red)' }}>{error}</p>}

      {races.map(race => (
        <div key={race.round} className="pixel-card">
          <div style={{ fontSize: '1.1rem' }}>{race.raceName}</div>
          <div style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>
            {race.Circuit.Location.locality}, {race.Circuit.Location.country} — {race.date}
          </div>

          {isPast(race.date) && (
            <>
              <button className="pixel-btn" onClick={() => viewResults(race.season, race.round)}>
                {loadingResults === race.round ? 'LOADING...' : 'VIEW RESULTS'}
              </button>

              {results[race.round] === 'unavailable' && (
                <p style={{ color: 'var(--muted)' }}>Results not available for this race.</p>
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
                  <button className="pixel-btn" onClick={() => handleGetHighlights(race)}>
                    GET AI HIGHLIGHTS
                  </button>
                </>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default CalendarPage;