import { Outlet, Route, Routes } from 'react-router';
import Header from './components/Header';
import Footer from './components/Footer';
import RouteScrollManager from './components/RouteScrollManager';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import BarbersPage from './pages/BarbersPage';
import InspirationPage from './pages/InspirationPage';
import AboutPage from './pages/AboutPage';
import BookingPage from './pages/BookingPage';
import FAQPage from './pages/FAQPage';
import NotFoundPage from './pages/NotFoundPage';
import './styles/routes.css';
import './styles/premium-v21d.css';
import './styles/qa-mobile-fix.css';

function CustomerLayout() {
  return <>
    <a href="#main" className="skip-link">Langsung ke konten</a>
    <RouteScrollManager />
    <Header />
    <main id="main" tabIndex={-1}><Outlet /></main>
    <Footer />
  </>;
}
export default function App() {
  return <Routes><Route element={<CustomerLayout />}>
    <Route index element={<HomePage />} />
    <Route path="layanan" element={<ServicesPage />} />
    <Route path="barber" element={<BarbersPage />} />
    <Route path="inspirasi" element={<InspirationPage />} />
    <Route path="tentang" element={<AboutPage />} />
    <Route path="faq" element={<FAQPage />} />
    <Route path="reservasi" element={<BookingPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes>;
}
