import { useRef, useState } from 'react'
import { useToast } from './ToastProvider'
import { lerPlanilhaEmWorker, conferir, importar, ABA } from '../lib/importarTemplateReceita'

const brl = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Botão de upload do Template Budget na tela de Receita.
 *
 * O fluxo é em dois passos de propósito: lê e CONFERE, mostra o que casou e o
 * que não, e só grava depois de confirmar. Importar direto do arquivo criaria
 * lançamentos com empresa ou conta erradas sem ninguém ver.
 */
export default function ImportarTemplateReceita({ onImportado }) {
  const showToast = useToast()
  const inputRef = useRef(null)
  const [lendo, setLendo] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [previa, setPrevia] = useState(null)
  const [arquivo, setArquivo] = useState('')

  async function handleArquivo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setLendo(true)
    setPrevia(null)
    try {
      const linhas = await lerPlanilhaEmWorker(await file.arrayBuffer())
      if (!linhas.length) {
        showToast(`A aba "${ABA}" não tem nenhuma linha preenchida com valor mensal.`, 'warning')
        return
      }
      setArquivo(file.name)
      setPrevia(await conferir(linhas))
    } catch (err) {
      showToast(`Não consegui ler a planilha: ${err.message}`, 'error')
    } finally {
      setLendo(false)
    }
  }

  async function handleConfirmar() {
    setGravando(true)
    try {
      const n = await importar(previa.prontas, previa.versao.id)
      showToast(`${n} lançamento(s) de receita importado(s).`, 'success')
      setPrevia(null)
      onImportado?.()
    } catch (err) {
      showToast(`Erro ao importar: ${err.message}`, 'error')
    } finally {
      setGravando(false)
    }
  }

  const total = previa?.prontas.reduce((a, p) => a + p.total, 0) ?? 0
  const semVersao = previa && !previa.versao

  return (
    <>
      <button
        className="btn btn-secondary btn-sm"
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={lendo}
      >
        {lendo ? 'Lendo planilha…' : '⭱ Importar Template'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsb,.xlsx,.xlsm"
        style={{ display: 'none' }}
        onChange={handleArquivo}
      />

      {previa && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-header">
            <div>
              <h2>Conferência da importação</h2>
              <p>
                {arquivo} · aba {ABA}
                {previa.ciclo && ` · ciclo ${previa.ciclo.ano}`}
                {previa.versao && ` / versão ${previa.versao.nome}`}
              </p>
            </div>
            <div className="flex-row" style={{ gap: 6 }}>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPrevia(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={handleConfirmar}
                disabled={gravando || !previa.prontas.length || previa.pendentes.length > 0 || semVersao}
              >
                {gravando ? 'Importando…' : `Importar ${previa.prontas.length} linha(s)`}
              </button>
            </div>
          </div>

          <div className="panel-body">
            {semVersao && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⓘ Não há versão ativa num ciclo aberto. Crie uma em Budget-Settings antes de importar.
              </div>
            )}

            {previa.pendentes.length > 0 && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⓘ {previa.pendentes.length} linha(s) não puderam ser resolvidas. A importação fica bloqueada até
                que todas casem — importar só uma parte deixaria o orçamento incompleto sem ninguém perceber.
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>LINHA</th>
                    <th>EMPRESA</th>
                    <th>CONTA</th>
                    <th>PRODUTO · TIPO</th>
                    <th className="text-right">TOTAL ANO</th>
                    <th>SITUAÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.prontas.map((p) => (
                    <tr key={`ok-${p.linha}`}>
                      <td>{p.linha}</td>
                      <td><strong>{p.empresa.nome}</strong></td>
                      <td style={{ fontSize: 12 }}>
                        {p.conta.codigo} {p.conta.nome}
                        <div style={{ opacity: 0.6 }}>de “{p.contaRotulo}”</div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {[p.produtoAnalitico || p.produtoSintetico, p.tipoReceita].filter(Boolean).join(' · ')}
                      </td>
                      <td className="text-right">{brl(p.total)}</td>
                      <td style={{ color: 'var(--color-success, #1a7f47)' }}>✓ resolvida</td>
                    </tr>
                  ))}
                  {previa.pendentes.map((p) => (
                    <tr key={`erro-${p.linha}`} style={{ background: 'var(--color-surface-alt, #fff6f4)' }}>
                      <td>{p.linha}</td>
                      <td>{p.empresa || '—'}</td>
                      <td style={{ fontSize: 12 }}>{p.contaRotulo || '—'}</td>
                      <td style={{ fontSize: 12 }}>
                        {[p.produtoAnalitico || p.produtoSintetico, p.tipoReceita].filter(Boolean).join(' · ')}
                      </td>
                      <td className="text-right">{brl(p.total)}</td>
                      <td style={{ color: 'var(--color-danger, #c0392b)', fontSize: 12 }}>
                        {p.falhas.join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {previa.prontas.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={4}><strong>Total a importar</strong></td>
                      <td className="text-right"><strong>{brl(total)}</strong></td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <p style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
              Entra a receita <strong>bruta</strong> do template. A dedução não é gravada aqui: a ferramenta já
              tem o mapa de alíquotas, e o P&amp;L trata dedução como linha própria. Produto e cliente vão para a
              descrição e as observações do lançamento, porque a tabela ainda não tem coluna para eles.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
