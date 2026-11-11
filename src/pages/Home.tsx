import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, CurrencyToggle, ErrorBox, Loading, STATUS_LABEL } from '../components/ui';
import type { Currency } from '../lib/api';
import { money, relativeTime } from '../lib/format';
import { useCommissions, useSummary } from '../lib/queries';
import { TransferSheet } from './Transfer';

export function HomePage() {
  const nav = useNavigate();
  const [currency, setCurrency] = useState<Currency>('VES');
  const [transfer, setTransfer] = useState(false);
  const [info, setInfo] = useState(false);
  const summary = useSummary();
  const recent = useCommissions(5);

  if (summary.isLoading) return <Loading />;
  if (summary.error) return <ErrorBox error={summary.error} />;
  const s = summary.data!;
  const bal = s.balances.find((b) => b.currency === currency) ?? { available: '0', pending: '0', locked: '0' };
  const lockedVes = s.balances.find((b) => b.currency === 'VES')?.locked ?? '0';
  const today = s.today.find((t) => t.currency === currency);
  const suspended = s.status !== 'ACTIVE';

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/80">Disponible</p>
          <CurrencyToggle value={currency} onChange={setCurrency} />
        </div>
        <p className="tabular mt-2 text-4xl font-extrabold tracking-tight">{money(bal.available, currency)}</p>
        <button onClick={() => setInfo((v) => !v)} className="mt-3 flex items-center gap-2 text-sm text-white/85" aria-expanded={info}>
          Por liberar <span className="tabular font-bold text-gold-500">{money(bal.pending, currency)}</span>
          <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-xs">i</span>
        </button>
        {info && <p className="mt-2 rounded-xl bg-white/10 p-3 text-sm">Esta comisión estará disponible cuando termine el sorteo de la jugada.</p>}
        {BigInt(lockedVes) > 0n && (
          <Link to="/movimientos?ver=retiros" className="mt-2 block text-sm text-white/85">
            Retiros en trámite: <span className="tabular font-bold">{money(lockedVes, 'VES')}</span> →
          </Link>
        )}
      </section>

      <div className="space-y-2">
        <Button onClick={() => nav('/retirar')} disabled={suspended}>
          Retirar por Pago Móvil (Bs)
        </Button>
        <Button variant="ghost" onClick={() => setTransfer(true)} disabled={suspended || BigInt(bal.available) <= 0n}>
          Pasar a mi saldo de juego
        </Button>
      </div>

      <Card className="grid grid-cols-2 divide-x divide-brand-50 p-0">
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hoy</p>
          <p className="tabular mt-1 text-lg font-bold text-brand-900">{money(today?.commission ?? '0', currency, { sign: true })}</p>
          <p className="text-sm text-slate-600">{today?.plays ?? 0} jugadas</p>
        </div>
        <Link to="/referidos" className="p-4 hover:bg-brand-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Referidos</p>
          <p className="mt-1 text-lg font-bold text-brand-900">{s.referrals.total}</p>
          <p className="text-sm text-slate-600">{s.referrals.activeToday} jugaron hoy</p>
        </Link>
      </Card>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-brand-900">Últimas comisiones</h2>
          <Link to="/movimientos" className="text-sm font-semibold text-brand-700">
            Ver todo
          </Link>
        </div>
        {recent.data?.items.length ? (
          <Card className="divide-y divide-brand-50 p-0">
            {recent.data.items.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-900">
                    {c.player} · {c.game ?? 'Lotería'}
                  </p>
                  <p className="text-xs text-slate-500">{relativeTime(c.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className={`tabular font-bold ${c.status === 'REVERSED' ? 'text-slate-400 line-through' : 'text-brand-700'}`}>
                    {money(c.amount, c.currency, { sign: true })}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_LABEL[c.status].cls}`}>{STATUS_LABEL[c.status].text}</span>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <Card>
            <p className="font-semibold text-brand-900">Aún no tienes comisiones.</p>
            <p className="mt-1 text-sm text-slate-600">Comparte tu código: ganas el 3 % de cada jugada de tus invitados.</p>
            <Link to="/codigo" className="mt-3 inline-block font-bold text-brand-700">
              Ver mi código →
            </Link>
          </Card>
        )}
      </section>

      {transfer && <TransferSheet initialCurrency={currency} onClose={() => setTransfer(false)} />}
    </div>
  );
}
