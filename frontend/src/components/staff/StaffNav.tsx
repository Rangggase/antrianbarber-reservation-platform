import { Link } from 'react-router';
import { CalendarDays, ChartColumn, ClipboardList, type LucideIcon } from 'lucide-react';

type Item = { to: string; label: string; icon: LucideIcon; adminOnly?: boolean };

const ITEMS: Item[] = [
  { to: '/staff', label: 'Antrean', icon: ClipboardList },
  { to: '/staff/reports', label: 'Laporan', icon: ChartColumn, adminOnly: true },
  { to: '/staff/schedule', label: 'Jadwal', icon: CalendarDays, adminOnly: true },
];

/**
 * Staff navigation. `rail` is the left column from 960px; `tabbar` is the fixed bottom bar below it.
 * Both render the same links; CSS shows exactly one of them, so each link name appears once to assistive tech.
 */
export function StaffNav({ variant, isAdmin, pathname }: { variant: 'rail' | 'tabbar'; isAdmin: boolean; pathname: string }) {
  const items = ITEMS.filter(item => !item.adminOnly || isAdmin);
  return (
    <nav aria-label="Menu staf" className={variant === 'rail' ? 'staff-rail' : 'staff-tabbar'}>
      <ul className="staff-nav-list">
        {items.map(item => {
          const Icon = item.icon;
          const active = item.to === '/staff' ? pathname === '/staff' : pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <Link to={item.to} className="staff-navlink" aria-current={active ? 'page' : undefined}>
                <Icon size={20} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
