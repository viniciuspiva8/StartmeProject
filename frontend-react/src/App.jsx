import { Suspense, lazy } from 'react';
import { useApp } from './state/AppContext.jsx';
import Shell from './components/Shell.jsx';
import Portal from './views/Portal.jsx';
import Consent from './views/Consent.jsx';
import Home from './views/Home.jsx';
import Perfil from './views/Perfil.jsx';
import Certificados from './views/Certificados.jsx';
import Excecoes from './views/Excecoes.jsx';
import Lista from './views/Lista.jsx';
import Curriculo from './views/Curriculo.jsx';

// Painel administrativo: fora do pacote do aluno, carregado só quando alguém abre #/admin.
const Admin = lazy(() => import('./views/Admin.jsx'));

const TELAS = {
  portal: Portal,
  consent: Consent,
  inicio: Home,
  vagas: Lista,
  curriculo: Curriculo,
  perfil: Perfil,
  certificados: Certificados,
  excecao: Excecoes,
  admin: Admin,
};

export default function App() {
  const { s } = useApp();
  const Tela = TELAS[s.view] || Portal;
  return (
    <Shell>
      <Suspense fallback={<p className="p-6 text-sm text-tinta-3">Carregando…</p>}>
        <Tela />
      </Suspense>
    </Shell>
  );
}
