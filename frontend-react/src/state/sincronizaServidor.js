// Sincroniza currículo e marcações com o servidor quando o aluno tem sessão.
// Sem sessão, nada muda: tudo continua no localStorage, como antes.
//
// - Ao entrar: se o servidor já tem currículo, ele vence; se não tem e o navegador tem, o navegador envia (migração).
// - Ao editar: salva com atraso (800 ms), com a versão conhecida (controle otimista).
// - Conflito (outra aba salvou antes): carrega a versão do servidor e avisa, sem sobrescrever em silêncio.
import { useEffect, useRef } from 'react';
import { apiAluno } from '../lib/apiAluno.js';

const ATRASO = 800;

export function useSincronizacaoServidor(s, mostrarToast, set) {
  const logado = !!s.sessao;
  const versao = useRef(null); // versão do currículo conhecida no servidor (null = ainda não carregou)
  const ultimoCurriculo = useRef(null); // JSON do que o servidor tem
  const ultimasMarcacoes = useRef(null);

  // 1) Carrega do servidor ao obter a sessão.
  useEffect(() => {
    if (!logado) {
      versao.current = null;
      ultimoCurriculo.current = null;
      ultimasMarcacoes.current = null;
      return undefined;
    }
    let ativo = true;
    (async () => {
      try {
        const [cv, marc] = await Promise.all([apiAluno.curriculoObter(), apiAluno.marcacoesObter()]);
        if (!ativo) return;
        versao.current = cv.versao;
        const temServidor = Object.keys(cv.dados).length > 0;
        if (temServidor) {
          ultimoCurriculo.current = JSON.stringify(cv.dados);
          set({ curriculo: cv.dados });
        } else {
          ultimoCurriculo.current = null; // o navegador envia o que tiver (migração)
        }
        const temMarcacoes = marc.salvas.length > 0 || marc.aplicadas.length > 0;
        if (temMarcacoes) {
          ultimasMarcacoes.current = JSON.stringify({ salvas: marc.salvas, aplicadas: marc.aplicadas });
          set({ salvas: marc.salvas, aplicadas: marc.aplicadas });
        } else {
          ultimasMarcacoes.current = null; // o navegador envia as suas (migração)
        }
      } catch {
        mostrarToast('Não conseguimos carregar seu currículo do servidor. Usando a cópia deste navegador.');
      }
    })();
    return () => { ativo = false; };
  }, [logado, mostrarToast, set]);

  // 2) Salva o currículo quando muda.
  useEffect(() => {
    if (!logado || versao.current === null) return undefined;
    const json = JSON.stringify(s.curriculo);
    if (json === ultimoCurriculo.current) return undefined;
    const relogio = setTimeout(async () => {
      try {
        const r = await apiAluno.curriculoSalvar(s.curriculo, versao.current);
        versao.current = r.versao;
        ultimoCurriculo.current = json;
      } catch (erro) {
        if (erro.codigo === 'versao_conflito') {
          const atual = await apiAluno.curriculoObter().catch(() => null);
          if (atual) {
            versao.current = atual.versao;
            ultimoCurriculo.current = JSON.stringify(atual.dados);
            set({ curriculo: atual.dados });
          }
          mostrarToast('Seu currículo foi alterado em outra janela. Carregamos a versão mais recente.');
        } else if (erro.codigo === 'curriculo_grande') {
          mostrarToast('Seu currículo ficou grande demais para salvar. Reduza o texto de algum campo.');
        } else {
          mostrarToast('Não conseguimos salvar seu currículo agora. Ele continua salvo neste navegador.');
        }
      }
    }, ATRASO);
    return () => clearTimeout(relogio);
  }, [s.curriculo, logado, mostrarToast, set]);

  // 3) Salva as marcações (salvas e candidaturas).
  useEffect(() => {
    if (!logado) return undefined;
    const json = JSON.stringify({ salvas: s.salvas, aplicadas: s.aplicadas });
    if (json === ultimasMarcacoes.current) return undefined;
    const relogio = setTimeout(async () => {
      try {
        await apiAluno.marcacoesSalvar(s.salvas, s.aplicadas);
        ultimasMarcacoes.current = json;
      } catch {
        mostrarToast('Não conseguimos salvar suas marcações agora. Elas continuam neste navegador.');
      }
    }, ATRASO);
    return () => clearTimeout(relogio);
  }, [s.salvas, s.aplicadas, logado, mostrarToast]);
}
