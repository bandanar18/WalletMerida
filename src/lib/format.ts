import type { Currency } from './api';

const CURRENCY: Record<Currency, { minor: number; symbol: string }> = {
  VES: { minor: 2, symbol: 'Bs' },
  USDT: { minor: 6, symbol: 'USDT' },
};

/** Montos del API (string en unidades mínimas) → «Bs 1.234,56» / «12,50 USDT», sin pasar por float. */
export function money(minorUnits: string | bigint | null | undefined, currency: Currency, opts: { sign?: boolean } = {}): string {
  const v = BigInt(minorUnits ?? 0);
  const { minor, symbol } = CURRENCY[currency];
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** BigInt(minor);
  const int = (abs / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const frac = (abs % base).toString().padStart(minor, '0').slice(0, 2);
  const sign = neg ? '−' : opts.sign && v > 0n ? '+' : '';
  return currency === 'VES' ? `${sign}Bs ${int},${frac}` : `${sign}${int},${frac} ${symbol}`;
}

/** «12,50» o «12.50» → unidades mínimas (bigint) o null si no es válido. */
export function toMinor(input: string, currency: Currency): bigint | null {
  const s = input.trim().replace(',', '.');
  const { minor } = CURRENCY[currency];
  if (!new RegExp(`^\\d{1,15}(\\.\\d{1,${minor}})?$`).test(s)) return null;
  const [int, frac = ''] = s.split('.');
  return BigInt(int) * 10n ** BigInt(minor) + BigInt(frac.padEnd(minor, '0') || '0');
}

/** Unidades mínimas → «12.50» para enviar al API. */
export function toApiAmount(minorUnits: bigint, currency: Currency): string {
  const { minor } = CURRENCY[currency];
  const base = 10n ** BigInt(minor);
  return `${minorUnits / base}.${(minorUnits % base).toString().padStart(minor, '0')}`;
}

const TZ = 'America/Caracas';

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Intl.DateTimeFormat('es-VE', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', { timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(iso));
}

/** Nombre con el que aparece la agencia: el de la persona responsable (máx. 40 caracteres). */
export const agencyNameOf = (firstName = '', lastName = '') => `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ').slice(0, 40);

export const LOTERIA_URL = (import.meta.env.VITE_LOTERIA_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5173';

/** Enlace que codifica el QR: abre el registro de la Lotería con el código ya puesto. */
export const referralLink = (code: string) => `${LOTERIA_URL}/r/${code.replace('-', '')}`;
