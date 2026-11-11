import { Link } from 'react-router-dom';
import { Card, Empty, ErrorBox, Loading } from '../components/ui';
import { money, shortDate } from '../lib/format';
import { useReferrals } from '../lib/queries';

export function ReferralsPage() {
  const q = useReferrals();
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const list = q.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-brand-900">Referidos ({list.length})</h1>
        <span className="text-sm text-slate-500">Este mes</span>
      </div>
      {list.length === 0 ? (
        <Empty
          title="Aún no tienes referidos"
          text="Comparte tu código y empieza a ganar."
          action={
            <Link to="/codigo" className="inline-block rounded-2xl bg-gold-500 px-5 py-3 font-bold text-brand-950">
              Compartir mi código
            </Link>
          }
        />
      ) : (
        <Card className="divide-y divide-brand-50 p-0">
          {list.map((r) => {
            const ves = r.commissionMonth.VES;
            const usdt = r.commissionMonth.USDT;
            return (
              <div key={r.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-900">
                    {r.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-brand-900">{r.name}</p>
                    <p className="text-xs text-slate-500">desde {shortDate(r.since)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">{r.playsMonth} jugadas</p>
                  {r.playsMonth === 0 ? (
                    <p className="text-sm text-slate-400">Aún no juega</p>
                  ) : (
                    <p className="tabular text-sm font-bold text-brand-700">
                      {[ves && money(ves, 'VES', { sign: true }), usdt && money(usdt, 'USDT', { sign: true })].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
      <p className="px-2 text-center text-xs text-slate-500">Por privacidad solo ves el nombre y la inicial del apellido.</p>
    </div>
  );
}
