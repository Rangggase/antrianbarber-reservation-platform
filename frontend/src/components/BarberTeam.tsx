import { ArrowUpRight, Award, Scissors } from 'lucide-react';
import { Link } from 'react-router';
import { barbers } from '../data/barbers';
import { useApiCatalog, useLiveCatalog } from '../api/catalog';
import '../styles/api-catalog.css';

export default function BarberTeam({ compact = false }: { compact?: boolean }) {
  const catalog = useApiCatalog('barbers');
  const items = useLiveCatalog
    ? catalog.items.map(remote => {
        const local = barbers.find(b => b.id === remote.code);
        return {
          id: remote.code, name: remote.full_name,
          initials: local?.initials ?? remote.full_name.split(' ').slice(0, 2).map(x => x[0] ?? '').join('').toUpperCase(),
          role: local?.role ?? 'Barber', experience: local?.experience ?? '—',
          specialty: remote.specialty, bio: remote.bio ?? local?.bio ?? 'Profil barber tersedia dalam katalog.',
          tone: local?.tone ?? 'sage', selectable: Boolean(local),
        };
      })
    : barbers.map(item => ({ ...item, selectable: true }));
  const shown = items.slice(0, compact ? 2 : undefined);

  return <section className="section-light team-section" aria-labelledby="team-heading">
    <div className="container-shell">
      <div className="section-head"><div><div className="eyebrow"><span className="line" /> MEET THE CRAFT</div>
        <h2 id="team-heading">Skilled hands.<br/><em>Signature looks.</em></h2></div>
        <p>Pilih siapa yang akan menangani gaya kamu. Profil berikut adalah data ilustratif untuk demonstrasi portofolio.</p>
      </div>
      {useLiveCatalog && <p className="catalog-source" role="status">Profil barber dari FastAPI lokal · Pemilihan pada reservasi masih mode demo.</p>}
      {useLiveCatalog && catalog.status === 'loading' && <div className="catalog-feedback" role="status">Memuat tim barber dari PostgreSQL melalui FastAPI…</div>}
      {useLiveCatalog && catalog.status === 'error' && <div className="catalog-feedback catalog-error" role="alert"><p>Data barber belum dapat dimuat: {catalog.error}</p><button type="button" onClick={catalog.retry}>Coba lagi</button></div>}
      {useLiveCatalog && catalog.status === 'ready' && items.length === 0 && <div className="catalog-feedback" role="status">Belum ada barber dalam database.</div>}
      {(!useLiveCatalog || catalog.status === 'ready') && shown.length > 0 && <div className="team-grid">
        {shown.map((barber, index) => <article className="team-card" key={barber.id}>
          <div className={`team-portrait team-${barber.tone}`} aria-label={`Ilustrasi grafis ${barber.name}`} role="img">
            <span className="team-portrait-number">0{index + 1} / THE TEAM</span>
            <span className="team-avatar-mark" aria-hidden="true">{barber.initials}</span>
            <Scissors aria-hidden="true" size={46} strokeWidth={0.8} className="team-avatar-scissors" />
          </div>
          <div className="team-card-body"><div className="team-card-header"><div><p className="team-role">{barber.role}</p><h3>{barber.name}</h3></div><Award size={22} aria-hidden="true"/></div>
            <p className="team-bio">{barber.bio}</p>
            <div className="team-meta"><span>{barber.experience} pengalaman <em>· data demo</em></span><strong>{barber.specialty}</strong></div>
            {barber.selectable ? <Link to={`/reservasi?barber=${encodeURIComponent(barber.id)}`} className="team-book-link">Pilih barber ini <ArrowUpRight size={17}/></Link>
              : <span className="catalog-unavailable">Belum dapat dipilih dalam demo</span>}
          </div>
        </article>)}
      </div>}
      {compact && (!useLiveCatalog || catalog.status === 'ready') && items.length > 2 && <div className="team-more"><Link className="inline-link" to="/barber">Kenali seluruh tim <ArrowUpRight size={18}/></Link></div>}
      <p className="disclaimer mt-6">*{useLiveCatalog ? 'Nama dan spesialisasi dari API; peran, pengalaman, dan gambar avatar tetap ilustratif. Demo reservasi belum terhubung database.' : 'Nama, pengalaman, dan spesialisasi barber hanya data fiktif untuk demo. Tidak mewakili pegawai barbershop nyata.'}</p>
    </div>
  </section>;
}
