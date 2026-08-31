import * as XLSX from 'xlsx'

// Utilitários de Excel — usados por todas as telas de Cadastro pra Exportar/Importar.
// Mantidos num único lugar de propósito: mudar o formato do arquivo não deve exigir
// tocar em cada tela que exporta/importa dados.

export function exportarExcel(nomeArquivo, linhas, colunas) {
  const cabecalho = colunas.map((c) => c.key)
  const corpo = linhas.map((linha) => colunas.map((c) => linha[c.key] ?? ''))
  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...corpo])
  const livro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(livro, planilha, 'Dados')
  XLSX.writeFile(livro, `${nomeArquivo}.xlsx`)
}

export function lerArquivoExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const dados = new Uint8Array(reader.result)
        const livro = XLSX.read(dados, { type: 'array' })
        const primeiraAba = livro.SheetNames[0]
        const planilha = livro.Sheets[primeiraAba]
        const linhas = XLSX.utils.sheet_to_json(planilha, { defval: '', raw: false })
        resolve(linhas)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo'))
    reader.readAsArrayBuffer(file)
  })
}
