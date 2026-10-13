// Painel do administrador (#/admin). Não aparece no menu do aluno: é acessado pelo endereço.
// Mostra contagens e a trilha de auditoria. Nenhum dado pessoal de aluno aparece aqui.
import { useCallback, useEffect, useState } from 'react';
import { chamar } from '../lib/apiAluno.js';
import { CONFIG } from '../config.js';

const api = {
  entrar: (email, senha) => chamar('/api/admin/entrar', { metodo: 'POST', corpo: { email, senha }, timeout: 10000 }),
  sair: () => chamar('/api/admin/sair', { metodo: 'POST' }),
  resumo: () => chamar('/api/admin/resumo'),
  auditoria: () => chamar('/api/admin/auditoria?limite=50'),
  coleta: () => chamar('/api/admin/coleta', { metodo: 'POST', timeout: 60000 }),
};

const MENSAGEM = {
  credenciais_invalidas: 'E-mail ou senha não conferem.',
  muitas_tentativas: 'Muitas tentativas seguidas. Aguarde alguns minutos.',
  sessao_desativada: 'O painel está desligado neste ambiente (falta configuração do servidor).',
  sem_permissao: 'Sua conta é de leitura: não pode disparar coletas.',
  cota_insuficiente: 'A cota mensal da SerpApi não cobre uma coleta agora.',
  aguarde_para_coletar: 'Já houve uma coleta manual na última hora. Aguarde antes de disparar outra.',
  coleta_indisponivel: 'A coleta não está disponível neste ambiente.',
  rede: 'Não conseguimos falar com o servidor. Verifique a conexão.',
};

function textoErro(erro) {
  return MENSAGEM[erro?.codigo] || 'Algo não saiu como esperado. Tente de novo.';
}

export default function Admin() {
  const [admin, setAdmin] = useState(null); // { email, papel } quando logado
  const [verificando, setVerificando] = useState(true);
  const [resumo, setResumo] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const [r, ev] = await Promise.all([api.resumo(), api.auditoria()]);
    setResumo(r);
    setEventos(ev);
    setAdmin({ email: r.email, papel: r.papel });
  }, []);

  useEffect(() => {
    let ativo = true;
    carregar()
      .catch(() => { if (ativo) setAdmin(null); })
      .finally(() => { if (ativo) setVerificando(false); });
    return () => { ativo = false; };
  }, [carregar]);

  const entrar = async (evento) => {
    evento.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      await api.entrar(email.trim(), senha);
      setSenha('');
      await carregar();
    } catch (e) {
      setErro(textoErro(e));
    } finally {
      setOcupado(false);
    }
  };

  const sair = async () => {
    await api.sair().catch(() => {});
    setAdmin(null);
    setResumo(null);
    setEventos([]);
  };

  const coletar = async () => {
    if (!window.confirm('Uma coleta gasta até 16 buscas da cota mensal da SerpApi. Continuar?')) return;
    setAviso(null);
    setOcupado(true);
    try {
      const r = await api.coleta();
      setAviso(`Coleta concluída: ${r.vagas_novas} novas, ${r.vagas_renovadas} renovadas, ${r.cards_encontrados ?? '—'} encontradas.`);
      await carregar();
    } catch (e) {
      setAviso(textoErro(e));
    } finally {
      setOcupado(false);
    }
  };

  if (verificando) return <p className="p-6 text-sm text-tinta-3">Verificando acesso…</p>;

  if (!admin) {
    return (
      <main className="mx-auto flex max-w-[440px] flex-col gap-4 px-4 py-10 sm:px-6">
        <h1 className="font-serif text-[26px] font-bold text-tinta">Painel administrativo</h1>
        <p className="text-sm text-tinta-2">Acesso restrito à equipe do StartMe.</p>
        <form onSubmit={entrar} className="flex flex-col gap-3 rounded-2xl border border-linha bg-white p-5">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-tinta-2">
            E-mail
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 rounded-xl border border-linha-forte px-3 text-[16px] text-tinta" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-tinta-2">
            Senha
            <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)}
              className="min-h-11 rounded-xl border border-linha-forte px-3 text-[16px] text-tinta" />
          </label>
          {erro && <p role="alert" className="rounded-xl bg-erro-fundo px-3 py-2.5 text-sm text-erro">{erro}</p>}
          <button type="submit" disabled={ocupado || !email || !senha} className="btn-primario min-h-12">
            {ocupado ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </main>
    );
  }

  const podeColetar = admin.papel === 'admin';
  const pctCota = resumo ? Math.min(100, Math.round((resumo.cota.usadas / resumo.cota.limite) * 100)) : 0;

  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-[26px] font-bold text-tinta">Painel administrativo</h1>
          <p className="text-sm text-tinta-3">{admin.email} · papel {admin.papel}</p>
        </div>
        <button type="button" onClick={sair} className="btn-claro min-h-11">Sair do painel</button>
      </header>

      {aviso && <p role="status" className="rounded-xl bg-nevoa px-4 py-3 text-sm text-azul">{aviso}</p>}

      {resumo && (
        <section aria-label="Resumo" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-linha bg-white p-4">
            <p className="text-xs font-semibold text-tinta-3">Vagas ativas</p>
            <p className="mt-1 font-serif text-3xl font-bold text-tinta">{resumo.vagas}</p>
            <p className="mt-1 text-xs text-tinta-3">Última coleta: {resumo.ultima_coleta || 'nenhuma ainda'}</p>
          </div>
          <div className="rounded-2xl border border-linha bg-white p-4">
            <p className="text-xs font-semibold text-tinta-3">Cota SerpApi neste mês</p>
            <p className="mt-1 font-serif text-3xl font-bold text-tinta">{resumo.cota.usadas} / {resumo.cota.limite}</p>
            <div className="mt-2 h-2 rounded-full bg-papel-2" aria-hidden="true">
              <div className="h-2 rounded-full bg-azul-500" style={{ width: `${pctCota}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border border-linha bg-white p-4">
            <p className="text-xs font-semibold text-tinta-3">Autorizações de dados</p>
            <p className="mt-1 font-serif text-3xl font-bold text-tinta">{resumo.consentimentos.ativos}</p>
            <p className="mt-1 text-xs text-tinta-3">de {resumo.consentimentos.total} alunos que já passaram pelo login</p>
          </div>
        </section>
      )}

      <section aria-labelledby="coleta-titulo" className="rounded-2xl border border-linha bg-white p-5">
        <h2 id="coleta-titulo" className="font-serif text-xl font-bold text-tinta">Coleta de vagas</h2>
        <p className="mt-1 text-sm text-tinta-2">
          A coleta roda sozinha às terças e sextas. Use o botão só quando precisar de vagas novas agora.
        </p>
        <button type="button" onClick={coletar} disabled={!podeColetar || ocupado} className="btn-primario mt-4 min-h-12">
          {podeColetar ? 'Disparar coleta agora' : 'Coleta: apenas papel admin'}
        </button>
      </section>

      <section aria-labelledby="auditoria-titulo" className="rounded-2xl border border-linha bg-white p-5">
        <h2 id="auditoria-titulo" className="font-serif text-xl font-bold text-tinta">Auditoria recente</h2>
        {eventos.length === 0 ? (
          <p className="mt-2 text-sm text-tinta-3">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs text-tinta-3">
                <tr><th className="py-2 pr-3 font-semibold">Quando</th><th className="py-2 pr-3 font-semibold">Evento</th><th className="py-2 font-semibold">Quem</th></tr>
              </thead>
              <tbody>
                {eventos.map((e, i) => (
                  <tr key={`${e.quando}-${i}`} className="border-t border-linha">
                    <td className="py-2 pr-3 text-tinta-2">{e.quando.replace('T', ' ').slice(0, 19)}</td>
                    <td className="py-2 pr-3 text-tinta">{e.evento}</td>
                    <td className="py-2 text-tinta-2">{e.ator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-tinta-3">Servidor: {CONFIG.COLETOR_URL}</p>
    </main>
  );
}
