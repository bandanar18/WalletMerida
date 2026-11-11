/**
 * Cliente de la API de la Lotería (misma cuenta que la Lotería).
 * Token de acceso en memoria; el refresh token vive en una cookie httpOnly con rotación.
 */

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface SessionUser {
  id: string;
  role: string;
  kind: 'PLAYER' | 'STAFF';
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => (accessToken = t);
export const getAccessToken = () => accessToken;
export const setOnSessionLost = (fn: () => void) => (onSessionLost = fn);

export async function refreshSession(): Promise<{ accessToken: string; user: SessionUser } | null> {
  const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) return null;
  const data = await res.json();
  accessToken = data.accessToken;
  return data;
}

export async function tryRefresh(): Promise<boolean> {
  refreshing ??= refreshSession()
    .then((r) => r !== null)
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function api<T = any>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return api(method, path, body, false);
    onSessionLost?.();
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new ApiError(res.status, data?.code ?? 'ERROR', message ?? 'Algo salió mal. Intenta de nuevo.', data?.details);
  }
  return data as T;
}

export const get = <T = any>(path: string) => api<T>('GET', path);
export const post = <T = any>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});

// ───────────── Tipos de la API de agencias ─────────────

export type Currency = 'VES' | 'USDT';

export interface AgentProfile {
  id: string;
  displayName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  code: string | null;
  linkPath: string | null;
  kycLevel: number;
  termsVersion: string;
  createdAt: string;
}

export interface AgentSummary {
  status: AgentProfile['status'];
  balances: { currency: Currency; available: string; pending: string; locked: string }[];
  today: { currency: Currency; plays: number; commission: string }[];
  referrals: { total: number; activeToday: number };
}

export interface Commission {
  id: string;
  created_at: string;
  status: 'PENDING' | 'RELEASED' | 'REVERSED';
  currency: Currency;
  base_amount: string;
  amount: string;
  rate_bps: number;
  capped: boolean;
  game: string | null;
  player: string;
}

export interface Referral {
  key: number;
  name: string;
  since: string;
  playsMonth: number;
  commissionMonth: Partial<Record<Currency, string>>;
}

export interface Movement {
  id: string;
  type: string;
  account_type: 'AGENT_PENDING' | 'AGENT_CASH';
  currency: Currency;
  direction: 'D' | 'C';
  amount: string;
  balance_after: string;
  created_at: string;
}

// ───────────── Fase 3: Pago Móvil y retiros en Bs ─────────────

export const RELATIONSHIPS: Record<string, string> = {
  PADRE_MADRE: 'Padre / Madre',
  HIJO: 'Hijo / Hija',
  HERMANO: 'Hermano / Hermana',
  CONYUGE: 'Cónyuge / Pareja',
  ABUELO: 'Abuelo / Abuela',
  NIETO: 'Nieto / Nieta',
  TIO: 'Tío / Tía',
  SOBRINO: 'Sobrino / Sobrina',
  PRIMO: 'Primo / Prima',
  SUEGRO: 'Suegro / Suegra',
  CUNADO: 'Cuñado / Cuñada',
};

export interface Bank {
  code: string;
  name: string;
}

export interface PayoutAccount {
  id: string;
  alias: string;
  holderKind: 'SELF' | 'FAMILY';
  holderName: string;
  relationship: string | null;
  bankCode: string;
  bankName: string;
  phoneMasked: string;
  documentMasked: string;
  isDefault: boolean;
  status: 'ACTIVE' | 'INVALID';
  invalidReason: string | null;
  inUse: boolean;
}

export interface SmsChallenge {
  challengeId: string;
  expiresAt: string;
  maskedPhone: string;
  delivery: 'SMS' | 'DEMO_SCREEN';
  demoCode?: string;
}

export interface Quote {
  sourceCurrency: Currency;
  sourceAmount: string;
  payoutVes: string;
  rate: string | null;
  rateDate: string | null;
  minVes: string;
}

export interface Withdrawal {
  id: string;
  payout_ves: string;
  source_currency: Currency;
  source_amount: string;
  status: 'REQUESTED' | 'PAID' | 'REJECTED';
  reject_reason: string | null;
  paid_reference: string | null;
  created_at: string;
  rate: string | null;
  payoutTo: { alias: string; bank: string; phoneMasked: string; holderName: string; holderKind: 'SELF' | 'FAMILY' };
}

export const patch = <T = any>(path: string, body?: unknown) => api<T>('PATCH', path, body ?? {});
export const del = <T = any>(path: string) => api<T>('DELETE', path);
