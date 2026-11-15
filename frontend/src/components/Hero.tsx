import { ArrowDownRight, ArrowUpRight, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
// Foto hero (Unsplash, 1599351431202-1e0f0137899a) disimpan lokal sebagai webp agar tidak bergantung host luar.
export default function Hero() {
  const [failed, setFailed] = useState(false);
  return <section className="hero-section" id="beranda" aria-labelledby="hero-title">
    <div className="container-shell hero-grid">
      <div className="hero-copy">
        <div className="eyebrow eyebrow-inverse"><span className="line"/> GAYAMU, CIRIMU</div>
        <h1 id="hero-title">Rambut rapi.<br/><em>Lebih percaya diri.</em></h1>
        <p>Potongan presisi, tampilan penuh karakter. Temukan inspirasi rambutmu dan atur antrean tanpa ribet—semua dalam satu tempat.</p>
        <div className="flex flex-wrap items-center gap-7"><Link className="button button-gold" to="/reservasi">Reservasi Sekarang <ArrowUpRight size={18}/></Link><Link className="inline-link" to="/inspirasi">Jelajahi Gaya <ArrowDownRight size={18}/></Link></div>
        <div className="hero-caption"><Star size={12} fill="currentColor"/> PROYEK DEMO <span className="hero-separator"/> PENGALAMAN BARBER DIGITAL</div>
      </div>
      <div className="hero-photo-box">
        {failed
          ? <img src="/images/photo-fallback.svg" alt="Suasana proses merapikan potongan rambut di barbershop"/>
          : <img src="/images/hero-900.webp" srcSet="/images/hero-640.webp 640w, /images/hero-900.webp 900w" sizes="(max-width: 760px) 100vw, 50vw" width={900} height={1349} fetchPriority="high" alt="Suasana proses merapikan potongan rambut di barbershop" onError={() => setFailed(true)}/>}
        <div className="hero-photo-overlay"/>
        <div className="photo-footer"><span>01 / KERAJINAN</span><span>TAMPIL LEBIH TAJAM.</span></div>
      </div>
    </div>
  </section>;
}
