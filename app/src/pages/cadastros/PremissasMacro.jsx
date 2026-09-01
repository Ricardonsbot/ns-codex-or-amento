import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useToast } from '../../components/ToastProvider'
import { exportarExcel } from '../../lib/excelUtils'
import { nomeArquivoExportacao, MODULOS } from '../../lib/modulos'
import { MESES, fetchAnos, fetchPremissas, salvarValor, acumular, formatar } from '../../lib/premissasData'

export default function PremissasMacro() {
  const showToast = useToast()
  const [anos, setAnos] = useState([])
  const [ano, setAno] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(null) // `${indicador}:${mes}`

  useEffect(() => {
    fetchAnos()
      .then((lista) => {
        setAnos(lista)
        setAno(lista[0] ?? null)
        if (!lista.length) setCarregando(false)
      })
      .catch((err) => {
        showToast(`Erro ao carregar anos: ${err.message}`, 'error')
        setCarregando(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ano === null) return
    setCarregando(true)
    fetchPremissas(ano)
      .then(setLinhas)
      .catch((err) => showToast(`Erro ao carregar premissas: ${err.message}`, 'error'))
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano])

  async function handleBlur(linha, mes, texto) {
    setEditando(null)
    const valor = Number(String(texto).replace(',', '.'))
    if (!Number.isFinite(valor) || valor === linha.valores[mes]) return

    const anterior = linha.valores[mes]
    setLinhas((atual) =>
      atual.map((l) =>
        l.indicador === linha.indicador
          ? { ...l, valores: l.valores.map((v, i) => (i === mes ? valor : v)) }
          : l
      )
    )
    try {
      await salvarValor({ indiceId: linha.id, mes: mes + 1, valor })
      showToast(`${linha.indicador} · ${MESES[mes]} atualizado.`, 'success')
    } catch (err) {
      setLinhas((atual) =>
        atual.map((l) =>
          l.indicador === linha.indicador
            ? { ...l, valores: l.valores.map((v, i) => (i === mes ? anterior : v)) }
            : l
        )
      )
      showToast(`Erro ao salvar: ${err.message}`, 'error')
    }
  }

  function handleExportar() {
    const colunas = [{ key: 'Indicador' }, { key: 'Unidade' }, ...MESES.map((m) => ({ key: m })), { key: 'Acumulado' }]
    const dados = linhas.map((l) => {
      const linha = { Indicador: l.indicador, Unidade: l.unidade }
      MESES.forEach((m, i) => {
        linha[m] = l.valores[i] ?? ''
      })
      linha.Acumulado = acumular(l) ?? ''
      return linha
    })
    exportarExcel(nomeArquivoExportacao(MODULOS.CADASTROS, `PremissasMacro${ano ?? ''}`), dados, colunas)
  }

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Premissas Macro</h1>
          <p>Projeção mensal de índices e câmbio usada nas premissas do ciclo</p>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/cadastros">← Voltar aos Cadastros</Link>
      </header>

      <div className="content">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Índices e câmbio {ano ?? ''}</h2>
              <p>
                Percentuais são a variação do mês. O câmbio é nível em R$, não variação — por isso a
                coluna Acumulado mostra o último mês projetado, e não uma composição. Os valores vêm da
                aba "Indices Reajuste" do Template Budget e são guardados com três casas decimais.
              </p>
            </div>
            <div className="flex-row" style={{ gap: 6 }}>
              {anos.length > 1 && (
                <select value={ano ?? ''} onChange={(e) => setAno(Number(e.target.value))}>
                  {anos.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              )}
              <button className="btn btn-secondary btn-sm" type="button" onClick={handleExportar} disabled={!linhas.length}>
                ⭳ Exportar
              </button>
            </div>
          </div>

          <div className="panel-body">
            {carregando && <p>Carregando…</p>}

            {!carregando && !linhas.length && (
              <p>
                Nenhum índice cadastrado para este ano. A carga vem do Template Budget — veja
                <code> app/scripts/importar-premissas-macro.mjs </code> no README.
              </p>
            )}

            {!carregando && linhas.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>INDICADOR</th>
                      {MESES.map((m) => (
                        <th key={m} className="text-right">{m.toUpperCase()}</th>
                      ))}
                      <th className="text-right">ACUMULADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((linha) => (
                      <tr key={linha.indicador}>
                        <td><strong>{linha.indicador}</strong></td>
                        {linha.valores.map((valor, i) => {
                          const chave = `${linha.indicador}:${i}`
                          return (
                            <td key={i} className="text-right">
                              {editando === chave ? (
                                <input
                                  type="text"
                                  autoFocus
                                  defaultValue={valor ?? ''}
                                  style={{ width: 78, textAlign: 'right' }}
                                  onBlur={(e) => handleBlur(linha, i, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.target.blur()
                                    if (e.key === 'Escape') setEditando(null)
                                  }}
                                />
                              ) : (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  title="Clique para editar"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => setEditando(chave)}
                                  onKeyDown={(e) => e.key === 'Enter' && setEditando(chave)}
                                >
                                  {formatar(valor, linha.unidade)}
                                </span>
                              )}
                            </td>
                          )
                        })}
                        <td className="text-right"><strong>{formatar(acumular(linha), linha.unidade)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
