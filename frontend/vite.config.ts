import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Fail the production build early if API mode is requested without a valid backend origin.
  if (mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const usesApi = [
      env.VITE_DATA_SOURCE,
      env.VITE_CATALOG_SOURCE,
      env.VITE_BOOKING_AVAILABILITY_SOURCE,
      env.VITE_BOOKING_TRANSACTIONS_SOURCE,
    ].includes('api')
    if (usesApi) {
      let valid = false
      try {
        const url = new URL(env.VITE_API_BASE_URL ?? '')
        valid = ['http:', 'https:'].includes(url.protocol) && url.pathname === '/' && !url.search && !url.hash
      } catch {
        valid = false
      }
      if (!valid) {
        throw new Error(
          'API mode is enabled but VITE_API_BASE_URL is missing or invalid. ' +
            'Set it to the backend origin, e.g. https://api.example.com (no path).',
        )
      }
    }
  }

  return { plugins: [react(), tailwindcss()] }
})
