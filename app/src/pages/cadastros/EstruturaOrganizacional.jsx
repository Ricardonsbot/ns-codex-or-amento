import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useToast } from '../../components/ToastProvider'
import ImportExportBar from '../../components/ImportExportBar'
import { fetchAll, criar, atualizar, remover } from '../../lib/cadastroSimplesData'
import { MODULOS, nomeArquivoExportacao } from '../../lib/modulos'

const ICONES = { bu: '🏢', torre: '🏗️', sub_torre: '📂', empresa: '🏬' }

// Combina as 4 listas planas (bu/torre/sub_torre/empresa) numa árvore, preservando a
// ordem de cadastro (criado_em) em cada nível — não ordem alfabética.
function construirArvore(bus, torres, subTorres, empresas) {
  const normalizar = (lista, tipo) => lista.map((item) => ({ ...item, tipo, filhos: [] }))
  const nosBu = normalizar(bus, 'bu')
  const nosTorre = normalizar(torres, 'torre')
  const nosSub = normalizar(subTorres, 'sub_torre')
  const nosEmpresa = normalizar(empresas, 'empresa')

  const porId = new Map([...nosBu, ...nosTorre, ...nosSub, ...nosEmpresa].map((no) => [no.id, no]))

  for (const t of nosTorre) porId.get(t.bu_id)?.filhos.push(t)
  for (const s of nosSub) porId.get(s.torre_id)?.filhos.push(s)
  for (const e of nosEmpresa) {
    const paiId = e.sub_torre_id || e.torre_id || e.bu_id
    porId.get(paiId)?.filhos.push(e)
  }

  const porCriacao = (a, b) => new Date(a.criado_em) - new Date(b.criado_em)
  for (const no of porId.values()) no.filhos.sort(porCriacao)

  return nosBu.sort(porCriacao)
}

function NoArvore({ no, nivel, expandidos, alternar }) {
  const temFilhos = no.filhos.length > 0
  const aberto = expandidos.has(no.id)
  return (
    <div>
      <div
        className="nav-item"
        style={{ paddingLeft: 12 + nivel * 22, cursor: temFilhos ? 'pointer' : 'default', margin: '2px 0' }}
        onClick={() => temFilhos && alternar(no.id)}
      >
        <span style={{ display: 'inline-block', width: 16, textAlign: 'center' }}>{temFilhos ? (aberto ? '▾' : '▸') : '·'}</span>
        <span className="nav-icon">{ICONES[no.tipo]}</span> <span className="nav-label">{no.nome}</span>
        {no.codigo && <span className="text-muted"> · {no.codigo}</span>}
      </div>
      {aberto && no.filhos.map((filho) => (
        <NoArvore key={filho.id} no={filho} nivel={nivel + 1} expandidos={expandidos} alternar={alternar} />
      ))}
    </div>
  )
}

function SecaoNivel({ titulo, tabela, itens, paisConfig, onRecarregar, showToast, nomeArquivo }) {
  const vazio = () => ({ nome: '', codigo: '', ...Object.fromEntries(paisConfig.map((p) => [p.key, ''])) })
  const [novo, setNovo] = useState(vazio())
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [rascunho, setRascunho] = useState(vazio())

  function montarPayload(valores) {
    const payload = { nome: valores.nome, codigo: valores.codigo || null }
    paisConfig.forEach((p) => { payload[p.key] = valores[p.key] || null })
    return payload
  }

  async function handleAdicionar(e) {
    e.preventDefault()
    if (!novo.nome.trim()) {
      showToast('Preencha o Nome.', 'warning')
      return
    }
    const faltando = paisConfig.filter((p) => p.obrigatorio && !novo[p.key])
    if (faltando.length) {
      showToast(`Selecione: ${faltando.map((p) => p.label).join(', ')}`, 'warning')
      return
    }
    setSalvando(true)
    try {
      await criar(tabela, montarPayload(novo))
      setNovo(vazio())
      showToast(`${titulo} cadastrado(a).`, 'success')
      onRecarregar()
    } catch (err) {
      showToast(`Erro ao cadastrar ${titulo.toLowerCase()}: ${err.message}`, 'error')
    } finally {
      setSalvando(false)
    }
  }

  function nomePai(item, p) {
    return p.opcoes.find((o) => o.id === item[p.key])?.nome ?? '—'
  }

  function iniciarEdicao(item) {
    setEditandoId(item.id)
    setRascunho({ nome: item.nome, codigo: item.codigo ?? '', ...Object.fromEntries(paisConfig.map((p) => [p.key, item[p.key] ?? ''])) })
  }

  async function salvarEdicao(id) {
    try {
      await atualizar(tabela, id, montarPayload(rascunho))
      setEditandoId(null)
      showToast('Atualizado.', 'success')
      onRecarregar()
    } catch (err) {
      showToast(`Erro ao atualizar: ${err.message}`, 'error')
    }
  }

  async function handleExcluir(item) {
    const avisos = {
      bu: ' Isso apaga TODAS as torres, sub torres e empresas dessa BU.',
      torre: ' Sub torres dessa torre também serão apagadas; empresas ligadas a ela ficam sem torre.',
      sub_torre: ' Empresas ligadas a essa sub torre ficam sem sub torre (não são apagadas).',
      empresa: '',
    }
    if (!window.confirm(`Excluir "${item.nome}"?${avisos[tabela] ?? ''}`)) return
    try {
      await remover(tabela, item.id)
      showToast('Excluído.', 'success')
      onRecarregar()
    } catch (err) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const colunasExport = [{ key: 'nome' }, { key: 'codigo' }, ...paisConfig.map((p) => ({ key: p.key }))]

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>{titulo}</h2>
          <p>{itens.length} registro(s)</p>
        </div>
        <ImportExportBar
          nomeArquivo={nomeArquivo}
          colunas={colunasExport}
          dados={itens}
          onImportarLinha={async (linha) => {
            if (!linha.nome?.trim()) throw new Error('faltando nome')
            return criar(tabela, montarPayload(linha))
          }}
          onImportConcluido={onRecarregar}
          showToast={showToast}
        />
      </div>
      <div className="panel-body">
        <form onSubmit={handleAdicionar} className="filter-bar" style={{ marginBottom: 16 }}>
          <div className="filter-field">
            <label>Nome</label>
            <input value={novo.nome} onChange={(e) => setNovo((v) => ({ ...v, nome: e.target.value }))} />
          </div>
          <div className="filter-field">
            <label>Código (ID_{titulo.replace(' ', '')})</label>
            <input value={novo.codigo} onChange={(e) => setNovo((v) => ({ ...v, codigo: e.target.value }))} />
          </div>
          {paisConfig.map((p) => (
            <div className="filter-field" key={p.key}>
              <label>{p.label}</label>
              <select value={novo[p.key]} onChange={(e) => setNovo((v) => ({ ...v, [p.key]: e.target.value }))}>
                <option value="">{p.obrigatorio ? 'Selecione…' : '— (nenhum)'}</option>
                {p.opcoes.map((o) => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>
          ))}
          <button className="btn btn-primary" type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Adicionar'}
          </button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Código</th>
                {paisConfig.map((p) => <th key={p.key}>{p.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) =>
                editandoId === item.id ? (
                  <tr key={item.id}>
                    <td><input value={rascunho.nome} onChange={(e) => setRascunho((v) => ({ ...v, nome: e.target.value }))} /></td>
                    <td><input value={rascunho.codigo} onChange={(e) => setRascunho((v) => ({ ...v, codigo: e.target.value }))} /></td>
                    {paisConfig.map((p) => (
                      <td key={p.key}>
                        <select value={rascunho[p.key]} onChange={(e) => setRascunho((v) => ({ ...v, [p.key]: e.target.value }))}>
                          <option value="">{p.obrigatorio ? 'Selecione…' : '— (nenhum)'}</option>
                          {p.opcoes.map((o) => (
                            <option key={o.id} value={o.id}>{o.nome}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td className="text-right">
                      <button className="btn btn-success btn-sm" onClick={() => salvarEdicao(item.id)}>Salvar</button>{' '}
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditandoId(null)}>Cancelar</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id}>
                    <td>{item.nome}</td>
                    <td>{item.codigo || '—'}</td>
                    {paisConfig.map((p) => <td key={p.key} className="text-muted">{nomePai(item, p)}</td>)}
                    <td className="text-right">
                      <button className="btn btn-ghost btn-sm" onClick={() => iniciarEdicao(item)}>Editar</button>{' '}
                      <button className="btn btn-danger btn-sm" onClick={() => handleExcluir(item)}>Excluir</button>
                    </td>
                  </tr>
                )
              )}
              {itens.length === 0 && (
                <tr>
                  <td colSpan={paisConfig.length + 3} className="empty-hint">Nenhum registro ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CadastroInterno({ bus, torres, subTorres, empresas, onRecarregar, showToast }) {
  return (
    <div>
      <SecaoNivel
        titulo="BU" tabela="bu" itens={bus} paisConfig={[]}
        onRecarregar={onRecarregar} showToast={showToast}
        nomeArquivo={nomeArquivoExportacao(MODULOS.CADASTROS, 'BU')}
      />
      <SecaoNivel
        titulo="Torre" tabela="torre" itens={torres}
        paisConfig={[{ key: 'bu_id', label: 'BU', opcoes: bus, obrigatorio: true }]}
        onRecarregar={onRecarregar} showToast={showToast}
        nomeArquivo={nomeArquivoExportacao(MODULOS.CADASTROS, 'Torre')}
      />
      <SecaoNivel
        titulo="Sub Torre" tabela="sub_torre" itens={subTorres}
        paisConfig={[{ key: 'torre_id', label: 'Torre', opcoes: torres, obrigatorio: true }]}
        onRecarregar={onRecarregar} showToast={showToast}
        nomeArquivo={nomeArquivoExportacao(MODULOS.CADASTROS, 'SubTorre')}
      />
      <SecaoNivel
        titulo="Empresa" tabela="empresa" itens={empresas}
        paisConfig={[
          { key: 'bu_id', label: 'BU', opcoes: bus, obrigatorio: true },
          { key: 'torre_id', label: 'Torre', opcoes: torres, obrigatorio: false },
          { key: 'sub_torre_id', label: 'Sub Torre', opcoes: subTorres, obrigatorio: false },
        ]}
        onRecarregar={onRecarregar} showToast={showToast}
        nomeArquivo={nomeArquivoExportacao(MODULOS.CADASTROS, 'Empresa')}
      />
    </div>
  )
}

export default function EstruturaOrganizacional() {
  const showToast = useToast()
  const [aba, setAba] = useState('hierarquia')

  const [bus, setBus] = useState([])
  const [torres, setTorres] = useState([])
  const [subTorres, setSubTorres] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState(new Set())

  useEffect(() => {
    carregarTudo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregarTudo() {
    setLoading(true)
    try {
      const [b, t, s, e] = await Promise.all([
        fetchAll('bu', 'criado_em'),
        fetchAll('torre', 'criado_em'),
        fetchAll('sub_torre', 'criado_em'),
        fetchAll('empresa', 'criado_em'),
      ])
      setBus(b)
      setTorres(t)
      setSubTorres(s)
      setEmpresas(e)
      setExpandidos((atual) => (atual.size ? atual : new Set(b.map((x) => x.id))))
    } catch (err) {
      showToast(`Erro ao carregar estrutura: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  function alternarNo(id) {
    setExpandidos((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const arvore = construirArvore(bus, torres, subTorres, empresas)

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Estrutura Organização</h1>
          <p>BU → Torre → Sub Torre → Empresa</p>
        </div>
        <div className="topbar-actions">
          <Link to="/cadastros" className="btn btn-secondary">← Voltar aos Cadastros</Link>
        </div>
      </header>

      <div className="content">
        <div className="tabs submenu">
          <button className={`tab-btn${aba === 'hierarquia' ? ' active' : ''}`} onClick={() => setAba('hierarquia')}>Hierarquia</button>
          <button className={`tab-btn${aba === 'cadastro' ? ' active' : ''}`} onClick={() => setAba('cadastro')}>Cadastro Interno</button>
        </div>

        {aba === 'hierarquia' ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div>
                <h2>Hierarquia Organizacional</h2>
                <p>
                  {loading
                    ? 'Carregando…'
                    : `${bus.length} BU(s) · ${torres.length} Torre(s) · ${subTorres.length} Sub Torre(s) · ${empresas.length} Empresa(s)`}
                </p>
              </div>
            </div>
            <div className="panel-body">
              {!loading && arvore.length === 0 && (
                <div className="empty-hint">Nenhuma BU cadastrada ainda. Use a aba "Cadastro Interno".</div>
              )}
              {arvore.map((no) => (
                <NoArvore key={no.id} no={no} nivel={0} expandidos={expandidos} alternar={alternarNo} />
              ))}
            </div>
          </div>
        ) : (
          <CadastroInterno bus={bus} torres={torres} subTorres={subTorres} empresas={empresas} onRecarregar={carregarTudo} showToast={showToast} />
        )}
      </div>
    </Layout>
  )
}
