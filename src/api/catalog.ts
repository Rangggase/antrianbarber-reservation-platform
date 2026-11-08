import { useEffect, useState } from 'react';

/**
 * v2.3a: mode API hanya aktif di Vite dev. Production Vercel tetap demo.
 * Gunakan .env.development.local untuk pengaturan lokal (jangan berisi rahasia).
 */
export const useLiveCatalog = import.meta.env.DEV && import.meta.env.VITE_CATALOG_SOURCE === 'api';

export type ApiService = {
  id: number;
  code: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_idr: number;
};

export type ApiBarber = {
  id: number;
  code: string;
  full_name: string;
  specialty: string;
  bio: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isService(value: unknown): value is ApiService {
  return isRecord(value) &&
    typeof value.id === 'number' && Number.isInteger(value.id) && typeof value.code === 'string' && value.code.length > 0 &&
    typeof value.name === 'string' && typeof value.description === 'string' &&
    typeof value.duration_minutes === 'number' && Number.isFinite(value.duration_minutes) && value.duration_minutes > 0 &&
    typeof value.price_idr === 'number' && Number.isFinite(value.price_idr) && value.price_idr >= 0;
}

function isBarber(value: unknown): value is ApiBarber {
  return isRecord(value) &&
    typeof value.id === 'number' && Number.isInteger(value.id) && typeof value.code === 'string' && value.code.length > 0 &&
    typeof value.full_name === 'string' && typeof value.specialty === 'string' &&
    (value.bio === null || typeof value.bio === 'string');
}

type Resource = 'services' | 'barbers';
type CatalogMap = { services: ApiService; barbers: ApiBarber };
type CatalogState<T> =
  | { status: 'loading'; items: T[]; error: null }
  | { status: 'ready'; items: T[]; error: null }
  | { status: 'error'; items: T[]; error: string };

function getApiUrl(resource: Resource) {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (typeof base !== 'string' || base.trim() === '') {
    throw new Error('VITE_API_BASE_URL belum diatur dalam .env.development.local.');
  }
  let url: URL;
  try { url = new URL(base); }
  catch { throw new Error('VITE_API_BASE_URL bukan URL yang valid.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL API harus menggunakan HTTP atau HTTPS.');
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('URL API harus berupa origin, contoh http://127.0.0.1:8000.');
  return `${url.origin}/api/v1/${resource}`;
}

async function fetchCatalog<K extends Resource>(resource: K, signal: AbortSignal): Promise<CatalogMap[K][]> {
  const response = await fetch(getApiUrl(resource), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    signal,
  });
  if (!response.ok) throw new Error(`API ${resource} mengembalikan HTTP ${response.status}.`);
  const data: unknown = await response.json();
  const check = resource === 'services' ? isService : isBarber;
  if (!Array.isArray(data) || !data.every(check)) {
    throw new Error(`Format data ${resource} dari API tidak sesuai kontrak v2.2c.`);
  }
  return data as CatalogMap[K][];
}

export function useApiCatalog<K extends Resource>(resource: K) {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<CatalogState<CatalogMap[K]>>({ status: 'loading', items: [], error: null });

  useEffect(() => {
    if (!useLiveCatalog) return;
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading', items: [], error: null });
    const timer = window.setTimeout(() => controller.abort(), 8000);
    fetchCatalog(resource, controller.signal)
      .then(items => { if (active) setState({ status: 'ready', items, error: null }); })
      .catch((error: unknown) => {
        if (!active) return;
        const message = controller.signal.aborted
          ? 'Permintaan API melewati batas waktu 8 detik.'
          : error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat data API.';
        setState({ status: 'error', items: [], error: message });
      })
      .finally(() => window.clearTimeout(timer));
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [resource, reloadKey]);

  return { ...state, retry: () => setReloadKey(value => value + 1) };
}
