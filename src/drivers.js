export const DRIVERS_2026 = [
  { number: 1,  name: 'Lando Norris',      team: 'McLaren' },
  { number: 81, name: 'Oscar Piastri',     team: 'McLaren' },
  { number: 3,  name: 'Max Verstappen',    team: 'Red Bull Racing' },
  { number: 6,  name: 'Isack Hadjar',      team: 'Red Bull Racing' },
  { number: 30, name: 'Liam Lawson',       team: 'Racing Bulls' },
  { number: 41, name: 'Arvid Lindblad',    team: 'Racing Bulls' },
  { number: 16, name: 'Charles Leclerc',   team: 'Ferrari' },
  { number: 44, name: 'Lewis Hamilton',    team: 'Ferrari' },
  { number: 63, name: 'George Russell',    team: 'Mercedes' },
  { number: 12, name: 'Kimi Antonelli',    team: 'Mercedes' },
  { number: 14, name: 'Fernando Alonso',   team: 'Aston Martin' },
  { number: 18, name: 'Lance Stroll',      team: 'Aston Martin' },
  { number: 10, name: 'Pierre Gasly',      team: 'Alpine' },
  { number: 43, name: 'Franco Colapinto',  team: 'Alpine' },
  { number: 31, name: 'Esteban Ocon',      team: 'Haas' },
  { number: 87, name: 'Oliver Bearman',    team: 'Haas' },
  { number: 27, name: 'Nico Hülkenberg',   team: 'Audi' },
  { number: 5,  name: 'Gabriel Bortoleto', team: 'Audi' },
  { number: 23, name: 'Alex Albon',        team: 'Williams' },
  { number: 55, name: 'Carlos Sainz',      team: 'Williams' },
  { number: 11, name: 'Sergio Pérez',      team: 'Cadillac' },
  { number: 77, name: 'Valtteri Bottas',   team: 'Cadillac' },
];

export const DRIVER_CHAMPIONSHIPS = {
  'norris': 1,
  'piastri': 0,
  'max_verstappen': 4,
  'hadjar': 0,
  'lawson': 0,
  'lindblad': 0,
  'leclerc': 0,
  'hamilton': 7,
  'russell': 0,
  'antonelli': 0,
  'alonso': 2,
  'stroll': 0,
  'gasly': 0,
  'colapinto': 0,
  'ocon': 0,
  'bearman': 0,
  'hulkenberg': 0,
  'bortoleto': 0,
  'albon': 0,
  'sainz': 0,
  'perez': 0,
  'bottas': 0,
};

export const TEAM_COLORS = {
  'Red Bull Racing': '#3671C6',
  'McLaren': '#FF8000',
  'Ferrari': '#E8002D',
  'Mercedes': '#27F4D2',
  'Aston Martin': '#229971',
  'Alpine': '#FF87BC',
  'Racing Bulls': '#6692FF',
  'Haas': '#B6BABD',
  'Audi': '#282828',
  'Williams': '#64C4FF',
  'Cadillac': '#C92D4B',
};


export const driverByNumber = Object.fromEntries(
  DRIVERS_2026.map(d => [d.number, d])
);

export const TEAMS_2026 = [...new Set(DRIVERS_2026.map(d => d.team))];