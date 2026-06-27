import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'CALENDAR', end: true },
  { to: '/drivers', label: 'DRIVERS' },
  { to: '/teams', label: 'TEAMS' },
  { to: '/standings', label: 'STANDINGS' },
];

function Nav() {
  return (
    <nav style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
      {links.map(link => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          style={({ isActive }) => ({
            color: isActive ? 'var(--amber)' : 'var(--muted)',
            fontSize: '1.1rem',
            textDecoration: 'none',
          })}
        >
          {({ isActive }) => (isActive ? '\u25B8 ' : '') + link.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default Nav;