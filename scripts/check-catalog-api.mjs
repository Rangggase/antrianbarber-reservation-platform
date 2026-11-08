// Jalankan: node scripts/check-catalog-api.mjs
// Smoke test jaringan ke FastAPI + respons CORS; tidak melakukan perubahan data.
const base = process.env.API_URL || 'http://127.0.0.1:8000';
const origin = 'http://localhost:5173';
let failed = false;
for (const [route, keys] of [
  ['/api/v1/services', ['id', 'code', 'name', 'description', 'duration_minutes', 'price_idr']],
  ['/api/v1/barbers', ['id', 'code', 'full_name', 'specialty', 'bio']],
]) {
  try {
    const res = await fetch(new URL(route, base), { headers: { Origin: origin, Accept: 'application/json' } });
    const data = await res.json();
    const cors = res.headers.get('access-control-allow-origin');
    const shapeOK = Array.isArray(data) && data.every(item => keys.every(k => Object.hasOwn(item, k)));
    const ok = res.status === 200 && shapeOK && cors === origin;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${route} — HTTP ${res.status}; rows=${Array.isArray(data) ? data.length : '?'}; CORS=${cors ?? '(missing)'}; schema=${shapeOK}`);
    if (!ok) failed = true;
  } catch (err) {
    console.error(`FAIL ${route} — ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
