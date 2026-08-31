// Utilitários de CSV — usados por todas as telas de Cadastro pra Exportar/Importar.
// Mantidos num único lugar de propósito: mudar o formato de CSV não deve exigir
// tocar em cada tela que exporta/importa dados.

export function toCsv(linhas, colunas) {
  const cabecalho = colunas.map((c) => c.key)
  const corpo = linhas.map((linha) => colunas.map((c) => escaparCsv(linha[c.key])))
  return [cabecalho, ...corpo].map((linha) => linha.join(',')).join('\r\n')
}

function escaparCsv(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor)
  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

export function baixarArquivo(nomeArquivo, conteudo, tipo = 'text/csv;charset=utf-8;') {
  // BOM no início ajuda o Excel a abrir acentuação corretamente
  const blob = new Blob(['﻿' + conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function lerArquivoTexto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo'))
    reader.readAsText(file, 'utf-8')
  })
}

// Parser simples de CSV (RFC4180: suporta campos entre aspas com vírgula/quebra de linha).
// Retorna um array de objetos, um por linha, usando a primeira linha como cabeçalho.
export function parseCsv(texto) {
  const linhas = []
  let campo = ''
  let linhaAtual = []
  let dentroAspas = false

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentroAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          dentroAspas = false
        }
      } else {
        campo += c
      }
      continue
    }
    if (c === '"') {
      dentroAspas = true
    } else if (c === ',') {
      linhaAtual.push(campo)
      campo = ''
    } else if (c === '\n') {
      linhaAtual.push(campo)
      linhas.push(linhaAtual)
      linhaAtual = []
      campo = ''
    } else if (c === '\r') {
      // ignora — tratado junto com \n
    } else {
      campo += c
    }
  }
  if (campo.length || linhaAtual.length) {
    linhaAtual.push(campo)
    linhas.push(linhaAtual)
  }

  if (!linhas.length) return []
  const cabecalho = linhas[0].map((h) => h.trim())
  return linhas
    .slice(1)
    .filter((linha) => linha.some((v) => v.trim() !== ''))
    .map((linha) => {
      const obj = {}
      cabecalho.forEach((chave, idx) => {
        obj[chave] = (linha[idx] ?? '').trim()
      })
      return obj
    })
}
