import { useQuery } from '@tanstack/react-query';
import { AgentProfile, AgentSummary, ApiError, Bank, Commission, get, Movement, PayoutAccount, Referral, Withdrawal } from './api';

/** Perfil de la agencia; null si el usuario aún no la activó. */
export function useAgent(enabled = true) {
  return useQuery({
    queryKey: ['agent', 'me'],
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        return await get<AgentProfile>('/agent/me');
      } catch (e) {
        if (e instanceof ApiError && e.code === 'AGENT_NOT_FOUND') return null;
        throw e;
      }
    },
  });
}

export const useSummary = () => useQuery({ queryKey: ['agent', 'summary'], queryFn: () => get<AgentSummary>('/agent/summary'), refetchInterval: 60_000 });

export const useCommissions = (limit = 30) =>
  useQuery({ queryKey: ['agent', 'commissions', limit], queryFn: () => get<{ items: Commission[]; nextCursor: string | null }>(`/agent/commissions?limit=${limit}`) });

export const useReferrals = () => useQuery({ queryKey: ['agent', 'referrals'], queryFn: () => get<Referral[]>('/agent/referrals') });

export const useMovements = () => useQuery({ queryKey: ['agent', 'movements'], queryFn: () => get<Movement[]>('/agent/movements?limit=100') });

export const useBanks = () => useQuery({ queryKey: ['banks'], queryFn: () => get<Bank[]>('/affiliate/banks'), staleTime: 3_600_000 });

export const useFxToday = () =>
  useQuery({ queryKey: ['fx', 'today'], queryFn: () => get<{ rate: string; rateE4: string; source: string; date: string } | null>('/affiliate/fx/today'), staleTime: 60_000 });

export const usePayoutAccounts = () => useQuery({ queryKey: ['agent', 'payout-accounts'], queryFn: () => get<PayoutAccount[]>('/agent/payout-accounts') });

export const useWithdrawals = () => useQuery({ queryKey: ['agent', 'withdrawals'], queryFn: () => get<Withdrawal[]>('/agent/withdrawals') });
