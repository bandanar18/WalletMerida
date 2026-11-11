import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken, tryRefresh } from './api';

export interface LiveEvent {
  id: number;
  status: 'PENDING' | 'RELEASED' | 'REVERSED';
}

/**
 * Avisos en tiempo real de la Lotería (sala del usuario): comisión nueva, liberada o reversada,
 * cambio de saldo y nuevo referido. El aviso solo dice «algo cambió»: se vuelve a pedir el dato al API.
 */
export function useAgentRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const [last, setLast] = useState<LiveEvent | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let n = 0;
    const socket = io({ path: '/api/v1/socket.io', transports: ['websocket'], auth: (cb) => cb({ token: getAccessToken() }) });
    const refresh = () => qc.invalidateQueries({ queryKey: ['agent'] });
    socket.on('commission', (d: { status: LiveEvent['status'] }) => {
      refresh();
      setLast({ id: ++n, status: d.status });
    });
    socket.on('balance', refresh);
    socket.on('referral', refresh);
    socket.on('withdrawal', refresh);
    socket.on('payout-account', refresh);
    // Token vencido: renovar sesión y reconectar.
    socket.on('connect_error', async (err) => {
      if (err.message === 'UNAUTHENTICATED' && (await tryRefresh())) socket.connect();
    });
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') void tryRefresh().then((ok) => ok && socket.connect());
    });
    return () => {
      socket.close();
    };
  }, [enabled, qc]);

  return last;
}
