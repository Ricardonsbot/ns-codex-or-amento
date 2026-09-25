import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from './ToastProvider'
import { useUnidade } from './UnidadeProvider'
import BotaoUnidade from './BotaoUnidade'
import { contarTargetsPacote, gravarTargetsPacote, pacotesCadastrados } from '../lib/targetsData'

/**
 * Conferência e gravação do Template Pacoteiros.
 *
 * É o único dos quatro formatos que não vira lançamento: o número aqui é o
 * teto do ano por pacote, e vai para o outro lado do quadro Target × Bottom
 * Up. Por isso esta tela não fala de empresa, conta nem centro de custo — nada
 * disso existe num target — e fala de duas coisas que as outras não têm: se o
 * pacote existe no cadastro e quem é o responsável por ele.
 */
export default function CardTargetsPacote({ lido, arquivo, onGravado }) {
  const showToast = useToast()
  const { comMoeda } = useUnidade()
  const [ano, setAno] = useState(lido.ano ?? new Date().getFullYear())
  const [jaExistem, setJaExistem] = useState(null)
  const [substituir, setSubstituir] = useState(true)
  const [gravando, setGravando] = useState(false)
  const [gravado, setGravado] = useState(0)
  const [cadastro, setCadastro] = useState(null)

  useEffect(() => {
    contarTargetsPacote(ano).then(setJaExistem)
  }, [ano, gravado])

  useEffect(() => {
    pacotesCadastrados().then(setCadastro)
  }, [])

  // Tabela ainda não criada: contar devolve null, e é o mesmo sinal de que
  // gravar vai falhar. Melhor dizer antes.
  const semTabela = jaExistem === null
  const conhecidos = cadastro === null ? null : new Set(cadastro)
  const fora = conhecidos === null ? [] : lido.linhas.filter((l) => !conhecidos.has(l.pacote))
  const total = lido.linhas.reduce((a, l) => a + l.valor, 0)
  const semDono = lido.linhas.filter((l) => !l.responsavel).length

  async function handleGravar() {
    setGravando(true)
    try {
      const n = await gravarTargetsPacote(ano, lido.linhas, { substituir })
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
          <p>aba {lido.aba} · o teto do ano, não lançamento</p>
        </div>
        <BotaoUnidade />
      </div>
      <div className="panel-body">
        {semTabela && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ✕ A tabela de targets ainda não existe no banco — falta rodar
            supabase/migrations/2026-09-22-historico-de-importacao.sql. Dá para conferir o arquivo aqui, mas gravar só
            depois disso.
          </div>
        )}

        <div className="flex-row" style={{ gap: 20, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <label style={{ fontSize: 12 }}>
            Ano do target{' '}
            <input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{lido.linhas.length}</div>
            <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6 }}>pacotes</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{comMoeda(total)}</div>
            <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6 }}>
              target do ano
            </div>
          </div>
        </div>

        {!lido.ano && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ⓘ O arquivo não diz de que ano é o target — confira o campo acima antes de gravar.
          </div>
        )}
        {lido.ignoradas > 0 && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ⓘ {lido.ignoradas} linha(s) têm pacote escrito e nenhum valor — ficam de fora.
          </div>
        )}
        {fora.length > 0 && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ⚠ {fora.length} pacote(s) do arquivo não estão no cadastro: {fora.slice(0, 5).map((f) => f.pacote).join(', ')}
            {fora.length > 5 ? '…' : ''}. O target entra assim mesmo, mas o bottom up só vai casar se o nome for o
            mesmo do template de gasto — confira em <Link to="/cadastros/pacotes">Cadastros → Pacotes</Link>.
          </div>
        )}
        {semDono > 0 && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ⓘ {semDono} pacote(s) sem responsável no arquivo — sem ele não fica registrado a quem cobrar a diferença.
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
              Apagar os de {ano} antes de gravar — é o que tira pacote que saiu desta versão do arquivo
            </label>
          </div>
        )}

        <div className="rolagem-x">
          <table className="data-table">
            <thead>
              <tr>
                <th>PACOTE</th>
                <th>RESPONSÁVEL</th>
                <th className="text-right">TARGET DO ANO</th>
                <th>OBSERVAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {lido.linhas.map((l) => (
                <tr key={l.pacote}>
                  <td>
                    <strong>{l.pacote}</strong>
                    {conhecidos && !conhecidos.has(l.pacote) && (
                      <span style={{ color: 'var(--color-danger, #c0392b)', fontSize: 12 }}> · fora do cadastro</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{l.responsavel || '—'}</td>
                  <td className="text-right">{comMoeda(l.valor)}</td>
                  <td style={{ fontSize: 12, opacity: 0.8 }}>{l.observacao || ''}</td>
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
            disabled={gravando || semTabela || !lido.linhas.length}
          >
            {gravando ? 'Gravando…' : `Gravar targets de ${ano}`}
          </button>
          {gravado > 0 && (
            <span style={{ fontSize: 12 }}>
              ✓ Gravado — veja em <Link to="/resultado">Resultado → Target × Bottom Up</Link>.
            </span>
          )}
          <span style={{ fontSize: 12, opacity: 0.7 }}>{arquivo}</span>
        </div>
      </div>
    </div>
  )
}
