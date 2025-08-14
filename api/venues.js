// pages/api/venues.js (CommonJS)
module.exports = async (req, res) => {
  const MONDAY_TOKEN = process.env.MONDAY_API_KEY;
  const MONDAY_BOARD_ID = Number(process.env.MONDAY_BOARD_ID || 0);

  // Same column map you set in Vercel
  let COLS = {};
  try { COLS = JSON.parse(process.env.MONDAY_COLUMN_MAP || "{}"); } catch {}

  if (!MONDAY_TOKEN || !MONDAY_BOARD_ID || !Object.keys(COLS).length) {
    return res.status(200).json({ ok: false, error: 'Missing Monday envs', items: [] });
  }

  // Minimal GraphQL query to fetch items + column values
  const query = `
    query($board: [Int]) {
      boards(ids: $board) {
        items_page(limit: 100) {
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `;

  try {
    const resp = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Authorization': MONDAY_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { board: MONDAY_BOARD_ID } })
    });
    const data = await resp.json();
    const items = data?.data?.boards?.[0]?.items_page?.items || [];

    // Helper to read a column by our map key
    const getVal = (cols, mappedId, asBool = false) => {
      const cv = cols.find(c => c.id === mappedId);
      if (!cv) return asBool ? false : '';
      if (asBool) return (cv.text || '').toLowerCase() === 'true';
      return cv.text || '';
    };

    const normalized = items.map(it => {
      const cvs = it.column_values || [];
      return {
        id: it.id,
        name: it.name,
        url: getVal(cvs, COLS.url),
        venue: getVal(cvs, COLS.venue),
        city: getVal(cvs, COLS.city),
        state: getVal(cvs, COLS.state),
        status_code: getVal(cvs, COLS.status_code),
        final_url: getVal(cvs, COLS.final_url),
        mentions_thc: getVal(cvs, COLS.mentions_thc, true),
        has_brands: getVal(cvs, COLS.has_brands, true),
        brands: getVal(cvs, COLS.brands),
        last_checked: getVal(cvs, COLS.last_checked),
        source_type: getVal(cvs, COLS.source_type),
        notes: getVal(cvs, COLS.notes)
      };
    });

    res.status(200).json({ ok: true, count: normalized.length, items: normalized });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e), items: [] });
  }
};
