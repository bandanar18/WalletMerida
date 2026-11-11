import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { LOTERIA_URL } from '../lib/format';
import { useAgent } from '../lib/queries';
import { useAgentRealtime } from '../lib/realtime';
import { DemoBanner } from './ui';

const TABS = [
  { to: '/', label: 'Inicio', icon: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { to: '/codigo', label: 'Mi código', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z' },
  { to: '/referidos', label: 'Referidos', icon: 'M16 11a4 4 0 10-8 0M2 21a7 7 0 0114 0M17 7a3 3 0 110 6M18 15a5 5 0 014 6' },
  { to: '/movimientos', label: 'Movimientos', icon: 'M4 6h16M4 12h16M4 18h10' },
];

const TOAST = {
  PENDING: '¡Nueva comisión! Se libera cuando termine el sorteo.',
  RELEASED: 'Tus comisiones ya están disponibles.',
  REVERSED: 'Se anuló una jugada y su comisión se descontó.',
};

export function Layout() {
  const { logout } = useAuth();
  const agent = useAgent();
  const live = useAgentRealtime(true);
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!live) return;
    setToast(TOAST[live.status]);
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [live]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-brand-50">
      <DemoBanner />
      <header className="sticky top-0 z-20 flex items-center justify-between bg-brand-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <div className="leading-tight">
            <p className="text-xs text-white/70">Agencia Virtual</p>
            <p className="font-bold">{agent.data?.displayName ?? '…'}</p>
          </div>
        </div>
        <button aria-label="Menú" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="rounded-xl p-2 hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        {menu && (
          <div className="absolute right-3 top-14 w-60 overflow-hidden rounded-2xl bg-white text-brand-900 shadow-xl ring-1 ring-black/5">
            <a href={LOTERIA_URL} target="_blank" rel="noreferrer" className="block px-4 py-3 hover:bg-brand-50">
              Ir a la Lotería ↗
            </a>
            <Link to="/pago-movil" onClick={() => setMenu(false)} className="block px-4 py-3 hover:bg-brand-50">
              Mis Pago Móvil
            </Link>
            <button onClick={() => void logout()} className="block w-full border-t border-brand-50 px-4 py-3 text-left font-semibold text-red-700 hover:bg-red-50">
              Salir
            </button>
          </div>
        )}
      </header>

      {agent.data?.status === 'SUSPENDED' && (
        <div role="alert" className="bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">
          Tu agencia está en revisión. Escríbenos a soporte.
        </div>
      )}

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-30 mx-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-brand-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-black/5 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-4">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${isActive ? 'text-brand-700' : 'text-slate-500'}`
                }
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
