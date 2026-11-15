import { Outlet, Link } from 'react-router';
import { Scissors } from 'lucide-react';
import '../styles/staff.css';

/** Back-office shell: deliberately separate from the customer header/footer. */
export default function StaffLayout() {
  return <div className="staff-shell">
    <a href="#staff-main" className="skip-link">Langsung ke konten</a>
    <header className="staff-topbar">
      <Link to="/" className="staff-brand" aria-label="Kembali ke situs pelanggan"><Scissors size={18} aria-hidden="true" /> Antrian Barber <span>Staf</span></Link>
      <Link to="/" className="staff-topbar-link">Situs pelanggan</Link>
    </header>
    <main id="staff-main" tabIndex={-1} className="staff-main"><Outlet /></main>
  </div>;
}
