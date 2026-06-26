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

Write a short, engaging 3-4 sentence summary: who won, any notable battles, surprises, or DNFs. Keep it punchy, like a sports recap.`;

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