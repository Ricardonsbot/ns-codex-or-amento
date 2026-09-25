import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from './ToastProvider'
import { lerCadastrosEmWorker } from '../lib/importarTemplateOrcamento'
import { executarCarga, planejarCarga } from '../lib/cargaCadastros'

/**
 * Carga dos cadastros a partir do próprio template.
 *
 * O Template Budget 2027 traz a aba "Mapa Fornecedores", que é a lista
 * oficial de pacote, subpacote e agrupamento de fornecedor. Até aqui isso era
 * digitado à mão em Cadastros e vivia desencontrado do que chegava na Base
 * Gastos — que é justamente o que faz o checklist da importação acusar
 * "pacote fora do cadastro".
 *
 * A carga só acrescenta o que falta. O que já existe fica como está; a única
 * coisa que ela mexe em cadastro antigo é preencher grupo ou CNPJ vazios.
 */

const TABELAS = [
  { id: 'pacote', rotulo: 'Pacotes', onde: '/cadastros/pacotes' },
  { id: 'subpacote', rotulo: 'Subpacotes', onde: '/cadastros/subpacotes' },
  { id: 'grupo', rotulo: 'Grupos de fornecedor', onde: '/cadastros/grupos-de-fornecedor' },
  { id: 'fornecedor', rotulo: 'Fornecedores', onde: '/cadastros/fornecedores' },
]

export default function CargaCadastros({ arquivo, nomeArquivo }) {
  const showToast = useToast()
  const [lendo, setLendo] = useState(false)
  const [lido, setLido] = useState(null)
  const [plano, setPlano] = useState(null)
  const [erro, setErro] = useState(null)
  const [incluirMarcadores, setIncluirMarcadores] = useState(false)
  const [selecao, setSelecao] = useState({ pacote: true, subpacote: true, grupo: true, fornecedor: true })
  const [gravando, setGravando] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [feito, setFeito] = useState(null)

  async function conferir(marcadores = incluirMarcadores, jaLido = lido) {
    setErro(null)
    setFeito(null)
    setLendo(true)
    try {
      // A leitura acontece uma vez; reconferir só refaz o plano contra o banco.
      const dados = jaLido ?? (await lerCadastrosEmWorker(await arquivo.arrayBuffer()))
      setLido(dados)
      setPlano(await planejarCarga(dados, { incluirMarcadores: marcadores }))
    } catch (err) {
      setErro(err.message)
    } finally {
      setLendo(false)
    }
  }

  async function trocarMarcadores(valor) {
    setIncluirMarcadores(valor)
    if (lido) await conferir(valor, lido)
  }

  async function carregar() {
    setGravando(true)
    setProgresso(null)
    try {
      const r = await executarCarga(plano, selecao, (f, t, tabela) => setProgresso({ f, t, tabela }))
      setFeito(r)
      showToast('Cadastros carregados a partir do template.', 'success')
      await conferir(incluirMarcadores, lido)
    } catch (err) {
      showToast(`A carga parou: ${err.message}`, 'error')
      setErro(err.message)
    } finally {
      setGravando(false)
      setProgresso(null)
    }
  }

  const indisponiveis = plano ? TABELAS.filter((t) => !plano.disponivel[t.id]) : []
  const totalNovos = plano
    ? TABELAS.reduce((a, t) => a + (selecao[t.id] ? plano[t.id].novos.length : 0), 0) +
      (selecao.fornecedor ? plano.fornecedor.completar.length : 0)
    : 0

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header">
        <div>
          <h2>📇 Cadastros do template</h2>
          <p>
            A aba Mapa Fornecedores deste arquivo é a lista oficial de pacote, subpacote e agrupamento de fornecedor —
            dá para carregar direto dela, em vez de digitar.
          </p>
        </div>
        {!plano && (
          <button className="btn btn-primary btn-sm" type="button" onClick={() => conferir()} disabled={lendo}>
            {lendo ? 'Lendo as abas de cadastro…' : 'Conferir cadastros deste template'}
          </button>
        )}
      </div>

      <div className="panel-body">
        {erro && <div className="proto-banner">✕ {erro}</div>}

        {lido && (
          <p style={{ fontSize: 12, opacity: 0.8, marginTop: 0 }}>
            {lido.linhas.toLocaleString('pt-BR')} linhas no mapa de {nomeArquivo}.
            {lido.temErp
              ? ' O CNPJ de cada fornecedor vem da aba ERP do mesmo arquivo.'
              : ' Este arquivo não tem a aba ERP, então os fornecedores entram sem CNPJ.'}
          </p>
        )}

        {indisponiveis.length > 0 && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ✕ {indisponiveis.map((t) => t.rotulo).join(', ')} ainda não{' '}
            {indisponiveis.length === 1 ? 'existe' : 'existem'} no banco — falta rodar
            supabase/migrations/2026-09-22-historico-de-importacao.sql. O resto pode ser carregado agora.
          </div>
        )}

        {plano?.fornecedor?.semColunaGrupo && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ⓘ Os fornecedores entram, mas sem o grupo: a coluna ainda não existe na tabela. Depois da migração, rode a
            carga de novo e ela preenche o grupo de quem já estiver cadastrado.
          </div>
        )}

        {plano?.marcadoresFora?.length > 0 && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ⓘ {plano.marcadoresFora.join(' e ')} {plano.marcadoresFora.length === 1 ? 'ficou' : 'ficaram'} de fora: no
            mapa {plano.marcadoresFora.length === 1 ? 'é marcador' : 'são marcadores'} de "ainda não classificado", não
            nome de pacote ou de grupo.
          </div>
        )}

        {plano && (
          <>
            <div className="rolagem-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }} />
                    <th>CADASTRO</th>
                    <th className="text-right">NO TEMPLATE</th>
                    <th className="text-right">JÁ EXISTEM</th>
                    <th className="text-right">ENTRAM</th>
                    <th>EXEMPLO DO QUE ENTRA</th>
                  </tr>
                </thead>
                <tbody>
                  {TABELAS.map((t) => {
                    const p = plano[t.id]
                    const amostra = p.novos
                      .slice(0, 3)
                      .map((x) => (typeof x === 'string' ? x : x.nome))
                      .join(', ')
                    return (
                      <tr key={t.id} style={{ opacity: plano.disponivel[t.id] ? 1 : 0.5 }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={Boolean(selecao[t.id] && plano.disponivel[t.id])}
                            disabled={!plano.disponivel[t.id] || !p.novos.length}
                            onChange={(e) => setSelecao({ ...selecao, [t.id]: e.target.checked })}
                          />
                        </td>
                        <td>
                          <Link to={t.onde}>{t.rotulo}</Link>
                          {t.id === 'fornecedor' && p.completar.length > 0 && (
                            <div style={{ fontSize: 12, opacity: 0.8 }}>
                              + {p.completar.length} já cadastrados ganham grupo ou CNPJ que estava vazio
                            </div>
                          )}
                        </td>
                        <td className="text-right">{p.novos.length + p.jaExistem}</td>
                        <td className="text-right">{p.jaExistem}</td>
                        <td className="text-right">
                          <strong>{p.novos.length}</strong>
                        </td>
                        <td style={{ fontSize: 12, opacity: 0.8 }}>{amostra || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <label style={{ display: 'block', marginTop: 10, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={incluirMarcadores}
                onChange={(e) => trocarMarcadores(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Cadastrar também Refinar e Cadastrar
            </label>

            {feito && (
              <div className="proto-banner" style={{ marginTop: 12 }}>
                ✓ Entraram {feito.pacote} pacote(s), {feito.subpacote} subpacote(s), {feito.grupo} grupo(s) e{' '}
                {feito.fornecedor} fornecedor(es).
                {feito.completados > 0 && ` ${feito.completados} fornecedor(es) ganharam grupo ou CNPJ.`}
              </div>
            )}

            <div className="flex-row" style={{ gap: 10, marginTop: 12, alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                type="button"
                onClick={carregar}
                disabled={gravando || lendo || !totalNovos}
              >
                {gravando
                  ? 'Carregando…'
                  : totalNovos
                  ? `Carregar ${totalNovos} cadastro(s)`
                  : 'Nada novo para carregar'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => conferir()}
                disabled={gravando || lendo}
              >
                Reconferir
              </button>
              {progresso && (
                <span style={{ fontSize: 12 }}>
                  {progresso.tabela}: {progresso.f} de {progresso.t}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
