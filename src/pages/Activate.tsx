import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Button, Card, DemoBanner, ErrorBox, FortunaBrand } from '../components/ui';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { agencyNameOf } from '../lib/format';

/** Primera vez: activar la agencia en un paso. */
export function ActivatePage() {
  const qc = useQueryClient();
  const { logout } = useAuth();
  const me = useQuery({ queryKey: ['me'], queryFn: () => get<{ first_name: string; last_name: string }>('/me') });
  const name = me.data ? agencyNameOf(me.data.first_name, me.data.last_name) : '';
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/agent', { displayName: name, acceptTerms: accept });
      await qc.invalidateQueries({ queryKey: ['agent'] });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-brand-50">
      <DemoBanner />
      <div className="bg-brand-900 px-6 pb-16 pt-8 text-white">
        <FortunaBrand subtitle="Agencias Virtuales" />
        <h1 className="mt-5 text-3xl font-extrabold leading-tight">Crea tu agencia</h1>
        <p className="mt-2 text-white/85">Gana el 3 % de cada jugada de las personas que invites.</p>
      </div>
      <div className="-mt-10 px-4 pb-10">
        <Card>
          <ul className="space-y-2 text-slate-700">
            <li>✓ Sin inversión</li>
            <li>✓ Ves tus comisiones al instante</li>
            <li>✓ Pásalas a tu saldo de juego cuando quieras</li>
          </ul>
          <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
            <p className="rounded-xl bg-brand-50 px-3 py-3 text-sm text-slate-700">
              Tu agencia aparecerá con tu nombre: <strong>«Te invitó: {name || '…'}»</strong>
            </p>
            <label className="flex items-start gap-3 rounded-xl bg-brand-50 p-3">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1 h-5 w-5 accent-brand-700" />
              <span className="text-sm text-slate-700">
                Acepto los <strong>Términos del Programa de Agencias</strong>: no invitar a menores de edad ni a personas autoexcluidas, no prometer premios
                y jugar con responsabilidad.
              </span>
            </label>
            <ErrorBox error={error} />
            <Button type="submit" loading={busy} disabled={!accept || name.length < 3}>
              Crear mi agencia
            </Button>
          </form>
        </Card>
        <button onClick={() => void logout()} className="mx-auto mt-6 block text-sm font-semibold text-slate-500 underline">
          Salir
        </button>
      </div>
    </div>
  );
}
