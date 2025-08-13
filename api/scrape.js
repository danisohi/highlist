// api/scrape.js (CommonJS)
const cheerio = require('cheerio');

const sources = [
  // Add real URLs here
  { url: 'https://examplebar.com/menu', type: 'menu', venue: 'Example Bar', city: 'Austin', state: 'TX' }
];

async function fetchText(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HighlistBot/1.0; +https://directory.highlist.co)' }
  });
  const html = await resp.text();
  return { status: resp.status, html };
}

module.exports = async (req, res) => {
  try {
    const results = [];
    for (const src of sources) {
      try {
        const { status, html } = await fetchText(src.url);
        const $ = cheerio.load(html);
        const text = $('body').text().toLowerCase();

        const mentionsTHC = /\bthc\b/.test(text);
        const hasBrands = /(pamos|nowadays|8th\s*wonder|cann|wynn|flyers|drink\s*wink|wunder|kiss|cycling frog|hiyo|cycling\s*frog|otto|cbd\s*seltzer)/i.test(text);

        results.push({
          ...src,
          status,
          mentionsTHC,
          hasBrands,
          matchedUrl: src.url
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
