import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, CurrencyToggle, ErrorBox, Loading } from '../components/ui';
import { Currency, get, post, Quote, RELATIONSHIPS } from '../lib/api';
import { LOTERIA_URL, money, toApiAmount, toMinor } from '../lib/format';
import { useAgent, useFxToday, usePayoutAccounts, useSummary } from '../lib/queries';

/** Retirar por Pago Móvil: SIEMPRE se recibe en bolívares. Paso 1: cuánto. Paso 2: a cuál Pago Móvil. */
export function WithdrawPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const agent = useAgent();
  const summary = useSummary();
  const accounts = usePayoutAccounts();
  const fx = useFxToday();
  const [step, setStep] = useState<1 | 2>(1);
  const [currency, setCurrency] = useState<Currency>('VES');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<unknown>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ves: string; to: string } | null>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [currency, amount, accountId]);

  const available = BigInt(summary.data?.balances.find((b) => b.currency === currency)?.available ?? '0');
  const minor = toMinor(amount, currency);
  const amountOk = minor !== null && minor > 0n && minor <= available;

  // Cotización: cuánto recibe en Bs (con la tasa BCV del día si sale de USDT).
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!amountOk || minor === null) return;
    const t = setTimeout(() => {
      get<Quote>(`/agent/withdrawals/quote?sourceCurrency=${currency}&amount=${toApiAmount(minor, currency)}`).then(setQuote, setQuoteError);
    }, 300);
    return () => clearTimeout(t);
  }, [currency, amount]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = (accounts.data ?? []).filter((a) => a.status === 'ACTIVE');
  useEffect(() => {
    if (!accountId && active.length) setAccountId((active.find((a) => a.isDefault) ?? active[0]).id);
  }, [active, accountId]);

  if (agent.isLoading || summary.isLoading || accounts.isLoading) return <Loading />;

  if ((agent.data?.kycLevel ?? 0) < 2) {
    return (
      <Card className="space-y-3">
        <h1 className="text-xl font-bold text-brand-900">Verifica tu identidad para retirar</h1>
        <p className="text-slate-600">Por seguridad, los retiros por Pago Móvil requieren tu verificación de identidad (nivel 2). Hazla en tu cuenta de la Lotería.</p>
        <a href={`${LOTERIA_URL}/cuenta`} target="_blank" rel="noreferrer" className="block">
          <Button>Verificar mi identidad ↗</Button>
        </a>
        <Button variant="ghost" onClick={() => nav('/')}>
          Volver
        </Button>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="text-center">
        <p className="text-5xl" aria-hidden>
          ✅
        </p>
        <h1 className="mt-3 text-xl font-bold text-brand-900">Solicitud enviada</h1>
        <p className="mt-1 text-slate-600">
          Te pagaremos <strong>{done.ves}</strong> por Pago Móvil a {done.to}. Te avisaremos cuando esté hecho.
        </p>
        <Button className="mt-6" onClick={() => nav('/movimientos?ver=retiros')}>
          Ver mis retiros
        </Button>
      </Card>
    );
  }

  const minVes = BigInt(quote?.minVes ?? '10000');
  const belowMin = quote ? BigInt(quote.payoutVes) < minVes : false;
  const noRate = currency === 'USDT' && fx.data === null;

  const confirm = async () => {
    if (!minor || !accountId || !quote) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ payoutVes: string }>('/agent/withdrawals', {
        sourceCurrency: currency,
        amount: toApiAmount(minor, currency),
        payoutAccountId: accountId,
        idempotencyKey,
      });
      const acc = active.find((a) => a.id === accountId)!;
      await qc.invalidateQueries({ queryKey: ['agent'] });
      setDone({ ves: money(r.payoutVes, 'VES'), to: `${acc.bankName} ${acc.phoneMasked}` });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (step === 1) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-brand-900">Retirar por Pago Móvil</h1>
        <p className="text-sm text-slate-600">Siempre recibes bolívares. Si retiras desde USDT, se convierten a la tasa BCV del día.</p>
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Retirar de</span>
            <div className="rounded-full bg-brand-900 p-0.5">
              <CurrencyToggle
                value={currency}
                onChange={(c) => {
                  setCurrency(c);
                  setAmount('');
                }}
              />
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Disponible: <strong className="tabular text-brand-900">{money(available, currency)}</strong>
          </p>
          {noRate ? (
            <p className="rounded-xl bg-gold-100 p-3 text-sm text-amber-900">
              La tasa de hoy aún no está disponible. Puedes retirar desde tu saldo en Bs o intentarlo más tarde.
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-label={`Monto en ${currency === 'VES' ? 'bolívares' : 'USDT'}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="tabular h-14 min-w-0 flex-1 rounded-xl border border-slate-300 px-4 text-2xl font-bold outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
                />
                <button type="button" onClick={() => setAmount(toApiAmount(available, currency).replace('.', ','))} className="rounded-xl bg-brand-50 px-4 font-semibold text-brand-700">
                  Todo
                </button>
              </div>
              {amount && minor !== null && minor > available && <p className="text-sm text-red-700">No tienes tanto disponible.</p>}
              {quote && (
                <div className="rounded-2xl bg-brand-50 p-4">
                  <p className="text-sm text-slate-600">Recibirás en tu Pago Móvil</p>
                  <p className="tabular text-3xl font-extrabold text-brand-900">{money(quote.payoutVes, 'VES')}</p>
                  {quote.rate && <p className="mt-1 text-sm text-slate-600">Tasa BCV de hoy: {quote.rate} Bs/USDT</p>}
                  {belowMin && <p className="mt-1 text-sm font-semibold text-red-700">El retiro mínimo es de {money(minVes, 'VES')}.</p>}
                </div>
              )}
              <ErrorBox error={quoteError} />
            </>
          )}
        </Card>
        <Button disabled={!amountOk || !quote || belowMin || noRate} onClick={() => setStep(2)}>
          Siguiente
        </Button>
        <Button variant="ghost" onClick={() => nav('/')}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-900">¿A cuál Pago Móvil?</h1>
      <p className="text-slate-600">
        Recibirás <strong className="tabular text-brand-900">{quote ? money(quote.payoutVes, 'VES') : '…'}</strong>
      </p>
      {active.length === 0 ? (
        <Card>
          <p className="font-semibold text-brand-900">Aún no tienes Pago Móvil guardados.</p>
          <p className="mt-1 text-sm text-slate-600">Agrega uno para recibir tu retiro.</p>
        </Card>
      ) : (
        <div role="radiogroup" className="space-y-2">
          {active.map((a) => (
            <button
              key={a.id}
              role="radio"
              aria-checked={accountId === a.id}
              onClick={() => setAccountId(a.id)}
              className={`w-full rounded-2xl border-2 bg-white p-4 text-left ${accountId === a.id ? 'border-brand-700' : 'border-transparent ring-1 ring-black/5'}`}
            >
              <p className="font-bold text-brand-900">
                {a.isDefault ? '★ ' : ''}
                {a.alias}
              </p>
              <p className="text-sm text-slate-600">
                {a.bankName} · {a.phoneMasked}
              </p>
              <p className="text-sm text-slate-600">{a.holderKind === 'SELF' ? 'Mía' : `${a.holderName} (${RELATIONSHIPS[a.relationship ?? ''] ?? 'Familiar'})`}</p>
            </button>
          ))}
        </div>
      )}
      {(accounts.data ?? []).some((a) => a.status === 'INVALID') && (
        <p className="text-sm text-red-700">
          Tienes Pago Móvil con datos incorrectos. <Link to="/pago-movil" className="font-semibold underline">Revísalos</Link>.
        </p>
      )}
      {(accounts.data?.length ?? 0) < 5 && (
        <Link to="/pago-movil/nuevo?volver=retirar" className="block text-center font-semibold text-brand-700">
          + Agregar Pago Móvil
        </Link>
      )}
      <ErrorBox error={error} />
      <Button onClick={() => void confirm()} loading={busy} disabled={!accountId || !active.length}>
        Confirmar retiro
      </Button>
      <Button variant="ghost" onClick={() => setStep(1)}>
        ← Cambiar monto
      </Button>
    </div>
  );
}
