export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { raceName, raceDate, results, messages } = req.body;
  if (!raceName || !results || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing race data or messages' });
  }

  const resultsSummary = results
  .map(r => {
    let line = `P${r.position ?? '–'}: ${r.driverName} (${r.team}) — ${r.status}, started P${r.grid}, completed ${r.laps} laps`;
    if (r.fastestLap?.rank === '1') {
      line += `, set the FASTEST LAP of the race (${r.fastestLap.time})`;
    }
    return line;
  })
  .join('\n');

  const systemInstruction = {
    parts: [{
      text: `You are discussing the highlights of a Formula 1 race with a fan who missed it.

Race: ${raceName} on ${raceDate}
Results:
${resultsSummary}

You may describe drivers using general reputation, personality, or driving style (e.g. "known for aggressive overtakes," "a calm, consistent racer") since this kind of color doesn't go out of date.

You must NOT state any specific factual or statistical claim about a driver's career or status unless it is explicitly given in the results above. This includes claims like: this is their first win ("maiden victory"), they are a rookie or in their debut season, their championship standing, their points total, race/win/podium counts, or any "first/youngest/only" type claim. Your knowledge of these specific facts may be outdated or wrong.

When asked for a summary, write a short, engaging 3-4 sentence recap of THIS race only. For follow-up questions, answer naturally and conversationally, staying grounded in the results above and these same rules.`
    }]
  };

  const contents = messages.map(m => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({ systemInstruction, contents }),
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('Unexpected Gemini response:', JSON.stringify(data));
      return res.status(500).json({ error: 'No response generated' });
    }

    return res.status(200).json({ reply: text });
  } catch (err) {
    console.error('Gemini request failed:', err);
    return res.status(500).json({ error: 'Failed to generate response' });
  }
}