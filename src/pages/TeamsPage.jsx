import { TEAMS_2026 } from '../drivers';

function TeamsPage({ user, followedTeams, toggleFollowTeam }) {
  if (!user) {
    return <p>Sign in to view teams and follow your favorites.</p>;
  }

  return (
    <div>
      <h2 style={{ fontSize: '1rem' }}>TEAMS</h2>
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

export default TeamsPage;