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

const TELAS = {
  portal: Portal,
  consent: Consent,
  inicio: Home,
  vagas: Lista,
  curriculo: Curriculo,
  perfil: Perfil,
  certificados: Certificados,
  excecao: Excecoes,
};

export default function App() {
  const { s } = useApp();
  const Tela = TELAS[s.view] || Portal;
  return (
    <Shell>
      <Tela />
    </Shell>
  );
}
