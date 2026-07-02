import { TEAM_COLORS } from '../drivers';

function DriverCard({ driver, isFollowing, onToggleFollow, stats, statsLoading }) {
  const teamColor = TEAM_COLORS[driver.team] || 'var(--muted)';

  return (
    <div className="pixel-card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

      {/* Avatar — styled number square in team color */}
      <div style={{
        width: '64px',
        height: '64px',
        minWidth: '64px',
        background: teamColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid var(--white)',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: driver.number > 99 ? '0.7rem' : '1rem',
        color: '#fff',
        textShadow: '1px 1px 0 #000',
        flexShrink: 0,
      }}>
        {driver.number}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '1rem', marginBottom: '2px' }}>{driver.name}</div>
        <div style={{ color: teamColor, fontSize: '0.85rem', marginBottom: '6px' }}>{driver.team}</div>

        {statsLoading ? (
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading stats...</div>
        ) : stats ? (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            <span><span style={{ color: 'var(--amber)' }}>{stats.wins}</span> WINS</span>
            <span><span style={{ color: 'var(--amber)' }}>{stats.races}</span> RACES</span>
            <span><span style={{ color: 'var(--amber)' }}>{stats.championships}</span> 🏆</span>
          </div>
        ) : null}
      </div>

      {/* Follow button */}
      <button
        className="pixel-btn"
        style={{ flexShrink: 0 }}
        onClick={() => onToggleFollow(driver.number)}
      >
        {isFollowing ? 'UNFOLLOW' : 'FOLLOW'}
      </button>
    </div>
  );
}

export default DriverCard;