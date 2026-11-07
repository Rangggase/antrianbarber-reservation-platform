import { ArrowDownRight, ArrowUpRight, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
const heroPhoto = 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1250&q=85';
export default function Hero() {
  const [src, setSrc] = useState(heroPhoto);
  return <section className="hero-section" id="beranda" aria-labelledby="hero-title">
    <div className="container-shell hero-grid">
      <div className="hero-copy">
        <div className="eyebrow eyebrow-inverse"><span className="line"/> YOUR STYLE, YOUR SIGNATURE</div>
        <h1 id="hero-title">Good hair.<br/><em>Better days.</em></h1>
        <p>Potongan presisi, tampilan penuh karakter. Temukan inspirasi rambutmu dan atur antrean tanpa ribet—semua dalam satu tempat.</p>
        <div className="flex flex-wrap items-center gap-7"><Link className="button button-gold" to="/reservasi">Reservasi Sekarang <ArrowUpRight size={18}/></Link><Link className="inline-link" to="/inspirasi">Jelajahi Gaya <ArrowDownRight size={18}/></Link></div>
        <div className="hero-caption"><Star size={12} fill="currentColor"/> DEMONSTRATION PROJECT <span className="hero-separator"/> DIGITAL BARBER EXPERIENCE</div>
      </div>
      <div className="hero-photo-box">
        <img src={src} alt="Suasana proses merapikan potongan rambut di barbershop" onError={() => setSrc('/images/photo-fallback.svg')}/>
        <div className="hero-photo-overlay"/>
        <div className="photo-footer"><span>01 / THE CRAFT</span><span>THE ART OF LOOKING SHARP.</span></div>
        <div className="hero-roundel"><span>EST.</span><strong>AB</strong><span>STUDIO</span></div>
      </div>
    </div>
    <div className="marquee-strip"><div className="container-shell flex flex-wrap items-center justify-between gap-3"><span>PRECISION IN EVERY CUT</span><span>✳</span><span>CLASSIC ROOTS. MODERN EDGE.</span><span>✳</span><span>YOUR NEXT LOOK STARTS HERE</span></div></div>
  </section>;
}
