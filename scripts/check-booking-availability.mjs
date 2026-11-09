// Read-only smoke test for the REAL FastAPI service. Never creates a reservation.
const origin = process.env.API_URL ?? 'http://127.0.0.1:8000';
function dateJakarta(offset) {
  const date = new Date(Date.now() + offset * 86400_000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = key => parts.find(p => p.type === key)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const headers = { Accept: 'application/json', Origin: 'http://localhost:5173' };
async function get(path) {
  const res = await fetch(new URL(path, origin), { headers });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return { data: await res.json(), cors: res.headers.get('access-control-allow-origin') };
}
try {
  const [services, barbers] = await Promise.all([get('/api/v1/services'), get('/api/v1/barbers')]);
  if (!Array.isArray(services.data) || !services.data.length || !Array.isArray(barbers.data) || !barbers.data.length) {
    throw new Error('Catalog kosong — jalankan seed demo terlebih dahulu.');
  }
  let successes = 0;
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = dateJakarta(offset);
    const query = new URLSearchParams({
      barber_id: String(barbers.data[0].id),
      service_id: String(services.data[0].id), date,
    });
    const response = await get(`/api/v1/availability?${query}`);
    const d = response.data;
    if (d.date !== date || d.timezone !== 'Asia/Jakarta' || !Array.isArray(d.slots) ||
        d.barber_id !== barbers.data[0].id || d.service_id !== services.data[0].id) {
      throw new Error(`Respons availability tidak sesuai kontrak pada ${date}.`);
    }
    if (response.cors !== 'http://localhost:5173') throw new Error('CORS 5173 belum diizinkan.');
    console.log(`PASS ${date} availability: ${d.slots.length} slot WIB`);
    successes += 1;
  }
  console.log(`OK: ${successes}/7 respons availability valid; tidak ada reservasi yang dibuat.`);
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
