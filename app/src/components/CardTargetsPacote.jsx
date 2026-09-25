import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from './ToastProvider'
import { useUnidade } from './UnidadeProvider'
import BotaoUnidade from './BotaoUnidade'
import { contarTargetsPacote, gravarTargetsPacote, pacotesCadastrados } from '../lib/targetsData'

/**
 * O template do pacoteiro, importado como target em vez de lançamento.
 *
 * O arquivo é o mesmo Template Budget de todo mundo — o que muda é o papel de
 * quem preencheu. O pacoteiro fecha o pacote inteiro por cima; as empresas
 * constroem o mesmo pacote por baixo. Gravar o dele como lançamento somaria os
 * dois e contaria o gasto duas vezes; então aqui o total por pacote vira o
 * target, e o confronto acontece no quadro Target × Bottom Up.
 *
 * O responsável é quem subiu o arquivo: é o pacoteiro, e é a quem se cobra a
 * diferença depois.
 */
export default function CardTargetsPacote({ linhas, anoTemplate, arquivo, responsavel, onGravado }) {
  const showToast = useToast()
  const { comMoeda } = useUnidade()
  const [ano, setAno] = useState(anoTemplate ?? new Date().getFullYear())
  const [jaExistem, setJaExistem] = useState(null)
  const [substituir, setSubstituir] = useState(true)
  const [gravando, setGravando] = useState(false)
  const [gravado, setGravado] = useState(0)
  const [cadastro, setCadastro] = useState(null)

  // Uma linha por pacote: o template abre por conta, centro de custo e
  // fornecedor, e nada disso é target — target é do pacote.
  const porPacote = useMemo(() => {
    const mapa = new Map()
    let semPacote = 0
    for (const l of linhas) {
      const nome = (l.pacote ?? '').trim()
      const total = (l.valores ?? []).reduce((a, v) => a + (v.valor ?? 0), 0)
      if (!total) continue
      if (!nome) {
        semPacote += 1
        continue
      }
      const atual = mapa.get(nome)
      // A leitura já inverteu o sinal do gasto; o target é um teto de gasto e
      // fica positivo, como o bottom up do quadro.
      mapa.set(nome, {
        pacote: nome,
        valor: (atual?.valor ?? 0) + Math.abs(total),
        linhas: (atual?.linhas ?? 0) + 1,
      })
    }
    return {
      lista: [...mapa.values()].sort((a, b) => a.pacote.localeCompare(b.pacote, 'pt-BR')),
      semPacote,
    }
  }, [linhas])

  useEffect(() => {
    contarTargetsPacote(ano).then(setJaExistem)
  }, [ano, gravado])

  useEffect(() => {
    pacotesCadastrados().then(setCadastro)
  }, [])

  const semTabela = jaExistem === null
  const conhecidos = cadastro === null ? null : new Set(cadastro)
  const fora = conhecidos === null ? [] : porPacote.lista.filter((l) => !conhecidos.has(l.pacote))
  const total = porPacote.lista.reduce((a, l) => a + l.valor, 0)

  async function handleGravar() {
    setGravando(true)
    try {
      const n = await gravarTargetsPacote(
        ano,
        porPacote.lista.map((l) => ({ ...l, responsavel, observacao: `Template ${arquivo}` })),
        { substituir }
      )
      showToast(`${n} target(s) gravados para ${ano}.`, 'success')
      setGravado((x) => x + 1)
      onGravado?.()
    } catch (err) {
      showToast(`Não consegui gravar os targets: ${err.message}`, 'error')
    } finally {
      setGravando(false)
    }
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header">
        <div>
          <h2>🎯 Target por pacote</h2>
          <p>o total deste template por pacote — entra como teto do ano, não como lançamento</p>
        </div>
        <BotaoUnidade />
      </div>
      <div className="panel-body">
        {semTabela && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ✕ A tabela de targets ainda não existe no banco — falta rodar
            supabase/migrations/2026-09-22-historico-de-importacao.sql. Dá para conferir aqui, mas gravar só depois
            disso.
          </div>
        )}

        <div className="flex-row" style={{ gap: 20, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <label style={{ fontSize: 12 }}>
            Ano do target{' '}
            <input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} style={{ width: 90 }} />
          </label>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{porPacote.lista.length}</div>
            <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6 }}>
              pacotes
            </div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{comMoeda(total)}</div>
            <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6 }}>
              target do ano
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13 }}>{responsavel || '—'}</div>
            <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6 }}>
              responsável
            </div>
          </div>
        </div>

        {porPacote.semPacote > 0 && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ⚠ {porPacote.semPacote} linha(s) têm valor e nenhum pacote preenchido — ficam de fora do target. Sem a
            coluna Pacote não há a que comparar.
          </div>
        )}
        {fora.length > 0 && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ⚠ {fora.length} pacote(s) fora do cadastro: {fora.slice(0, 5).map((f) => f.pacote).join(', ')}
            {fora.length > 5 ? '…' : ''}. O target entra assim mesmo, mas o nome tem de ser o mesmo que as empresas
            usam, senão o bottom up não casa — confira em <Link to="/cadastros/pacotes">Cadastros → Pacotes</Link>.
          </div>
        )}
        {jaExistem > 0 && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ⚠ {ano} já tem <strong>{jaExistem}</strong> target(s) gravados.
            <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={substituir}
                onChange={(e) => setSubstituir(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Apagar os de {ano} antes de gravar — é o que tira pacote que saiu desta versão do template
            </label>
          </div>
        )}

        <div className="rolagem-x">
          <table className="data-table">
            <thead>
              <tr>
                <th>PACOTE</th>
                <th className="text-right">LINHAS</th>
                <th className="text-right">TARGET DO ANO</th>
              </tr>
            </thead>
            <tbody>
              {porPacote.lista.map((l) => (
                <tr key={l.pacote}>
                  <td>
                    <strong>{l.pacote}</strong>
                    {conhecidos && !conhecidos.has(l.pacote) && (
                      <span style={{ color: 'var(--color-danger, #c0392b)', fontSize: 12 }}> · fora do cadastro</span>
                    )}
                  </td>
                  <td className="text-right">{l.linhas}</td>
                  <td className="text-right">{comMoeda(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex-row" style={{ gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleGravar}
            disabled={gravando || semTabela || !porPacote.lista.length}
          >
            {gravando ? 'Gravando…' : `Gravar target de ${ano}`}
          </button>
          {gravado > 0 && (
            <span style={{ fontSize: 12 }}>
              ✓ Gravado — veja em <Link to="/resultado">Resultado → Target × Bottom Up</Link>.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
