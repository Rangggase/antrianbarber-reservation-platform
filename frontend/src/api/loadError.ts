/**
 * Customer-facing messages for failed reads (service catalog, barbers, time slots).
 * The technical cause goes to the console for developers; the UI only ever gets plain Indonesian
 * that says what happened and what to do next.
 */
export class HttpStatusError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

export function loadErrorMessage(error: unknown, timedOut: boolean, scope: string): string {
  console.error(`[${scope}] load failed`, error);
  if (timedOut) return 'Server terlalu lama merespons. Coba lagi sebentar lagi.';
  if (error instanceof TypeError) return 'Tidak dapat terhubung ke server. Periksa koneksi Anda, lalu coba lagi.';
  if (error instanceof HttpStatusError) {
    if (error.status === 429) return 'Terlalu banyak permintaan. Tunggu sebentar, lalu coba lagi.';
    if (error.status >= 500) return 'Server sedang bermasalah. Coba lagi beberapa saat lagi.';
  }
  return 'Data belum dapat dimuat. Coba lagi nanti.';
}
