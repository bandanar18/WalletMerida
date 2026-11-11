import { FormEvent, useState } from 'react';
import { Button, Card, DemoBanner, ErrorBox, FortunaBrand } from '../components/ui';
import { useAuth } from '../lib/auth';
import { Link } from 'react-router-dom';

declare const __DEV_LOGINS__: { label: string; email: string; password: string }[];

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent, creds?: { email: string; password: string }) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(creds?.email ?? email, creds?.password ?? password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-brand-900">
      <DemoBanner />
      <div className="px-6 pb-8 pt-10 text-white">
        <FortunaBrand subtitle="Agencias Virtuales" />
        <h1 className="mt-5 text-3xl font-extrabold leading-tight">
          Gana el <span className="text-gold-500">3 %</span> de cada jugada de tus invitados
        </h1>
        <ul className="mt-4 space-y-1.5 text-white/85">
          <li>✓ Sin inversión</li>
          <li>✓ Ves tus comisiones al instante</li>
          <li>✓ Pásalas a tu saldo cuando quieras</li>
        </ul>
      </div>

      <div className="flex-1 rounded-t-[2rem] bg-brand-50 px-4 pt-6">
        <Card>
          <h2 className="text-xl font-bold text-brand-900">Entrar</h2>
          <p className="mt-1 text-sm text-slate-600">Usa la misma cuenta de la Lotería FortunaBet.</p>
          <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Correo</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Contraseña</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <ErrorBox error={error} />
            <Button type="submit" loading={busy}>
              Entrar
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            ¿Aún no eres agencia?{' '}
            <Link to="/registro" className="font-semibold text-brand-700 underline">
              Registra tu agencia online
            </Link>
          </p>
        </Card>

        {__DEV_LOGINS__.length > 0 && (
          <div className="mt-4 pb-8">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Accesos de prueba (solo desarrollo)</p>
            <div className="flex flex-wrap justify-center gap-2">
              {__DEV_LOGINS__.map((l) => (
                <button
                  key={l.email}
                  onClick={(e) => void submit(e, l)}
                  className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-brand-900 ring-1 ring-brand-100 hover:bg-brand-100"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
