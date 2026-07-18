import { describe, it, expect } from 'vitest';


function formatStatus(r) {
  const points = parseFloat(r.points);
  if (points > 0) return `${r.points} pts`;
  const classifiedPattern = /^(Finished|\+\d+\s?Laps?|Lapped)$/i;
  if (classifiedPattern.test(r.status)) return `${r.points} pts`;
  if (/disqualified/i.test(r.status)) return 'DSQ';
  if (/did not start|withdrew/i.test(r.status)) return 'DNS';
  return r.status;
}

// ---- statusRank ----
function statusRank(r) {
  if (r.position) return 0;
  if (r.dnf) return 1;
  if (r.dsq) return 2;
  if (r.dns) return 3;
  return 4;
}

// ---- isPast ----
function isPast(dateStr) {
  return new Date(dateStr) < new Date();
}

// =====================================
// formatStatus tests
// =====================================
describe('formatStatus', () => {
  it('shows points for a driver who scored', () => {
    expect(formatStatus({ points: '25', status: 'Finished' })).toBe('25 pts');
  });

  it('shows 0 pts for a classified driver with no points', () => {
    expect(formatStatus({ points: '0', status: 'Finished' })).toBe('0 pts');
  });

  it('shows 0 pts for a lapped driver', () => {
    expect(formatStatus({ points: '0', status: '+1 Lap' })).toBe('0 pts');
  });

  it('shows 0 pts for Lapped status', () => {
    expect(formatStatus({ points: '0', status: 'Lapped' })).toBe('0 pts');
  });

  it('shows DSQ for a disqualified driver', () => {
    expect(formatStatus({ points: '0', status: 'Disqualified' })).toBe('DSQ');
  });

  it('shows DNS for a driver who did not start', () => {
    expect(formatStatus({ points: '0', status: 'Did not start' })).toBe('DNS');
  });

  it('shows DNS for withdrew', () => {
    expect(formatStatus({ points: '0', status: 'Withdrew' })).toBe('DNS');
  });

  it('shows raw status for a retirement reason', () => {
    expect(formatStatus({ points: '0', status: 'Engine' })).toBe('Engine');
  });

  it('shows raw status for a collision', () => {
    expect(formatStatus({ points: '0', status: 'Collision' })).toBe('Collision');
  });

  it('handles fractional points (fastest lap bonus)', () => {
    expect(formatStatus({ points: '1', status: 'Finished' })).toBe('1 pts');
  });
});

// =====================================
// statusRank tests
// =====================================
describe('statusRank', () => {
  it('ranks a classified finisher as 0', () => {
    expect(statusRank({ position: 1, dnf: false, dsq: false, dns: false })).toBe(0);
  });

  it('ranks a DNF as 1', () => {
    expect(statusRank({ position: null, dnf: true, dsq: false, dns: false })).toBe(1);
  });

  it('ranks a DSQ as 2', () => {
    expect(statusRank({ position: null, dnf: false, dsq: true, dns: false })).toBe(2);
  });

  it('ranks a DNS as 3', () => {
    expect(statusRank({ position: null, dnf: false, dsq: false, dns: true })).toBe(3);
  });

  it('ranks NC (not classified) as 4', () => {
    expect(statusRank({ position: null, dnf: false, dsq: false, dns: false })).toBe(4);
  });

  it('finisher always ranks lower than DNF', () => {
    const finisher = { position: 20, dnf: false, dsq: false, dns: false };
    const dnf = { position: null, dnf: true, dsq: false, dns: false };
    expect(statusRank(finisher)).toBeLessThan(statusRank(dnf));
  });
});

// =====================================
// isPast tests
// =====================================
describe('isPast', () => {
  it('returns true for a past date', () => {
    expect(isPast('2020-01-01')).toBe(true);
  });

  it('returns false for a future date', () => {
    expect(isPast('2099-12-31')).toBe(false);
  });

  it('returns true for a race that happened earlier this year', () => {
    expect(isPast('2026-03-06')).toBe(true); // Australian GP
  });
});

// =====================================
// Result sorting integration test
// =====================================
describe('result sorting', () => {
  it('sorts finishers before DNFs', () => {
    const results = [
      { position: null, dnf: true, dsq: false, dns: false },
      { position: 1, dnf: false, dsq: false, dns: false },
    ];
    results.sort((a, b) => {
      const rankDiff = statusRank(a) - statusRank(b);
      if (rankDiff !== 0) return rankDiff;
      return (a.position ?? 0) - (b.position ?? 0);
    });
    expect(results[0].position).toBe(1);
  });

  it('sorts P1 before P2', () => {
    const results = [
      { position: 2, dnf: false, dsq: false, dns: false },
      { position: 1, dnf: false, dsq: false, dns: false },
    ];
    results.sort((a, b) => {
      const rankDiff = statusRank(a) - statusRank(b);
      if (rankDiff !== 0) return rankDiff;
      return (a.position ?? 0) - (b.position ?? 0);
    });
    expect(results[0].position).toBe(1);
  });

  it('keeps two DNFs stable relative to each other', () => {
    const results = [
      { position: null, dnf: true, dsq: false, dns: false, driver: 'A' },
      { position: null, dnf: true, dsq: false, dns: false, driver: 'B' },
    ];
    results.sort((a, b) => {
      const rankDiff = statusRank(a) - statusRank(b);
      if (rankDiff !== 0) return rankDiff;
      return (a.position ?? 0) - (b.position ?? 0);
    });
    expect(results[0].driver).toBe('A');
  });

  it('sorts DSQ after DNF', () => {
    const results = [
      { position: null, dnf: false, dsq: true, dns: false },
      { position: null, dnf: true, dsq: false, dns: false },
    ];
    results.sort((a, b) => statusRank(a) - statusRank(b));
    expect(results[0].dnf).toBe(true);
    expect(results[1].dsq).toBe(true);
  });
});