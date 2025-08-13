// api/scrape.js
const cheerio = require('cheerio');

// Simple source list (you can add more after it works)
const sources = [
  { url: 'https://bbstexorleans.com/montrose-menu/', type: 'menu', venue: "BB's Tex-Orleans - Montrose", city: 'Houston', state: 'TX' },
  { url: 'https://bbstexorleans.com/katy-menu/voodoo-bar/', type: 'menu', venue: "BB's Tex-Orleans - Katy (Voodoo Bar)", city: 'Katy', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Briargrove", city: 'Houston', state: 'TX' }
];

// Safe Monday setup (won’t crash if envs are missing or bad)
const MONDAY_TOKEN = process.env.MONDAY_API_KEY;
const MONDAY_BOARD_ID = Number(process.env.MONDAY_BOARD_ID || 0);
const MONDAY_GROUP_ID = process.env.MONDAY_GROUP_ID || "topics";
const COLS = (() => {
  try {
    return JSON.parse(process.env.MONDAY_COLUMN_MAP || "{}");
  } catch {
    return {};
  }
})();

async function mondayGraphQL(query, variables) {
  if (!MONDAY_TOKEN || !MONDAY_BOARD_ID || !Object.keys(COLS).length) return null;
  const resp = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Authorization": MONDAY_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables })
  });
  const data = await resp.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data;
}

function buildColumnValues(result) {
  const vals = {};
  if (COLS.url) vals[COLS.url] = { url: result.finalUrl || result.url, text: result.venue || result.url };
  if (COLS.venue) vals[COLS.venue] = result.venue || "";
  if (COLS.city) vals[COLS.city] = result.city || "";
  if (COLS.state) vals[COLS.state] = result.state || "";
  if (COLS.status_code) vals[COLS.status_code] = String(result.status || "");
  if (COLS.final_url) vals[COLS.final_url] = result.finalUrl || "";
  if (COLS.mentions_thc) vals[COLS.mentions_thc] = result.mentionsTHC ? "true" : "false";
  if (COLS.has_brands) vals[COLS.has_brands] = result.hasBrands ? "true" : "false";
  if (COLS.brands) vals[COLS.brands] = (result.brands || []).join(", ");
  if (COLS.last_checked) vals[COLS.last_checked] = { date: new Date().toISOString().slice(0,10) };
  if (COLS.source_type) vals[COLS.source_type] = { labels: [result.type || "menu"] };
  return vals;
}

async function upsertMondayItem(result) {
  if (!MONDAY_TOKEN || !MONDAY_BOARD_ID || !Object.keys(COLS).length) return null;

  const findQ = `
    query($board: Int!, $col: String!, $val: JSON!) {
      items_page_by_column_values(board_id: $board, columns: [{column_id: $col, column_values: [$val]}]) {
        items { id name }
      }
    }
  `;
  const linkVal = JSON.stringify({ url: result.url, text: result.venue || result.url });
  const found = await mondayGraphQL(findQ, { board: MONDAY_BOARD_ID, col: COLS.url, val: linkVal }).catch(() => null);
  const items = found?.items_page_by_column_values?.items || [];

  const valsJSON = JSON.stringify(buildColumnValues(result));

  if (items.length) {
    const updateQ = `
      mutation($board: Int!, $item: Int!, $vals: JSON!) {
        change_multiple_column_values(board_id: $board, item_id: $item, column_values: $vals) { id }
      }
    `;
    await mondayGraphQL(updateQ, { board: MONDAY_BOARD_ID, item: Number(items[0].id), vals: valsJSON });
    return items[0].id;
  }

  const createQ = `
    mutation($board: Int!, $group: String!, $name: String!, $vals: JSON!) {
      create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $vals) { id }
    }
  `;
  const created = await mondayGraphQL(createQ, {
    board: MONDAY_BOARD_ID,
    group: MONDAY_GROUP_ID,
    name: result.venue || result.url,
    vals: valsJSON
  });
  return created?.create_item?.id || null;
}

async function fetchText(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HighlistBot/1.0; +https://directory.highlist.co)',
      'Accept-Language': 'en-US,en;q=0.9'
    },
  });
  const html = await resp.text();
  return { status: resp.status, html, finalUrl: resp.url };
}

module.exports = async (req, res) => {
  // Debug: see envs without exposing secrets
  if (req.query && req.query.debug === 'env') {
    let parsedKeys;
    try {
      parsedKeys = Object.keys(JSON.parse(process.env.MONDAY_COLUMN_MAP || "{}"));
    } catch {
      parsedKeys = "INVALID_JSON";
    }
    return res.status(200).json({
      MONDAY_API_KEY_present: !!process.env.MONDAY_API_KEY,
      MONDAY_BOARD_ID: process.env.MONDAY_BOARD_ID || null,
      MONDAY_GROUP_ID: process.env.MONDAY_GROUP_ID || null,
      MONDAY_COLUMN_MAP_parsed: parsedKeys
    });
  }

  // Debug: run scraper but skip Monday completely
  const skipMonday = req.query && req.query.debug === 'plain';

  try {
    const results = [];

    for (const src of sources) {
      try {
        const { status, html, finalUrl } = await fetchText(src.url);
        const $ = cheerio.load(html);
        const text = $('body').text().toLowerCase();

        const mentionsTHC = /\bthc\b/.test(text);
        const brandsRegex = /(pamos|nowadays|8th\s*wonder|cann|wynn|flyers|drink\s*wink|wunder|kiss|cycling\s*frog|hiyo|otto|delta\s*9|thc\s*seltzer)/gi;
        const brandMatches = Array.from(new Set((text.match(brandsRegex) || []).map(s => s.trim().toLowerCase())));
        const hasBrands = brandMatches.length > 0;

        const result = { ...src, status, finalUrl, mentionsTHC, hasBrands, brands: brandMatches };
        results.push(result);

        if (!skipMonday) {
          try {
            await upsertMondayItem(result);
          } catch {
            // do not crash the whole function
          }
        }
      } catch (e) {
        results.push({ ...src, error: String(e) });
      }
    }

    res.status(200).json({ ok: true, scanned: results.length, results, monday_writes: skipMonday ? "skipped (debug=plain)" : "attempted" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};
