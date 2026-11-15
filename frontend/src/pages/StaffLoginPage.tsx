import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { LogIn } from 'lucide-react';
import { anyApiMode } from '../api/config';
import { StaffApiError, login, readSession, saveSession } from '../api/staff';

function describe(err: unknown): string {
  if (err instanceof StaffApiError) {
    if (err.status === 429) return 'Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.';
    if (err.status === 503 && err.code === 'staff_auth_not_configured') return 'Login staf belum dikonfigurasi di server.';
    return err.message;
  }
  return 'Terjadi kesalahan saat login.';
}

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const flash = (location.state as { message?: string } | null)?.message;

  if (!anyApiMode) {
    return <section className="staff-card" aria-labelledby="staff-login-title">
      <h1 id="staff-login-title">Area staf</h1>
      <p role="status">Area staf hanya tersedia pada mode API. Jalankan frontend dengan <code>VITE_DATA_SOURCE=api</code> dan backend FastAPI.</p>
      <Link className="button button-outline-dark" to="/">Kembali ke beranda</Link>
    </section>;
  }
  if (readSession()) return <Navigate to="/staff" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) { setError('Isi username dan password.'); return; }
    setBusy(true); setError('');
    try {
      saveSession(await login(username.trim(), password));
      navigate('/staff', { replace: true });
    } catch (err) {
      setError(describe(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return <section className="staff-card staff-login" aria-labelledby="staff-login-title">
    <p className="staff-eyebrow">BACK OFFICE</p>
    <h1 id="staff-login-title">Masuk staf</h1>
    <p className="staff-muted">Untuk admin dan barber. Akun dibuat oleh admin lewat skrip server.</p>
    {flash && <p className="staff-notice" role="status">{flash}</p>}
    <form onSubmit={submit} noValidate>
      <div className="staff-field"><label htmlFor="staff-username">Username</label>
        <input id="staff-username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={64} value={username} onChange={(e) => setUsername(e.target.value)} /></div>
      <div className="staff-field"><label htmlFor="staff-password">Password</label>
        <input id="staff-password" type="password" autoComplete="current-password" maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {error && <p className="staff-error" role="alert">{error}</p>}
      <button type="submit" className="button button-gold staff-submit" disabled={busy}><LogIn size={17} aria-hidden="true" /> {busy ? 'Memeriksa…' : 'Masuk'}</button>
    </form>
  </section>;
}
