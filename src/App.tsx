import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Button, DemoBanner, ErrorBox, Loading } from './components/ui';
import { useAuth } from './lib/auth';
import { LOTERIA_URL } from './lib/format';
import { useAgent } from './lib/queries';
import { ActivatePage } from './pages/Activate';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { MovementsPage } from './pages/Movements';
import { MyCodePage } from './pages/MyCode';
import { PayoutAccountsPage, PayoutEditRoute, PayoutFormPage } from './pages/PayoutAccounts';
import { WithdrawPage } from './pages/Withdraw';
import { ReferralsPage } from './pages/Referrals';
import { RegisterAgencyPage } from './pages/RegisterAgency';

function EditRoute() {
  const { id = '' } = useParams();
  return <PayoutEditRoute key={id} id={id} />;
}

export function App() {
  const { user, ready, logout } = useAuth();
  const isPlayer = user?.kind === 'PLAYER';
  const agent = useAgent(isPlayer);
  const onRegister = useLocation().pathname.replace(/\/$/, '') === '/registro';

  if (!ready) return <Loading />;
  // /registro: alta de AGENCIA ONLINE (cuenta + agencia en un paso), enlazada desde la web del Instituto.
  if (onRegister) {
    if (!isPlayer) return <RegisterAgencyPage staffSession={user?.kind === 'STAFF'} />;
    if (agent.isLoading) return <Loading />;
    if (agent.data) return <Navigate to="/" replace />;
  }
  if (!user) return <LoginPage />;
  if (!isPlayer) {
    return (
      <div className="mx-auto max-w-md">
        <DemoBanner />
        <div className="space-y-4 p-6">
          <p className="text-lg font-bold text-brand-900">La Wallet de Agencias es para jugadores.</p>
          <p className="text-slate-600">Las cuentas del personal administran las agencias desde el backoffice de la Lotería.</p>
          <a href={`${LOTERIA_URL}/admin`} className="block font-semibold text-brand-700 underline">
            Ir al backoffice
          </a>
          <Link to="/registro" className="block font-semibold text-brand-700 underline">
            Registrar una agencia online
          </Link>
          <Button variant="ghost" onClick={() => void logout()}>
            Salir
          </Button>
        </div>
      </div>
    );
  }
  if (agent.isLoading) return <Loading />;
  if (agent.error) return <div className="p-6"><ErrorBox error={agent.error} /></div>;
  if (!agent.data) return <ActivatePage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="codigo" element={<MyCodePage />} />
        <Route path="referidos" element={<ReferralsPage />} />
        <Route path="movimientos" element={<MovementsPage />} />
        <Route path="retirar" element={<WithdrawPage />} />
        <Route path="pago-movil" element={<PayoutAccountsPage />} />
        <Route path="pago-movil/nuevo" element={<PayoutFormPage />} />
        <Route path="pago-movil/:id/editar" element={<EditRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
