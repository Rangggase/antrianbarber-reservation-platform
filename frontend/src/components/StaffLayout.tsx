import { Outlet, Link, useLocation } from 'react-router';
import { Scissors } from 'lucide-react';
import { readSession } from '../api/staff';
import { StaffNav } from './staff/StaffNav';
import '../ui';
import '../styles/staff.css';

/**
 * Back-office shell: deliberately separate from the customer header/footer.
 * Navigation (rail from 960px, bottom bar below) appears only while a session exists. The location is read
 * so that the shell re-renders after a sign-out navigates to the login page.
 */
export default function StaffLayout() {
  const { pathname } = useLocation();
  const session = readSession();
  const isAdmin = session?.user.role === 'admin';
  return <div className="staff-shell">
    <a href="#staff-main" className="skip-link">Langsung ke konten</a>
    <header className="staff-topbar">
      <Link to="/" className="staff-brand" aria-label="Kembali ke situs pelanggan"><Scissors size={18} aria-hidden="true" /> Antrian Barber <span>Staf</span></Link>
      <Link to="/" className="staff-topbar-link">Situs pelanggan</Link>
    </header>
    <div className="staff-body">
      {session && <StaffNav variant="rail" isAdmin={isAdmin} pathname={pathname} />}
      <main id="staff-main" tabIndex={-1} className="staff-main"><Outlet /></main>
    </div>
    {session && <StaffNav variant="tabbar" isAdmin={isAdmin} pathname={pathname} />}
  </div>;
}
