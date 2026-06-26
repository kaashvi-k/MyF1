export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { raceName, raceDate, results } = req.body;
  if (!raceName || !results) {
    return res.status(400).json({ error: 'Missing race data' });
  }

  const resultsSummary = results
    .slice(0, 10)
    .map(r => `P${r.position ?? '–'}: ${r.driverName} (${r.team}) — ${r.status}`)
    .join('\n');

  const prompt = `You are summarizing the highlights of a Formula 1 race for fans who missed it.

    Race: ${raceName} on ${raceDate}
    Results:
    ${resultsSummary}

    You may draw on general, well-established background about each driver's career — past championships, reputation, driving style, rivalries — to add color and context.

    However, you must NOT make any claims about this CURRENT season's standings, point totals, or championship status (who is leading the championship, who currently holds the title, anyone's points total this year) unless that exact information appears in the results above. Your knowledge of the current season may be outdated, so rely only on the race data provided for anything specific to this season.

    Write a short, engaging 3-4 sentence recap of THIS race only: who won, notable battles, surprises, or DNFs. Use driver background for color where it fits naturally, but ground the actual storyline entirely in this race's results above.`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('Unexpected Gemini response:', JSON.stringify(data));
      return res.status(500).json({ error: 'No summary generated' });
    }

    return res.status(200).json({ summary: text });
  } catch (err) {
    console.error('Gemini request failed:', err);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
}