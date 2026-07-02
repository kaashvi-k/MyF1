import { useState, useEffect } from 'react';
import { DRIVERS_2026 } from '../drivers';
import DriverCard from '../components/DriverCard';

// Maps driver number to Jolpica driverId string
const DRIVER_ID_MAP = {
  1:  'norris',
  81: 'piastri',
  3:  'max_verstappen',
  6:  'hadjar',
  30: 'lawson',
  41: 'lindblad',
  16: 'leclerc',
  44: 'hamilton',
  63: 'russell',
  12: 'antonelli',
  14: 'alonso',
  18: 'stroll',
  10: 'gasly',
  43: 'colapinto',
  31: 'ocon',
  87: 'bearman',
  27: 'hulkenberg',
  5:  'bortoleto',
  23: 'albon',
  55: 'sainz',
  11: 'perez',
  77: 'bottas',
};

function DriversPage({ user, followedDrivers, toggleFollowDriver }) {
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState({});

  useEffect(() => {
    // Fetch stats for all drivers on mount, one at a time with a small delay
    // to be courteous to Jolpica's free volunteer-run servers
    async function fetchAllStats() {
      for (const driver of DRIVERS_2026) {
        const driverId = DRIVER_ID_MAP[driver.number];
        if (!driverId) continue;

        setLoadingStats(prev => ({ ...prev, [driver.number]: true }));
        try {
          const res = await fetch(`/api/driver-stats?driverId=${driverId}`);
          const data = await res.json();
          setStats(prev => ({ ...prev, [driver.number]: data }));
        } catch (err) {
          console.error(`Failed to fetch stats for ${driver.name}:`, err);
        } finally {
          setLoadingStats(prev => ({ ...prev, [driver.number]: false }));
        }

        // 200ms delay between requests — keeps us well within Jolpica's rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    fetchAllStats();
  }, []);

  if (!user) {
    return <p>Sign in to view drivers and follow your favorites.</p>;
  }

  return (
    <div>
      <h2 style={{ fontSize: '1rem' }}>DRIVERS</h2>
      {DRIVERS_2026.map(d => (
        <DriverCard
          key={d.number}
          driver={d}
          isFollowing={followedDrivers.includes(d.number)}
          onToggleFollow={toggleFollowDriver}
          stats={stats[d.number]}
          statsLoading={loadingStats[d.number]}
        />
      ))}
    </div>
  );
}

export default DriversPage;