import { ArrowUpRight, CalendarCheck, Sparkles, UsersRound } from 'lucide-react';
import { Link } from 'react-router';
import Hero from '../components/Hero';

export default function HomePage() {
  return <>
    <Hero />
    <section className="home-quicklinks" aria-labelledby="home-discover-title"><div className="container-shell">
      <div className="home-quicklinks-heading"><div><div className="eyebrow"><span className="line"/> EXPLORE THE EXPERIENCE</div><h2 id="home-discover-title">A good cut starts <em>with a choice.</em></h2></div><p>Eksplorasi layanan, pilih barber favorit, dan coba alur reservasi dalam beberapa langkah.</p></div>
      <div className="home-quicklinks-grid home-quicklinks-three">
        <Link to="/layanan" className="home-quicklink-card"><span className="home-quicklink-icon"><Sparkles size={28}/></span><span className="home-quicklink-overline">01 / TREATMENTS</span><strong>Jelajahi Layanan</strong><span>Lihat harga demo dan durasi setiap layanan.</span><ArrowUpRight size={24} className="home-quicklink-arrow"/></Link>
        <Link to="/barber" className="home-quicklink-card"><span className="home-quicklink-icon"><UsersRound size={28}/></span><span className="home-quicklink-overline">02 / THE TEAM</span><strong>Pilih Barber</strong><span>Kenali profil dan spesialisasi tim ilustratif.</span><ArrowUpRight size={24} className="home-quicklink-arrow"/></Link>
        <Link to="/reservasi" className="home-quicklink-card home-quicklink-featured"><span className="home-quicklink-icon"><CalendarCheck size={28}/></span><span className="home-quicklink-overline">03 / BOOKING FLOW</span><strong>Ambil Antrean</strong><span>Coba pemesanan demo bertahap yang lebih nyaman.</span><ArrowUpRight size={24} className="home-quicklink-arrow"/></Link>
      </div>
    </div></section>
  </>;
}
