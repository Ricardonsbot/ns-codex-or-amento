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
 * Uma entrada por responsabilidade, com o que é aprovado em cima e a cadeia
 * embaixo. A pergunta que se faz nesta tela é "quem aprova o Labor - COGS?", e
 * não "quais itens esta cadeia cobre" — então o item vem primeiro.
 *
 * A mesma cadeia se repete quando cobre vários itens, e tudo bem: na visão BU,
 * 35 das 42 cadeias cobrem um item só. Agrupá-las economizava quase nada e
 * empurrava o nome do que se aprova para debaixo das caixas de aprovador.
 */
function porResponsabilidade(registros, visao) {
  const grupos = new Map()
  for (const r of registros) {
    const cadeia = r[visao]
    if (!cadeia) continue
    if (!grupos.has(r.grupo)) grupos.set(r.grupo, [])
    grupos.get(r.grupo).push({ ...r, cadeia })
  }
  return [...grupos].map(([grupo, linhas]) => ({ grupo, linhas }))
}

/** Quantas cadeias distintas existem — a estatística que o agrupamento dava. */
function contarCadeias(linhas) {
  return new Set(linhas.map((l) => `${l.cadeia.faz}||${l.cadeia.valida1}||${l.cadeia.valida2 ?? ''}`)).size
}

function Etapa({ rotulo, quem, destaque }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 140 }}>
      <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 3 }}>
        {rotulo}
      </div>
      <div
        style={{
          border: '1px solid var(--color-border, #e2e5ea)',
          borderLeft: `3px solid ${destaque}`,
          borderRadius: 6,
          padding: '7px 10px',
          background: 'var(--color-surface, #fff)',
          fontWeight: 600,
          fontSize: 13,
          minHeight: 34,
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
  <div style={{ alignSelf: 'center', paddingTop: 15, opacity: 0.45, fontSize: 18 }} aria-hidden="true">
    →
  </div>
)

export default function AlcadasAprovacao() {
  const [visao, setVisao] = useState('bu')
  const organograma = useMemo(() => porResponsabilidade(dados.registros, visao), [visao])

  const totalLinhas = organograma.reduce((a, g) => a + g.linhas.length, 0)
  const totalCadeias = organograma.reduce((a, g) => a + contarCadeias(g.linhas), 0)

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

        {organograma.map(({ grupo, linhas }) => (
          <div className="panel" key={grupo}>
            <div className="panel-header">
              <div>
                <h2>{grupo}</h2>
                <p>
                  {linhas.length} responsabilidade(s) · {contarCadeias(linhas)} cadeia(s)
                </p>
              </div>
            </div>
            <div className="panel-body">
              {linhas.map((l, i) => (
                <div
                  key={l.linha}
                  style={{
                    padding: '14px 0',
                    borderTop: i ? '1px solid var(--color-border, #e2e5ea)' : 'none',
                  }}
                >
                  {/* O que se aprova vem em cima: e por ele que se procura */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14 }}>{l.titulo}</strong>
                      <span
                        style={{
                          fontSize: 10,
                          letterSpacing: '.04em',
                          textTransform: 'uppercase',
                          padding: '2px 7px',
                          borderRadius: 999,
                          background: 'var(--color-surface-alt, #f2f4f7)',
                          border: '1px solid var(--color-border, #e2e5ea)',
                          opacity: 0.8,
                        }}
                      >
                        {NIVEL[l.nivel] ?? l.nivel}
                      </span>
                      {l.pacote && l.item && (
                        <span style={{ fontSize: 12, opacity: 0.6 }}>em {l.pacote}</span>
                      )}
                    </div>
                    {l.comentario && (
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>ⓘ {l.comentario}</div>
                    )}
                  </div>

                  {/* Quem responde por ele, embaixo */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Etapa rotulo="Quem faz" quem={l.cadeia.faz} destaque="#ff3d03" />
                    <Seta />
                    <Etapa rotulo="Quem valida 1" quem={l.cadeia.valida1} destaque="#20242d" />
                    {l.cadeia.valida2 && <Seta />}
                    {l.cadeia.valida2 && <Etapa rotulo="Quem valida 2" quem={l.cadeia.valida2} destaque="#8a94a6" />}
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
