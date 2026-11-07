import { ArrowUpRight, Award, Scissors } from 'lucide-react';
import { Link } from 'react-router';
import { barbers } from '../data/barbers';

export default function BarberTeam({ compact = false }: { compact?: boolean }) {
  return <section className="section-light team-section" aria-labelledby="team-heading">
    <div className="container-shell">
      <div className="section-head">
        <div><div className="eyebrow"><span className="line" /> MEET THE CRAFT</div>
          <h2 id="team-heading">Skilled hands.<br/><em>Signature looks.</em></h2></div>
        <p>Pilih siapa yang akan menangani gaya kamu. Profil berikut adalah data ilustratif untuk demonstrasi portofolio.</p>
      </div>
      <div className="team-grid">
        {barbers.slice(0, compact ? 2 : undefined).map((barber, index) => <article className="team-card" key={barber.id}>
          <div className={`team-portrait team-${barber.tone}`} aria-label={`Ilustrasi grafis ${barber.name}`} role="img">
            <span className="team-portrait-number">0{index + 1} / THE TEAM</span>
            <span className="team-avatar-mark" aria-hidden="true">{barber.initials}</span>
            <Scissors aria-hidden="true" size={46} strokeWidth={0.8} className="team-avatar-scissors" />
          </div>
          <div className="team-card-body"><div className="team-card-header"><div><p className="team-role">{barber.role}</p><h3>{barber.name}</h3></div><Award size={22} aria-hidden="true"/></div>
            <p className="team-bio">{barber.bio}</p>
            <div className="team-meta"><span>{barber.experience} pengalaman <em>· data demo</em></span><strong>{barber.specialty}</strong></div>
            <Link to={`/reservasi?barber=${barber.id}`} className="team-book-link">Pilih barber ini <ArrowUpRight size={17}/></Link>
          </div>
        </article>)}
      </div>
      {compact && <div className="team-more"><Link className="inline-link" to="/barber">Kenali seluruh tim <ArrowUpRight size={18}/></Link></div>}
      <p className="disclaimer mt-6">*Nama, pengalaman, dan spesialisasi barber hanya data fiktif untuk demo. Tidak mewakili pegawai barbershop nyata.</p>
    </div>
  </section>;
}
