import { Scissors } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { buttonClass } from '../ui';

export function FAQ() {return <section className="section-light section-alt" id="faq"><div className="container-shell faq-grid"><div><div className="eyebrow"><span className="line"/> PERTANYAAN UMUM</div><h2>Beberapa hal<br/><em>yang perlu diketahui.</em></h2><p className="faq-intro">Informasi singkat sebelum mencoba simulasi antrean digital.</p></div><div className="faqs">
  {[
    ['Apakah reservasi ini benar-benar dikirim ke barbershop?', 'Belum. Ini proyek portofolio. Reservasi tidak dikirim ke barbershop dan hanya tersimpan di browser yang kamu gunakan.'],
    ['Apakah barber dan jadwal tersebut benar-benar tersedia?', 'Belum. Profil barber, harga, dan slot waktu merupakan data ilustratif. Pilihan waktu bukan konfirmasi ketersediaan nyata.'],
    ['Di mana nomor antrean saya tersimpan?', 'Antrean disimpan di penyimpanan lokal browser Anda. Data dapat hilang bila Anda menghapus data situs, menggunakan browser lain, atau mode private.'],
    ['Apakah saya bisa menghapus data demonstrasi?', 'Bisa. Buka halaman Reservasi, cari bagian Antreanku, lalu batalkan reservasi atau hapus semua data demo.'],
    ['Kapan sistem online sungguhan tersedia?', 'Sistem reservasi lengkap (slot, pemesanan, dan area staf) sudah dibangun untuk pengembangan lokal, tetapi belum dipublikasikan. Situs ini berjalan dalam mode demo.'],
    ['Bagaimana data saya diperlakukan?', 'Ini demo portofolio, jadi gunakan nama dan nomor HP fiktif. Bila terhubung ke server demo, nama dan nomor HP disimpan apa adanya di database agar staf dapat menghubungi pelanggan, dan belum ada penghapusan otomatis. Jangan memasukkan data pelanggan nyata.'],
  ].map(([q,a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}
  </div></div></section>}

const explore = [
  { to: '/layanan', label: 'Layanan' },
  { to: '/barber', label: 'Barber' },
  { to: '/inspirasi', label: 'Inspirasi gaya' },
  { to: '/reservasi', label: 'Reservasi' },
  { to: '/faq', label: 'FAQ' },
];

/** Site footer (Sprint 5b): ink surface, a quiet closing prompt, links, and an honest project note. */
export default function Footer() {
  const { pathname } = useLocation();
  return <footer className="ds-root ds-on-ink ds-footer">
    <div className="ds-footer__inner">
      {pathname !== '/reservasi' && <div className="ds-footer__cta">
        <div>
          <p className="ds-footer__cta-title">Siap mengambil antrean?</p>
          <p className="ds-footer__text">Pilih layanan dan waktu, lalu karcis antrean Anda terbit dalam beberapa langkah.</p>
        </div>
        <Link to="/reservasi" className={buttonClass({ variant: 'secondary' }, 'ds-link')}>Ambil antrean</Link>
      </div>}
      <div className="ds-footer__grid">
        <div>
          <Link to="/" className="ds-header__brand ds-link"><Scissors size={22} strokeWidth={1.75} aria-hidden="true" /><span>Antrian Barber</span></Link>
          <p className="ds-footer__text">Sistem reservasi antrean barbershop: pilih layanan dan waktu, lalu dapatkan nomor antrean.</p>
        </div>
        <nav aria-label="Jelajahi">
          <strong className="ds-footer__title">Jelajahi</strong>
          <ul className="ds-footer__list">
            {explore.map(item => <li key={item.to}><Link to={item.to} className="ds-footer__link ds-link">{item.label}</Link></li>)}
          </ul>
        </nav>
        <div>
          <strong className="ds-footer__title">Tentang proyek</strong>
          <p className="ds-footer__text">Proyek portofolio mahasiswa Sistem Informasi: dari tugas Pemrograman Web awal kuliah menjadi sistem reservasi antrean barbershop. Bukan bisnis sungguhan.</p>
        </div>
      </div>
      <div className="ds-footer__bottom">
        <span>© {new Date().getFullYear()} Antrian Barber. Proyek portofolio.</span>
        <Link to="/" className="ds-footer__link ds-link">Kembali ke beranda</Link>
      </div>
    </div>
  </footer>;
}
