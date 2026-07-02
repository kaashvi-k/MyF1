export default async function handler(req, res) {
  const { driverId } = req.query;

  try {
    const testRes = await fetch(
      `https://api.jolpi.ca/ergast/f1/drivers/${driverId}/results.json?limit=1`
    );
    const text = await testRes.text();
    return res.status(200).json({ raw: text.slice(0, 200), status: testRes.status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}