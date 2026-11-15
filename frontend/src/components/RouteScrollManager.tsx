import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

const legacyHashes: Record<string,string> = {
  '#beranda': '/', '#layanan': '/layanan', '#inspirasi': '/inspirasi',
  '#tentang': '/tentang', '#faq': '/faq', '#reservasi': '/reservasi'
};
const pageTitles: Record<string,string> = {
  '/': 'Beranda', '/layanan': 'Layanan', '/inspirasi': 'Inspirasi Gaya',
  '/tentang': 'Tentang Kami', '/faq': 'Pertanyaan Umum', '/reservasi': 'Reservasi Demo'
};

export default function RouteScrollManager() {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    // Compatibility: old bookmarks such as /#reservasi still work.
    if (pathname === '/' && legacyHashes[hash]) {
      navigate(legacyHashes[hash], { replace: true });
      return;
    }
    document.title = `${pageTitles[pathname] || 'Halaman Tidak Ditemukan'} | Antrian Barber`;
    if (hash && hash !== '#main') {
      requestAnimationFrame(() => document.getElementById(hash.substring(1))?.scrollIntoView());
    } else if (hash !== '#main') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [pathname, hash, navigate]);
  return null;
}
