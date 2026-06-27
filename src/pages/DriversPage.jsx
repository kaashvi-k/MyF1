import { DRIVERS_2026, TEAMS_2026 } from '../drivers';

function DriversPage({ user, followedDrivers, followedTeams, toggleFollowDriver, toggleFollowTeam }) {
  if (!user) {
    return <p>Sign in to view drivers and follow your favorites.</p>;
  }

  return (
    <div>
      <h2 style={{ fontSize: '1rem' }}>DRIVERS</h2>
      {DRIVERS_2026.map(d => (
        <div key={d.number} className="pixel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>#{d.number} {d.name} — {d.team}</span>
          <button className="pixel-btn" onClick={() => toggleFollowDriver(d.number)}>
            {followedDrivers.includes(d.number) ? 'UNFOLLOW' : 'FOLLOW'}
          </button>
        </div>
      ))}

      <h2 style={{ fontSize: '1rem', marginTop: '2rem' }}>TEAMS</h2>
      {TEAMS_2026.map(team => (
        <div key={team} className="pixel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{team}</span>
          <button className="pixel-btn" onClick={() => toggleFollowTeam(team)}>
            {followedTeams.includes(team) ? 'UNFOLLOW' : 'FOLLOW'}
          </button>
        </div>
      ))}
    </div>
  );
}

export default DriversPage;