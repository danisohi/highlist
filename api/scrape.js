// api/scrape.js (CommonJS)
const cheerio = require('cheerio');

const sources = [
  //const sources = [
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
{ url: 'https://bbstexorleans.com/our-menu/', type: 'menu', venue: "BB's Tex-Orleans - San Antonio (Alamo Ranch)", city: 'San Antonio', state: 'TX' },
]; Add real URLs here
  { url: 'https://bbstexorleans.com/katy-menu/voodoo-bar/', type: 'menu', venue: 'Katy Voodoo Bar', city: 'San Antonio', state: 'TX' }
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
