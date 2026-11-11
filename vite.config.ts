import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * Wallet de Agencias: app aparte (puerto 5174) conectada a la API de la Lotería.
 * En desarrollo, /api se reenvía a la API de la Lotería (LOTERIA_API_URL), así la cookie de sesión
 * y el WebSocket funcionan sin CORS. En producción, un proxy inverso hace lo mismo.
 */
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.LOTERIA_API_URL || 'http://localhost:3000';

  // Accesos rápidos de prueba (cuentas DEMO con dinero ficticio).
  // `vite dev`: cuentas sembradas de la Lotería local (SEED_*).
  // `vite build`: cuentas DEMO del servidor publicado (DEMO_* en .env.production.local, fuera de git); sin ellas, no hay accesos.
  const seed = command === 'serve' ? loadEnv('development', env.LOTERIA_API_ENV_DIR || '../Loteria/apps/api', 'SEED_') : {};
  const playerEmail = command === 'serve' ? seed.SEED_PLAYER_EMAIL : env.DEMO_PLAYER_EMAIL;
  const playerPassword = command === 'serve' ? seed.SEED_PLAYER_PASSWORD : env.DEMO_PLAYER_PASSWORD;
  const testPassword = command === 'serve' ? seed.SEED_TEST_PLAYERS_PASSWORD : env.DEMO_TEST_PLAYERS_PASSWORD;
  const devLogins = [
    { label: 'Jugador', email: playerEmail, password: playerPassword },
    ...[1, 2, 3].map((n) => ({ label: `Prueba ${n}`, email: `prueba${n}@fortunabet.test`, password: testPassword })),
  ].filter((l) => l.email && l.password);

  return {
    plugins: [react(), tailwindcss()],
    define: { __DEV_LOGINS__: JSON.stringify(devLogins) },
    server: {
      port: 5174,
      strictPort: true,
      proxy: { '/api': { target: apiTarget, ws: true } },
    },
  };
});
