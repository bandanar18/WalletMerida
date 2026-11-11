import { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Currency } from '../lib/api';

export function Button({
  variant = 'gold',
  className = '',
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'gold' | 'green' | 'ghost'; loading?: boolean }) {
  const styles = {
    gold: 'bg-gold-500 text-brand-950 hover:bg-gold-600 shadow-sm',
    green: 'bg-brand-700 text-white hover:bg-brand-900',
    ghost: 'bg-white text-brand-900 border border-brand-100 hover:bg-brand-100',
  }[variant];
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`min-h-12 w-full rounded-2xl px-5 text-base font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {loading ? 'Un momento…' : children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 ${className}`}>{children}</div>;
}

export function CurrencyToggle({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <div role="tablist" aria-label="Moneda" className="inline-flex rounded-full bg-brand-900/40 p-1">
      {(['VES', 'USDT'] as Currency[]).map((c) => (
        <button
          key={c}
          role="tab"
          aria-selected={value === c}
          onClick={() => onChange(c)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${value === c ? 'bg-white text-brand-900' : 'text-white/80'}`}
        >
          {c === 'VES' ? 'Bs' : 'USDT'}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-brand-100 bg-white/60 p-8 text-center">
      <p className="text-lg font-bold text-brand-900">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-600">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Cargando">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {error instanceof Error ? error.message : 'Algo salió mal. Intenta de nuevo.'}
    </p>
  );
}

export const STATUS_LABEL = {
  PENDING: { text: 'Por liberar', cls: 'bg-gold-100 text-amber-800' },
  RELEASED: { text: 'Disponible', cls: 'bg-brand-100 text-brand-900' },
  REVERSED: { text: 'Anulada', cls: 'bg-slate-100 text-slate-600' },
} as const;

export function DemoBanner() {
  return (
    <div className="bg-gold-500 px-4 py-1.5 text-center text-xs font-bold text-brand-950">
      DEMO · Las comisiones no tienen valor real
    </div>
  );
}

/** Logo de FortunaBet (trébol de 4 hojas + «Fortuna» y «Bet» en dorado), igual que en la web de la Lotería. */
export function FortunaBrand({ subtitle, className = '' }: { subtitle?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-3xl leading-none" role="img" aria-label="Trébol de cuatro hojas">
        🍀
      </span>
      <span className="leading-tight">
        <span className="block text-xl font-extrabold tracking-tight text-white">
          Fortuna<span className="text-gold-500">Bet</span>
        </span>
        {subtitle && <span className="block text-xs font-semibold uppercase tracking-wide text-white/70">{subtitle}</span>}
      </span>
    </div>
  );
}
