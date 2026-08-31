import { useRef, useState } from 'react'
import { toCsv, baixarArquivo, parseCsv, lerArquivoTexto } from '../lib/csvUtils'

// Componente genérico de Exportar/Importar CSV, reutilizado por todas as telas de
// Cadastro. As colunas exportadas/esperadas na importação vêm de `colunas`
// (mesma config que define os campos daquele cadastro) — adicionar ou remover uma
// coluna na configuração da tela já reflete aqui automaticamente, sem editar este
// componente.
export default function ImportExportBar({ nomeArquivo, colunas, dados, onImportarLinha, onImportConcluido, showToast }) {
  const inputRef = useRef(null)
  const [importando, setImportando] = useState(false)

  function handleExportar() {
    const csv = toCsv(dados, colunas)
    baixarArquivo(`${nomeArquivo}.csv`, csv)
  }

  async function handleArquivoSelecionado(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImportando(true)
    try {
      const texto = await lerArquivoTexto(file)
      const linhas = parseCsv(texto)
      if (!linhas.length) {
        showToast('Nenhuma linha encontrada no arquivo.', 'warning')
        return
      }

      const criados = []
      let erros = 0
      for (const linha of linhas) {
        try {
          criados.push(await onImportarLinha(linha))
        } catch {
          erros++
        }
      }

      if (criados.length) onImportConcluido?.(criados)
      showToast(
        `Importação concluída: ${criados.length} adicionado(s)${erros ? `, ${erros} com erro` : ''}.`,
        erros ? 'warning' : 'success'
      )
    } catch (err) {
      showToast(`Erro ao importar: ${err.message}`, 'error')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="flex-row" style={{ gap: 6 }}>
      <button className="btn btn-secondary btn-sm" type="button" onClick={handleExportar}>⭳ Exportar</button>
      <button className="btn btn-secondary btn-sm" type="button" onClick={() => inputRef.current?.click()} disabled={importando}>
        {importando ? 'Importando…' : '⭱ Importar'}
      </button>
      <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleArquivoSelecionado} />
    </div>
  )
}
