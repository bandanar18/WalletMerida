import { useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { Button, CurrencyToggle, ErrorBox } from '../components/ui';
import { Currency, post } from '../lib/api';
import { money, toApiAmount, toMinor } from '../lib/format';
import { useSummary } from '../lib/queries';

/** «Pasar a mi saldo de juego»: inmediato, sin mínimo, misma moneda. */
export function TransferSheet({ initialCurrency, onClose }: { initialCurrency: Currency; onClose: () => void }) {
  const qc = useQueryClient();
  const summary = useSummary();
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // Una clave por intento: si el usuario toca dos veces, el servidor hace un solo movimiento.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [currency, amount]);

  const available = BigInt(summary.data?.balances.find((b) => b.currency === currency)?.available ?? '0');
  const minor = toMinor(amount, currency);
  const invalid = minor === null || minor <= 0n || minor > available;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid || minor === null) return;
    setBusy(true);
    setError(null);
    try {
      await post('/agent/transfer-to-player', { currency, amount: toApiAmount(minor, currency), idempotencyKey });
      await qc.invalidateQueries({ queryKey: ['agent'] });
      setDone(money(minor, currency));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="transfer-title" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[2rem] bg-white p-6 pb-10" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="text-center">
            <p className="text-5xl" aria-hidden>
              ✅
            </p>
            <p className="mt-3 text-xl font-bold text-brand-900">¡Listo!</p>
            <p className="mt-1 text-slate-600">{done} ya están en tu saldo de juego de la Lotería.</p>
            <Button className="mt-6" onClick={onClose}>
              Entendido
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)}>
            <div className="flex items-center justify-between">
              <h2 id="transfer-title" className="text-xl font-bold text-brand-900">
                Pasar a mi saldo de juego
              </h2>
              <div className="rounded-full bg-brand-900 p-0.5">
                <CurrencyToggle value={currency} onChange={setCurrency} />
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-600">Inmediato y sin mínimo. Lo verás en tu saldo de la Lotería.</p>
            <p className="mt-4 text-sm text-slate-600">
              Disponible: <strong className="tabular text-brand-900">{money(available, currency)}</strong>
            </p>
            <div className="mt-2 flex gap-2">
              <input
                inputMode="decimal"
                autoFocus
                placeholder="0,00"
                aria-label="Monto"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular h-14 flex-1 rounded-xl border border-slate-300 px-4 text-2xl font-bold outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="button"
                onClick={() => setAmount(toApiAmount(available, currency).replace('.', ','))}
                className="rounded-xl bg-brand-50 px-4 font-semibold text-brand-700"
              >
                Todo
              </button>
            </div>
            {amount && minor !== null && minor > available && <p className="mt-2 text-sm text-red-700">No tienes tanto disponible.</p>}
            <div className="mt-4">
              <ErrorBox error={error} />
            </div>
            <Button type="submit" className="mt-4" loading={busy} disabled={invalid}>
              Pasar {minor && !invalid ? money(minor, currency) : ''}
            </Button>
            <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm font-semibold text-slate-500">
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
