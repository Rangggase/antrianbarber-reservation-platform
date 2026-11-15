import { ArrowDownRight, ArrowUpRight, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
const heroPhoto = 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1250&q=85';
export default function Hero() {
  const [src, setSrc] = useState(heroPhoto);
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
        <img src={src} alt="Suasana proses merapikan potongan rambut di barbershop" onError={() => setSrc('/images/photo-fallback.svg')}/>
        <div className="hero-photo-overlay"/>
        <div className="photo-footer"><span>01 / KERAJINAN</span><span>TAMPIL LEBIH TAJAM.</span></div>
      </div>
    </div>
  </section>;
}
