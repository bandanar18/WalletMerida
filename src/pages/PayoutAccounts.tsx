import { useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Empty, ErrorBox, Loading } from '../components/ui';
import { ApiError, del, patch, PayoutAccount, post, RELATIONSHIPS, SmsChallenge } from '../lib/api';
import { useBanks, usePayoutAccounts } from '../lib/queries';

const MAX = 5;
const MAX_FAMILY = 3;

/** «Mis Pago Móvil»: directorio de cuentas donde la agencia cobra (propias o de familiares). */
export function PayoutAccountsPage() {
  const q = usePayoutAccounts();
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const list = q.data ?? [];

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['agent', 'payout-accounts'] });
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-brand-900">Mis Pago Móvil</h1>
        <span className="text-sm text-slate-500">
          {list.length} de {MAX}
        </span>
      </div>
      <p className="text-sm text-slate-600">Aquí cobras tus comisiones, siempre en bolívares. Puedes usar tu Pago Móvil o el de un familiar.</p>
      <ErrorBox error={error} />
      {list.length === 0 ? (
        <Empty title="Aún no tienes Pago Móvil guardados" text="Agrega uno para poder retirar." />
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <AccountCard
              key={a.id}
              a={a}
              onDefault={() => act(() => patch(`/agent/payout-accounts/${a.id}`, { isDefault: true }))}
              onDelete={() => {
                if (confirm(`¿Eliminar «${a.alias}» de tu directorio?`)) void act(() => del(`/agent/payout-accounts/${a.id}`));
              }}
            />
          ))}
        </div>
      )}
      {list.length < MAX && (
        <Link to="/pago-movil/nuevo" className="block">
          <Button>+ Agregar Pago Móvil</Button>
        </Link>
      )}
    </div>
  );
}

function AccountCard({ a, onDefault, onDelete }: { a: PayoutAccount; onDefault: () => void; onDelete: () => void }) {
  return (
    <Card className={`p-4 ${a.status === 'INVALID' ? 'ring-2 ring-red-300' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-brand-900">
            {a.isDefault && <span aria-label="Predeterminada">★ </span>}
            {a.alias}
          </p>
          <p className="text-sm text-slate-600">
            {a.bankCode} {a.bankName} · {a.phoneMasked}
          </p>
          <p className="text-sm text-slate-600">
            {a.holderKind === 'SELF' ? 'Mía' : `${a.holderName} (${RELATIONSHIPS[a.relationship ?? ''] ?? 'Familiar'})`} · {a.documentMasked}
          </p>
        </div>
        <Link to={`/pago-movil/${a.id}/editar`} className="shrink-0 text-sm font-semibold text-brand-700" aria-label={`Editar ${a.alias}`}>
          Editar
        </Link>
      </div>
      {a.status === 'INVALID' && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          Datos incorrectos{a.invalidReason ? `: ${a.invalidReason}` : ''}. Corrígelos para volver a usarlo.
        </p>
      )}
      {a.inUse && <p className="mt-2 text-xs text-amber-700">Tiene un retiro en trámite: no se puede editar ni eliminar.</p>}
      <div className="mt-3 flex gap-4 text-sm font-semibold">
        {!a.isDefault && a.status === 'ACTIVE' && (
          <button onClick={onDefault} className="text-brand-700">
            Usar como predeterminada
          </button>
        )}
        {!a.inUse && (
          <button onClick={onDelete} className="text-red-700">
            Eliminar
          </button>
        )}
      </div>
    </Card>
  );
}

/** Agregar o editar un Pago Móvil: formulario → código SMS → guardado. */
export function PayoutFormPage({ editing }: { editing?: PayoutAccount | null }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const back = params.get('volver') === 'retirar' ? '/retirar' : '/pago-movil';
  const qc = useQueryClient();
  const banks = useBanks();
  const accounts = usePayoutAccounts();
  const [kind, setKind] = useState<'SELF' | 'FAMILY'>(editing?.holderKind ?? 'SELF');
  const [form, setForm] = useState({
    alias: editing?.alias ?? '',
    relationship: editing?.relationship ?? 'PADRE_MADRE',
    holderName: editing?.holderKind === 'FAMILY' ? editing.holderName : '',
    documentType: 'V',
    documentNumber: '',
    bankCode: editing?.bankCode ?? '0134',
    phone: '',
    isDefault: editing?.isDefault ?? false,
  });
  const [challenge, setChallenge] = useState<SmsChallenge | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const familyCount = (accounts.data ?? []).filter((a) => a.holderKind === 'FAMILY' && a.id !== editing?.id).length;
  const familyFull = familyCount >= MAX_FAMILY;
  useEffect(() => {
    if (familyFull && kind === 'FAMILY' && !editing) setKind('SELF');
  }, [familyFull, kind, editing]);

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...(editing ? { id: editing.id } : {}),
        alias: form.alias.trim(),
        holderKind: kind,
        bankCode: form.bankCode,
        phone: form.phone,
        isDefault: form.isDefault,
        ...(kind === 'FAMILY'
          ? { relationship: form.relationship, holderName: form.holderName.trim(), documentType: form.documentType, documentNumber: form.documentNumber }
          : {}),
      };
      setChallenge(await post<SmsChallenge>('/agent/payout-accounts/challenge', body));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (challenge) {
    return (
      <SmsStep
        challenge={challenge}
        onResend={() => void sendCode()}
        resendError={error}
        onDone={async () => {
          await qc.invalidateQueries({ queryKey: ['agent', 'payout-accounts'] });
          nav(back, { replace: true });
        }}
        onBack={() => setChallenge(null)}
      />
    );
  }

  const input = 'mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100';
  return (
    <form onSubmit={(e) => void sendCode(e)} className="space-y-4">
      <h1 className="text-xl font-bold text-brand-900">{editing ? 'Editar Pago Móvil' : 'Agregar Pago Móvil'}</h1>
      {editing && <p className="text-sm text-slate-600">Por seguridad, vuelve a escribir el teléfono{kind === 'FAMILY' ? ' y la cédula' : ''}.</p>}

      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">¿De quién es?</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(
            [
              ['SELF', 'Mía'],
              ['FAMILY', 'De un familiar'],
            ] as const
          ).map(([k, label]) => (
            <button
              type="button"
              key={k}
              aria-pressed={kind === k}
              disabled={k === 'FAMILY' && familyFull && !editing}
              onClick={() => setKind(k)}
              className={`h-12 rounded-xl border-2 font-semibold disabled:opacity-40 ${kind === k ? 'border-brand-700 bg-brand-100 text-brand-900' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {familyFull && !editing && <p className="mt-1 text-xs text-slate-500">Ya tienes {MAX_FAMILY} Pago Móvil de familiares (el máximo).</p>}
      </fieldset>

      {kind === 'FAMILY' && (
        <>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Parentesco</span>
            <select className={input} value={form.relationship} onChange={set('relationship')}>
              {Object.entries(RELATIONSHIPS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Nombre y apellido del titular</span>
            <input className={input} required minLength={3} maxLength={80} value={form.holderName} onChange={set('holderName')} />
          </label>
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Tipo</span>
              <select className={input} value={form.documentType} onChange={set('documentType')}>
                <option value="V">V</option>
                <option value="E">E</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Cédula del titular</span>
              <input className={input} required inputMode="numeric" value={form.documentNumber} onChange={set('documentNumber')} />
            </label>
          </div>
        </>
      )}

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Banco</span>
        <select className={input} value={form.bankCode} onChange={set('bankCode')}>
          {(banks.data ?? []).map((b) => (
            <option key={b.code} value={b.code}>
              {b.code} – {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Teléfono del Pago Móvil</span>
        <input className={input} required type="tel" inputMode="tel" placeholder="0414 123 4567" value={form.phone} onChange={set('phone')} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Nombre corto</span>
        <input className={input} required maxLength={30} placeholder={kind === 'FAMILY' ? 'Ej.: Banesco de mamá' : 'Ej.: Mi Banesco'} value={form.alias} onChange={set('alias')} />
      </label>
      {kind === 'SELF' && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-slate-600">🔒 Titular y cédula: los de tu cuenta.</p>}
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
        <span className="text-sm text-slate-700">Usar como predeterminada</span>
      </label>
      <ErrorBox error={error} />
      <Button type="submit" loading={busy}>
        Enviar código SMS
      </Button>
      <button type="button" onClick={() => nav(back)} className="w-full py-2 text-sm font-semibold text-slate-500">
        Cancelar
      </button>
    </form>
  );
}

function SmsStep({
  challenge,
  onDone,
  onBack,
  onResend,
  resendError,
}: {
  challenge: SmsChallenge;
  onDone: () => Promise<void>;
  onBack: () => void;
  onResend: () => void;
  resendError: unknown;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(60);
  useEffect(() => {
    setWait(60);
    setCode('');
    const t = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [challenge.challengeId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/agent/payout-accounts/confirm', { challengeId: challenge.challengeId, code });
      await onDone();
    } catch (err) {
      setError(err);
      if (err instanceof ApiError && (err.code === 'SMS_TOO_MANY_ATTEMPTS' || err.code === 'SMS_CODE_EXPIRED')) setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <h1 className="text-xl font-bold text-brand-900">Confirma con el código</h1>
      <p className="text-slate-600">
        Te enviamos un código por SMS al <strong>{challenge.maskedPhone}</strong>. Vence en 5 minutos.
      </p>
      {challenge.demoCode && (
        <div role="note" className="rounded-2xl border-2 border-gold-500 bg-gold-100 p-4 text-center">
          <p className="text-sm font-semibold text-amber-900">DEMO: no se envió SMS. Tu código es</p>
          <p className="tabular mt-1 text-3xl font-extrabold tracking-[0.3em] text-brand-950">{challenge.demoCode}</p>
        </div>
      )}
      <input
        aria-label="Código de 6 dígitos"
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className="tabular h-16 w-full rounded-2xl border border-slate-300 bg-white text-center text-3xl font-bold tracking-[0.5em] outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
      />
      <ErrorBox error={error ?? resendError} />
      <Button type="submit" loading={busy} disabled={code.length !== 6}>
        Confirmar
      </Button>
      <div className="flex justify-between text-sm font-semibold">
        <button type="button" onClick={onBack} className="text-slate-500">
          ← Cambiar datos
        </button>
        <button type="button" onClick={onResend} disabled={wait > 0} className="text-brand-700 disabled:text-slate-400">
          {wait > 0 ? `Reenviar código (0:${String(wait).padStart(2, '0')})` : 'Reenviar código'}
        </button>
      </div>
    </form>
  );
}

/** Ruta /pago-movil/:id/editar */
export function PayoutEditRoute({ id }: { id: string }) {
  const q = usePayoutAccounts();
  if (q.isLoading) return <Loading />;
  const acc = q.data?.find((a) => a.id === id);
  if (!acc) return <ErrorBox error={new Error('Pago Móvil no encontrado')} />;
  return <PayoutFormPage editing={acc} />;
}
