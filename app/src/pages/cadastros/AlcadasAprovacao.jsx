import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { exportarExcel } from '../../lib/excelUtils'
import { nomeArquivoExportacao, MODULOS } from '../../lib/modulos'
import dados from '../../data/alcadas-aprovacao.json'

const VISOES = [
  { chave: 'bu', rotulo: 'BU' },
  { chave: 'corporate', rotulo: 'Corporate / Enterprise' },
]

const NIVEL = { item: 'Item', pacote: 'Pacote', grupo: 'Grupo' }

/**
 * Junta as linhas que têm exatamente a mesma cadeia de aprovação. É o que faz a
 * tela virar organograma em vez de tabela: no Labor - COGS, sete itens seguem
 * três caminhos, e agrupá-los mostra isso de imediato.
 */
function porCadeia(registros, visao) {
  const grupos = new Map()
  for (const r of registros) {
    const cadeia = r[visao]
    if (!cadeia) continue
    if (!grupos.has(r.grupo)) grupos.set(r.grupo, new Map())
    const chave = `${cadeia.faz}||${cadeia.valida1}||${cadeia.valida2 ?? ''}`
    const cadeias = grupos.get(r.grupo)
    if (!cadeias.has(chave)) cadeias.set(chave, { ...cadeia, linhas: [] })
    cadeias.get(chave).linhas.push(r)
  }
  return [...grupos].map(([grupo, cadeias]) => ({ grupo, cadeias: [...cadeias.values()] }))
}

function Etapa({ rotulo, quem, destaque }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 150 }}>
      <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>
        {rotulo}
      </div>
      <div
        style={{
          border: '1px solid var(--color-border, #e2e5ea)',
          borderLeft: `3px solid ${destaque}`,
          borderRadius: 6,
          padding: '8px 10px',
          background: 'var(--color-surface, #fff)',
          fontWeight: 600,
          fontSize: 13,
          minHeight: 38,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {quem || '—'}
      </div>
    </div>
  )
}

const Seta = () => (
  <div style={{ alignSelf: 'center', paddingTop: 16, opacity: 0.45, fontSize: 18 }} aria-hidden="true">
    →
  </div>
)

export default function AlcadasAprovacao() {
  const [visao, setVisao] = useState('bu')
  const organograma = useMemo(() => porCadeia(dados.registros, visao), [visao])

  const totalCadeias = organograma.reduce((a, g) => a + g.cadeias.length, 0)
  const totalLinhas = organograma.reduce((a, g) => a + g.cadeias.reduce((b, c) => b + c.linhas.length, 0), 0)

  function handleExportar() {
    const colunas = [
      { key: 'Grupo' }, { key: 'Pacote' }, { key: 'Item' }, { key: 'Nível' },
      { key: 'Quem faz' }, { key: 'Quem valida 1' }, { key: 'Quem valida 2' }, { key: 'Comentário' },
    ]
    const linhas = dados.registros
      .filter((r) => r[visao])
      .map((r) => ({
        Grupo: r.grupo,
        Pacote: r.pacote ?? '',
        Item: r.item ?? '',
        'Nível': NIVEL[r.nivel] ?? r.nivel,
        'Quem faz': r[visao].faz,
        'Quem valida 1': r[visao].valida1,
        'Quem valida 2': r[visao].valida2 ?? '',
        'Comentário': r.comentario ?? '',
      }))
    const sufixo = visao === 'bu' ? 'BU' : 'Corporate'
    exportarExcel(nomeArquivoExportacao(MODULOS.CADASTROS, `AlcadasAprovacao${sufixo}`), linhas, colunas)
  }

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Alçadas de Aprovação</h1>
          <p>Quem faz e quem valida cada pacote do orçamento</p>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/cadastros">← Voltar aos Cadastros</Link>
      </header>

      <div className="content">
        <div className="filter-bar">
          <div className="filter-field">
            <label>Visão</label>
            <select value={visao} onChange={(e) => setVisao(e.target.value)}>
              {VISOES.map((v) => (
                <option key={v.chave} value={v.chave}>{v.rotulo}</option>
              ))}
            </select>
          </div>
          <span className="text-muted">
            {totalLinhas} responsabilidade(s) em {totalCadeias} cadeia(s) distinta(s)
          </span>
          <button className="btn btn-secondary btn-sm" type="button" onClick={handleExportar} style={{ marginLeft: 'auto' }}>
            ⭳ Exportar
          </button>
        </div>

        {!organograma.length && (
          <div className="panel">
            <div className="panel-body">
              <p>Nenhuma responsabilidade cadastrada nesta visão.</p>
            </div>
          </div>
        )}

        {organograma.map(({ grupo, cadeias }) => (
          <div className="panel" key={grupo}>
            <div className="panel-header">
              <div>
                <h2>{grupo}</h2>
                <p>
                  {cadeias.reduce((a, c) => a + c.linhas.length, 0)} responsabilidade(s) ·{' '}
                  {cadeias.length} cadeia(s)
                </p>
              </div>
            </div>
            <div className="panel-body">
              {cadeias.map((cadeia, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px 0',
                    borderTop: i ? '1px solid var(--color-border, #e2e5ea)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <Etapa rotulo="Quem faz" quem={cadeia.faz} destaque="#ff3d03" />
                    <Seta />
                    <Etapa rotulo="Quem valida 1" quem={cadeia.valida1} destaque="#20242d" />
                    {cadeia.valida2 && <Seta />}
                    {cadeia.valida2 && <Etapa rotulo="Quem valida 2" quem={cadeia.valida2} destaque="#8a94a6" />}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {cadeia.linhas.map((l) => (
                      <span
                        key={`${l.linha}`}
                        title={
                          `${NIVEL[l.nivel] ?? l.nivel}` +
                          (l.pacote && l.item ? ` · ${l.pacote}` : '') +
                          (l.comentario ? `\n${l.comentario}` : '')
                        }
                        style={{
                          fontSize: 12,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: 'var(--color-surface-alt, #f2f4f7)',
                          border: '1px solid var(--color-border, #e2e5ea)',
                        }}
                      >
                        {l.titulo}
                        {l.comentario && <span style={{ opacity: 0.5 }}> ⓘ</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
