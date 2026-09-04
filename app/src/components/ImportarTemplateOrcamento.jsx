import { useRef, useState } from 'react'
import { useToast } from './ToastProvider'
import { lerPlanilhaEmWorker, conferir, importar, TEMPLATE } from '../lib/importarTemplateOrcamento'

const brl = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Nota de rodapé específica de cada aba: o que entra e o que fica de fora. */
const NOTA = {
  receita:
    'Entra a receita bruta do template. A dedução não é gravada aqui: a ferramenta já tem o mapa de ' +
    'alíquotas, e o P&L trata dedução como linha própria. Produto e cliente vão para a descrição e as ' +
    'observações, porque a tabela ainda não tem coluna para eles.',
  despesa:
    'Entra o bloco de competência. O bloco de caixa que vem depois não é gravado — a ferramenta orça por ' +
    'competência. Os valores trocam de sinal: o template escreve gasto como negativo e aqui o gasto é ' +
    'guardado positivo, porque o P&L faz EBITDA = receita − despesa.',
  capex:
    'Entra o bloco de competência. O bloco de caixa que vem depois não é gravado. Quantidade e valor ' +
    'unitário vão para as observações, e os valores trocam de sinal como na Despesa.',
}

/**
 * Botão de upload do Template Budget nas telas de lançamento.
 *
 * O fluxo é em dois passos de propósito: lê e CONFERE, mostra o que casou e o
 * que não, e só grava depois de confirmar. Importar direto do arquivo criaria
 * lançamentos com empresa ou conta erradas sem ninguém ver.
 */
export default function ImportarTemplateOrcamento({ tipo, rotulo, anoCiclo, onImportado }) {
  const showToast = useToast()
  const inputRef = useRef(null)
  const [lendo, setLendo] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [previa, setPrevia] = useState(null)
  const [arquivo, setArquivo] = useState('')

  const aba = TEMPLATE[tipo]?.aba

  async function handleArquivo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setLendo(true)
    setPrevia(null)
    try {
      const lido = await lerPlanilhaEmWorker(await file.arrayBuffer(), tipo)
      if (!lido.linhas.length) {
        showToast(`A aba "${lido.aba}" não tem nenhuma linha preenchida com valor mensal.`, 'warning')
        return
      }
      setArquivo(file.name)
      setPrevia({ ...(await conferir(lido)), ano: lido.ano })
    } catch (err) {
      showToast(`Não consegui ler a planilha: ${err.message}`, 'error')
    } finally {
      setLendo(false)
    }
  }

  async function handleConfirmar() {
    setGravando(true)
    try {
      const n = await importar(previa.prontas, previa.versao.id, tipo)
      showToast(`${n} lançamento(s) de ${rotulo.toLowerCase()} importado(s).`, 'success')
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
  const anoDivergente = previa && anoCiclo && previa.ano !== anoCiclo
  const temDetalhe = tipo !== 'receita'

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
                {arquivo} · aba {aba}
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

            {anoDivergente && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⚠ O cabeçalho da aba {aba} está em {previa.ano} e o ciclo aberto é {anoCiclo}. Os meses entram
                por posição (1ª coluna = janeiro), então os valores vão para o ciclo {anoCiclo} de qualquer
                forma — confira se é isso mesmo antes de confirmar.
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
                    <th>DESCRIÇÃO</th>
                    {temDetalhe && <th>C. CUSTO · FORNECEDOR</th>}
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
                        <div style={{ opacity: 0.6 }}>de {p.contaCodigo || p.contaRotulo}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{p.descricao || '—'}</td>
                      {temDetalhe && (
                        <td style={{ fontSize: 12 }}>
                          {[p.centroCusto, p.fornecedor].filter(Boolean).join(' · ') || '—'}
                        </td>
                      )}
                      <td className="text-right">{brl(p.total)}</td>
                      <td style={{ color: 'var(--color-success, #1a7f47)' }}>✓ resolvida</td>
                    </tr>
                  ))}
                  {previa.pendentes.map((p) => (
                    <tr key={`erro-${p.linha}`} style={{ background: 'var(--color-surface-alt, #fff6f4)' }}>
                      <td>{p.linha}</td>
                      <td>{p.empresa || '—'}</td>
                      <td style={{ fontSize: 12 }}>{p.contaCodigo || p.contaRotulo || '—'}</td>
                      <td style={{ fontSize: 12 }}>{p.descricao || '—'}</td>
                      {temDetalhe && (
                        <td style={{ fontSize: 12 }}>
                          {[p.centroCusto, p.fornecedor].filter(Boolean).join(' · ') || '—'}
                        </td>
                      )}
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
                      <td colSpan={temDetalhe ? 5 : 4}><strong>Total a importar</strong></td>
                      <td className="text-right"><strong>{brl(total)}</strong></td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <p style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>{NOTA[tipo]}</p>
          </div>
        </div>
      )}
    </>
  )
}
