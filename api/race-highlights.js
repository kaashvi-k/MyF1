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

    You may describe drivers using general reputation, personality, or driving style (e.g. "known for aggressive overtakes," "a calm, consistent racer") since this kind of color doesn't go out of date.

    You must NOT state any specific factual or statistical claim about a driver's career or status unless it is explicitly given in the results above. This includes — but is not limited to — claims like: this is their first win ("maiden victory"), they are a rookie or in their debut season, their championship standing, their points total, how many races/wins/podiums they have had, or any other numbered or "first/youngest/only" type claim. Your knowledge of these specific facts may be outdated or wrong. If you are not certain a factual claim is supported by the results given above, do not make it.

    Write a short, engaging 3-4 sentence recap of THIS race only: who won, notable battles, surprises, or DNFs. Use driver personality/style for color where it fits, but do not invent or assume any specific career facts, firsts, or statistics.`;


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