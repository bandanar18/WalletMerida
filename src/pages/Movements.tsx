import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Empty, ErrorBox, Loading, STATUS_LABEL } from '../components/ui';
import { money, relativeTime } from '../lib/format';
import { useCommissions, useMovements, useWithdrawals } from '../lib/queries';

type Filter = 'commissions' | 'transfers';

export function MovementsPage() {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<Filter>(params.get('ver') === 'retiros' ? 'transfers' : 'commissions');
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-brand-900">Movimientos</h1>
      <div role="tablist" className="grid grid-cols-2 rounded-2xl bg-white p-1 ring-1 ring-black/5">
        {(
          [
            ['commissions', 'Comisiones'],
            ['transfers', 'Retiros y pases'],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className={`rounded-xl py-2 text-sm font-semibold ${filter === k ? 'bg-brand-700 text-white' : 'text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {filter === 'commissions' ? <Commissions /> : <Transfers />}
    </div>
  );
}

function Commissions() {
  const q = useCommissions(100);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const items = q.data?.items ?? [];
  if (!items.length) return <Empty title="Sin comisiones todavía" text="Aquí verás cada jugada de tus referidos." />;
  return (
    <Card className="divide-y divide-brand-50 p-0">
      {items.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-brand-900">
              {c.player} · {c.game ?? 'Lotería'}
            </p>
            <p className="text-xs text-slate-500">
              {relativeTime(c.created_at)} · jugó {money(c.base_amount, c.currency)}
              {c.capped ? ' · con tope' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className={`tabular font-bold ${c.status === 'REVERSED' ? 'text-slate-400 line-through' : 'text-brand-700'}`}>{money(c.amount, c.currency, { sign: true })}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_LABEL[c.status].cls}`}>{STATUS_LABEL[c.status].text}</span>
          </div>
        </div>
      ))}
    </Card>
  );
}

const W_STATUS = {
  REQUESTED: { text: 'En trámite', cls: 'bg-gold-100 text-amber-800' },
  PAID: { text: 'Pagado', cls: 'bg-brand-100 text-brand-900' },
  REJECTED: { text: 'Rechazado', cls: 'bg-red-50 text-red-700' },
} as const;

function Transfers() {
  const q = useMovements();
  const w = useWithdrawals();
  if (q.isLoading || w.isLoading) return <Loading />;
  if (q.error || w.error) return <ErrorBox error={q.error ?? w.error} />;
  const items = (q.data ?? []).filter((m) => m.type === 'AGENT_TO_PLAYER');
  const withdrawals = w.data ?? [];
  if (!items.length && !withdrawals.length) return <Empty title="Sin retiros todavía" text="Tus retiros por Pago Móvil y los pases a saldo de juego aparecerán aquí." />;
  return (
    <div className="space-y-3">
      {withdrawals.length > 0 && (
        <Card className="divide-y divide-brand-50 p-0">
          {withdrawals.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-900">Pago Móvil · {r.payoutTo.alias}</p>
                  <p className="text-xs text-slate-500">
                    {relativeTime(r.created_at)} · {r.payoutTo.bank.split(' - ')[1] ?? r.payoutTo.bank} {r.payoutTo.phoneMasked}
                  </p>
                  {r.source_currency === 'USDT' && (
                    <p className="text-xs text-slate-500">
                      Desde {money(r.source_amount, 'USDT')} · tasa {r.rate}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="tabular font-bold text-slate-700">{money(r.payout_ves, 'VES')}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${W_STATUS[r.status].cls}`}>{W_STATUS[r.status].text}</span>
                </div>
              </div>
              {r.status === 'PAID' && r.paid_reference && <p className="mt-1 text-xs text-slate-500">Ref. {r.paid_reference}</p>}
              {r.status === 'REJECTED' && (
                <p className="mt-1 text-xs text-red-700">
                  {r.reject_reason ?? 'Rechazado'} · te devolvimos {r.source_currency === 'USDT' ? money(r.source_amount, 'USDT') : money(r.payout_ves, 'VES')}
                </p>
              )}
            </div>
          ))}
        </Card>
      )}
      {items.length > 0 && <Card className="divide-y divide-brand-50 p-0">
      {items.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-semibold text-brand-900">A mi saldo de juego</p>
            <p className="text-xs text-slate-500">{relativeTime(m.created_at)}</p>
          </div>
          <p className="tabular font-bold text-slate-700">{money(-BigInt(m.amount), m.currency)}</p>
        </div>
      ))}
    </Card>}
    </div>
  );
}
