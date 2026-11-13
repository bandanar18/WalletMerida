import { useQueryClient } from '@tanstack/react-query';
import { FormEvent, ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, DemoBanner, ErrorBox, FortunaBrand } from '../components/ui';
import { post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { agencyNameOf } from '../lib/format';

const STATES = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro',
  'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta',
  'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
];

const inputCls =
  'mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/**
 * Registro de AGENCIA ONLINE en un solo paso: crea la cuenta en la Lotería Fortuna.Bet
 * (misma API, mismo formulario que el registro de jugador) y activa la agencia de inmediato.
 */
export function RegisterAgencyPage({ staffSession = false }: { staffSession?: boolean }) {
  const { register, logout } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    documentType: 'V',
    documentNumber: '',
    birthDate: '',
    phone: '',
    email: '',
    password: '',
    state: 'Mérida',
    city: '',
  });
  const [acceptProgram, setAcceptProgram] = useState(false);
  const [acceptAge, setAcceptAge] = useState(false);
  const [acceptDemo, setAcceptDemo] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { city, ...person } = form;
      if (!accountCreated) {
        // Una sesión abierta del personal (u otra cuenta) en este navegador se cierra antes de crear la agencia.
        if (staffSession) await logout();
        await register({ ...person, ...(city.trim() ? { city: city.trim() } : {}), currency: 'VES', acceptDemoTerms: true });
        setAccountCreated(true);
      }
      await post('/agent', { displayName: agencyNameOf(form.firstName, form.lastName), acceptTerms: true });
      await qc.invalidateQueries({ queryKey: ['agent'] });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const shownName = agencyNameOf(form.firstName, form.lastName);
  const ready = acceptProgram && acceptAge && acceptDemo && shownName.length >= 3;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-brand-50">
      <DemoBanner />
      <div className="bg-brand-900 px-6 pb-16 pt-8 text-white">
        <FortunaBrand subtitle="Agencias Virtuales" />
        <h1 className="mt-5 text-3xl font-extrabold leading-tight">Registro de agencia online</h1>
        <p className="mt-2 text-white/85">Crea tu cuenta y tu agencia en un solo paso. Gana el 3 % de cada jugada de las personas que invites.</p>
      </div>

      <div className="-mt-10 space-y-4 px-4 pb-10">
        <Card className="border-l-4 border-gold-500">
          <p className="font-bold text-brand-900">Este registro es para agencias online</p>
          <p className="mt-1 text-sm text-slate-600">
            No es el registro de jugador de Fortuna.Bet. Aquí te registras como <strong>agencia afiliada</strong>: recibes un código y un QR para invitar
            jugadores y cobras comisiones en esta Wallet. Tu cuenta queda vinculada a la agencia que actives.
          </p>
        </Card>

        {staffSession && (
          <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            Hay una sesión del personal de Fortuna.Bet abierta en este navegador. Al registrar la agencia se cerrará esa sesión.
          </p>
        )}

        <Card>
          <form onSubmit={(e) => void submit(e)} className="space-y-6">
            <fieldset className="space-y-4" disabled={accountCreated}>
              <legend className="text-lg font-bold text-brand-900">1. Tus datos</legend>
              <p className="-mt-2 text-sm text-slate-500">Persona mayor de 18 años responsable de la agencia. Una agencia por persona.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre">
                  <input required maxLength={60} autoComplete="given-name" value={form.firstName} onChange={set('firstName')} className={inputCls} />
                </Field>
                <Field label="Apellido">
                  <input required maxLength={60} autoComplete="family-name" value={form.lastName} onChange={set('lastName')} className={inputCls} />
                </Field>
              </div>
              <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-slate-700">
                Tu agencia aparecerá con tu nombre: <strong>«Te invitó: {shownName || 'Nombre Apellido'}»</strong>
              </p>
              <div className="grid grid-cols-[100px_1fr] gap-3">
                <Field label="Documento">
                  <select value={form.documentType} onChange={set('documentType')} className={inputCls}>
                    <option value="V">V</option>
                    <option value="E">E</option>
                    <option value="P">Pasaporte</option>
                  </select>
                </Field>
                <Field label="Número">
                  <input required minLength={6} maxLength={20} inputMode={form.documentType === 'P' ? 'text' : 'numeric'} value={form.documentNumber} onChange={set('documentNumber')} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de nacimiento">
                  <input required type="date" value={form.birthDate} onChange={set('birthDate')} className={inputCls} />
                </Field>
                <Field label="Teléfono">
                  <input required type="tel" placeholder="0414-1234567" autoComplete="tel" value={form.phone} onChange={set('phone')} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Estado">
                  <select value={form.state} onChange={set('state')} className={inputCls}>
                    {STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Ciudad (opcional)">
                  <input maxLength={60} value={form.city} onChange={set('city')} className={inputCls} />
                </Field>
              </div>
            </fieldset>

            <fieldset className="space-y-4" disabled={accountCreated}>
              <legend className="text-lg font-bold text-brand-900">2. Acceso a la Wallet</legend>
              <Field label="Correo">
                <input required type="email" maxLength={120} autoComplete="email" value={form.email} onChange={set('email')} className={inputCls} />
              </Field>
              <Field label="Contraseña" hint="Mínimo 10 caracteres, con letras y números. Es la misma para Fortuna.Bet y para esta Wallet.">
                <input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={form.password} onChange={set('password')} className={inputCls} />
              </Field>
            </fieldset>

            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-xl bg-brand-50 p-3">
                <input type="checkbox" checked={acceptProgram} onChange={(e) => setAcceptProgram(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-700" />
                <span className="text-sm text-slate-700">
                  Acepto los <strong>Términos del Programa de Agencias</strong>: no invitar a menores de edad ni a personas autoexcluidas, no prometer premios y
                  promover el juego responsable.
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl bg-brand-50 p-3">
                <input type="checkbox" checked={acceptAge} onChange={(e) => setAcceptAge(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-700" />
                <span className="text-sm text-slate-700">Declaro ser mayor de edad y que los datos son verdaderos.</span>
              </label>
              <label className="flex items-start gap-3 rounded-xl bg-brand-50 p-3">
                <input type="checkbox" checked={acceptDemo} onChange={(e) => setAcceptDemo(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-700" />
                <span className="text-sm text-slate-700">
                  Entiendo que es una <strong>aplicación DEMO</strong>: las comisiones y saldos no tienen valor real y está prohibida su comercialización.
                </span>
              </label>
            </div>

            {accountCreated && (
              <p role="status" className="rounded-2xl bg-brand-100 px-4 py-3 text-sm text-brand-900">
                Tu cuenta ya fue creada. Solo falta activar la agencia: pulsa el botón de nuevo.
              </p>
            )}
            <ErrorBox error={error} />
            <Button type="submit" loading={busy} disabled={!ready}>
              {accountCreated ? 'Activar mi agencia' : 'Registrar mi agencia online'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-600">
          ¿Ya tienes cuenta en Fortuna.Bet?{' '}
          <Link to="/" className="font-semibold text-brand-700 underline">
            Entra y activa tu agencia
          </Link>
        </p>
      </div>
    </div>
  );
}
