// pages/venues.js
export async function getStaticProps() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://directory.highlist.co';
  const resp = await fetch(`${base}/api/venues`);
  const json = await resp.json();
  return { props: { data: json }, revalidate: 86400 }; // rebuild daily
}

function App({ data }) {
  const items = data?.items || [];
  return (
    <main style={{ padding: 24 }}>
      <h1>THC Drink Venues</h1>
      {items.length === 0 && <p>No venues yet. Come back soon!</p>}
      {items.map(v => (
        <div key={v.id} style={{ margin: '12px 0', padding: 12, border: '1px solid #eee' }}>
          <strong>{v.venue || v.name}</strong>
          <div>{[v.city, v.state].filter(Boolean).join(', ')}</div>
          {v.brands && v.brands.length > 0 && <div>Brands: {v.brands}</div>}
          {v.url && <div><a href={v.url} target="_blank" rel="noreferrer">Menu</a></div>}
          {v.mentions_thc && <div style={{ color: 'green' }}>Mentions THC</div>}
        </div>
      ))}
    </main>
  );
}
