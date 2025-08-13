if (req.query && req.query.debug === 'env') {
  return res.status(200).json({
    MONDAY_API_KEY_present: !!process.env.MONDAY_API_KEY,
    MONDAY_BOARD_ID: process.env.MONDAY_BOARD_ID || null,
    MONDAY_GROUP_ID: process.env.MONDAY_GROUP_ID || null,
    MONDAY_COLUMN_MAP_parsed: (() => {
      try {
        const parsed = JSON.parse(process.env.MONDAY_COLUMN_MAP || "{}");
        return Object.keys(parsed);
      } catch {
        return "INVALID_JSON";
      }
    })()
  });
}
// api/scrape.js (CommonJS)
const cheerio = require('cheerio');
if (req.query && req.query.debug === 'env') {
  return res.status(200).json({
    MONDAY_API_KEY_present: !!process.env.MONDAY_API_KEY,
    MONDAY_BOARD_ID: process.env.MONDAY_BOARD_ID || null,
    MONDAY_GROUP_ID: process.env.MONDAY_GROUP_ID || null,
    MONDAY_COLUMN_MAP_parsed: (() => {
      try {
        const parsed = JSON.parse(process.env.MONDAY_COLUMN_MAP || "{}");
        return Object.keys(parsed);
      } catch {
        return "INVALID_JSON";
      }
    })()
  });
}
// 1) Start with a small, clean source list. Add more after it works.
const sources = [
  // BB's Tex-Orleans locations
  { url: 'https://bbstexorleans.com/montrose-menu/', type: 'menu', venue: "BB's Tex-Orleans - Montrose", city: 'Houston', state: 'TX' },
  { url: 'https://bbstexorleans.com/katy-menu/voodoo-bar/', type: 'menu', venue: "BB's Tex-Orleans - Katy (Voodoo Bar)", city: 'Katy', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Briargrove", city: 'Houston', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Cypress", city: 'Cypress', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Energy Corridor", city: 'Houston', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Heights", city: 'Houston', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Upper Kirby", city: 'Houston', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Pearland", city: 'Pearland', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Oak Forest", city: 'Houston', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Kingwood", city: 'Kingwood', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Tomball", city: 'Houston', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - Webster", city: 'Webster', state: 'TX' },
  { url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - San Antonio (Alamo Ranch)", city: 'San Antonio', state: 'TX' }
];

async function fetchText(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HighlistBot/1.0; +https://directory.highlist.co)',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    cache: 'no-store',
    redirect: 'follow'
  });
  const html = await resp.text();
  return { status: resp.status, html, finalUrl: resp.url };
}

module.exports = async (req, res) => {
  try {
    const results = [];

    for (const src of sources) {
      try {
        const { status, html, finalUrl } = await fetchText(src.url);
        const $ = cheerio.load(html);
        const text = $('body').text().toLowerCase();

        const mentionsTHC = /\bthc\b/.test(text);

        // capture brand keywords (extend as needed)
        const brandsRegex = /(pamos|nowadays|8th\s*wonder|cann|wynn|flyers|drink\s*wink|wunder|kiss|cycling\s*frog|hiyo|otto|delta\s*9|thc\s*seltzer)/gi;
        const brandMatches = Array.from(new Set((text.match(brandsRegex) || []).map(s => s.trim().toLowerCase())));
        const hasBrands = brandMatches.length > 0;

        results.push({
          ...src,
          status,
          finalUrl,
          mentionsTHC,
          hasBrands,
          brands: brandMatches
        });
      } catch (e) {
        results.push({ ...src, error: String(e) });
      }
    }

    res.status(200).json({ ok: true, scanned: results.length, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};
