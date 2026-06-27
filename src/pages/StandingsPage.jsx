import { useEffect, useState } from 'react';

function StandingsPage() {
  const [driverStandings, setDriverStandings] = useState([]);
  const [constructorStandings, setConstructorStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/standings')
      .then(res => res.json())
      .then(data => {
        setDriverStandings(data.driverStandings || []);
        setConstructorStandings(data.constructorStandings || []);
      })
      .catch(() => setError('Standings temporarily unavailable.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading standings...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>;

  return (
    <div>
      <h2 style={{ fontSize: '1rem' }}>DRIVER STANDINGS</h2>
      <div className="pixel-card">
        {driverStandings.length === 0 && <p style={{ color: 'var(--muted)' }}>No standings yet this season.</p>}
        {driverStandings.map(d => (
          <div key={d.Driver.driverId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>P{d.position} — {d.Driver.givenName} {d.Driver.familyName} ({d.Constructors[0]?.name})</span>
            <span style={{ color: 'var(--green)' }}>{d.points} pts</span>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1rem', marginTop: '2rem' }}>CONSTRUCTOR STANDINGS</h2>
      <div className="pixel-card">
        {constructorStandings.length === 0 && <p style={{ color: 'var(--muted)' }}>No standings yet this season.</p>}
        {constructorStandings.map(c => (
          <div key={c.Constructor.constructorId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>P{c.position} — {c.Constructor.name}</span>
            <span style={{ color: 'var(--green)' }}>{c.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StandingsPage;