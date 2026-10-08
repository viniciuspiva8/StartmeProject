// Painel lateral "Notas de design": registra, tela a tela, a decisão e o porquê.
// É material da monografia e da banca, não enfeite; por isso fica fora do fluxo
// principal e só aparece quando alguém pede.
import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppContext.jsx';
import Icone from './Icone.jsx';

const NOTAS = {
  portal: {
    titulo: 'Portal acadêmico simulado (Prancha 1)',
    itens: [
      ['Login e portal numa tela só.', 'Segue o redesenho real do portal.fsa.br: CPF, senha e atalhos no mesmo lugar. A antiga Prancha 2 deixou de existir como etapa separada.'],
      ['Simulação, nunca clone.', 'A faixa de ambiente simulado é permanente e as credenciais de demonstração ficam visíveis. Um clone funcional de tela de login de terceiros seria risco de captura de credencial.'],
      ['Ícones genéricos.', 'Os atalhos usam pictogramas próprios, sem reproduzir marcas de fornecedores.'],
    ],
  },
  consent: {
    titulo: 'Consentimento e transferência de dados (Prancha 3)',
    itens: [
      ['A minimização vira tela.', 'Quatro dados concedidos, cada um com a finalidade declarada, e seis explicitamente negados. É o artefato visual do capítulo de LGPD.'],
      ['Recusar é um caminho, não um beco.', '"Não autorizar" tem o mesmo peso de leitura que "Autorizar" e devolve o aluno ao portal com uma explicação.'],
      ['Duas colunas no desktop.', 'O que é compartilhado e o que nunca é ficam lado a lado para a comparação ser imediata.'],
    ],
  },
  inicio: {
    titulo: 'Início do aluno (Prancha 4)',
    itens: [
      ['A saudação é a prova da integração.', 'Nome, curso e semestre chegam do Portal Acadêmico; o aluno não preenche perfil.'],
      ['Frase, não painel de números.', 'As contagens que importam hoje viram uma frase. Cartões de número grande diziam pouco e ocupavam a primeira dobra.'],
      ['O que falta no currículo, a partir das vagas.', 'A lista de habilidades pedidas como obrigatórias e ausentes no currículo transforma o match em ação: o aluno sabe o que estudar ou declarar.'],
    ],
  },
  vagas: {
    titulo: 'Busca, triagem e detalhe (Pranchas 5 a 7)',
    itens: [
      ['A pergunta que a tela responde.', '"Vale a pena eu abrir esta vaga?" O veredito e a principal ressalva vêm logo abaixo do título, antes de salário e local.'],
      ['Match com o currículo, não com o curso.', 'Cada requisito do anúncio é comparado com o currículo do aluno: disciplinas cursadas, certificações, atividades e habilidades declaradas. O detalhe mostra de onde veio cada requisito atendido.'],
      ['Critérios no lugar de percentual.', 'O medidor tem um segmento por requisito obrigatório ou condição da vaga. A contagem vai em texto. Diferenciais aparecem, mas não pesam contra. Nenhuma pontuação opaca.'],
      ['"Eu sei X" pede contexto, não só um clique.', 'O botão leva ao currículo com o formulário da habilidade aberto e o nome preenchido. O aluno informa nível, onde aprendeu, ano e, se quiser, anexa o certificado. Um clique só gerava habilidades sem lastro no currículo exportado.'],
      ['O match reage na hora.', 'Ao salvar a habilidade ou uma certificação, a avaliação é recalculada no navegador, o aviso diz quantas vagas mudaram e oferece voltar para a vaga de onde o aluno saiu.'],
      ['Lista no centro; detalhe só quando o aluno pede.', 'A triagem acontece na lista: cada cartão mostra veredito, a principal ressalva e o que a vaga pede marcado contra o currículo, sem precisar abrir. Ao clicar, a lista vira coluna e o detalhe abre ao lado, para comparar sem perder o lugar; fechar (botão, Esc ou Voltar) devolve a lista ao centro e o foco ao cartão. No celular, o detalhe abre em tela cheia.'],
      ['A candidatura acontece fora.', 'O StartMe reúne as vagas e indica o melhor match; o processo seletivo é no site de origem. "Já me candidatei" é só uma anotação do aluno, sem acompanhamento de etapas.'],
      ['Vaga real sem requisitos extraídos.', 'Fica em "sem dados para avaliar" em vez de estimar. A extração de requisitos dos anúncios é trabalho do coletor.'],
      ['"Coletada", nunca "publicada".', 'data_coleta é a data da captura, não da empresa.'],
    ],
  },
  curriculo: {
    titulo: 'Meu currículo',
    itens: [
      ['O currículo é o centro do produto.', 'Tudo o que o aluno sobe (certificações, atividades acadêmicas, voluntariado) melhora o currículo e o match com as vagas ao mesmo tempo.'],
      ['Formação verdadeira por construção.', 'Nome, curso e semestre vêm do Portal Acadêmico e não são editáveis; as disciplinas cursadas viram habilidades automaticamente.'],
      ['Comprovada, cursada ou adicionada.', 'As habilidades guardam a origem. O match explica com o que é mais forte: certificado e atividade antes de disciplina, disciplina antes de habilidade adicionada sem certificado. A adicionada traz nível e onde foi aprendida, que aparecem no currículo exportado.'],
      ['Editar ao lado do resultado.', 'A prévia mostra o currículo como a empresa vê, e é exatamente o que sai no PDF exportado pelo navegador.'],
      ['Sem backend ainda.', 'O currículo fica guardado no navegador e o arquivo do certificado não é enviado. Os contratos GET/PATCH /api/aluno/me e POST /api/aluno/curriculo continuam pendentes.'],
    ],
  },
};

export default function NotasDrawer() {
  const { s, a } = useApp();
  const painelRef = useRef(null);
  const notas = NOTAS[s.view] || NOTAS.portal;

  useEffect(() => {
    if (!s.notasAbertas) return undefined;
    painelRef.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') a.fecharNotas(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [s.notasAbertas, a]);

  if (!s.notasAbertas) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-azul/40" onClick={a.fecharNotas} aria-hidden="true" />
      <aside
        ref={painelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notas-titulo"
        className="absolute inset-y-0 right-0 flex w-full max-w-md animate-entra flex-col overflow-y-auto bg-azul text-white shadow-flutuante focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-2">
          <div>
            <p className="text-[13px] text-agua-claro">Notas de design</p>
            <h2 id="notas-titulo" className="mt-1 font-serif text-2xl leading-tight font-bold">{notas.titulo}</h2>
          </div>
          <button type="button" onClick={a.fecharNotas} aria-label="Fechar notas" className="grid size-10 flex-none cursor-pointer place-items-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white">
            <Icone nome="fechar" size={20} />
          </button>
        </div>
        <ul className="flex flex-col gap-5 p-6 text-sm leading-relaxed text-white/80">
          {notas.itens.map(([titulo, texto]) => (
            <li key={titulo}>
              <p className="font-bold text-white">{titulo}</p>
              <p className="mt-1">{texto}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
