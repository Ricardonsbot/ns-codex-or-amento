import { FORMATOS, ORDEM_FORMATOS } from '../lib/formatosTemplate'

/**
 * Qual dos quatro templates é este arquivo.
 *
 * A ferramenta chuta pelo nome e pelas abas, mas quem decide é a pessoa: o
 * chute erra quando alguém renomeia o arquivo, e importar como o formato
 * errado cobra o checklist errado — Receita de quem não tem receita, target
 * gravado como gasto. Quando o chute não tem certeza, a faixa diz isso em vez
 * de fingir que sabe.
 */
export default function SeletorFormato({ formato, deteccao, aviso, onChange }) {
  const f = FORMATOS[formato]
  if (!f) return null

  return (
    <div className="painel-formato" style={{ marginBottom: 16 }}>
      <div className="flex-row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22 }} aria-hidden="true">
          {f.icone}
        </span>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6 }}>
            Formato do template
          </div>
          <strong>{f.rotulo}</strong>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {f.entrega} Envia: {f.quem}.
          </div>
        </div>
        <label style={{ fontSize: 12 }}>
          Trocar:{' '}
          <select value={formato} onChange={(e) => onChange(e.target.value)}>
            {ORDEM_FORMATOS.map((id) => (
              <option key={id} value={id}>
                {FORMATOS[id].rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {deteccao && (
        <p style={{ fontSize: 12, opacity: 0.75, margin: '8px 0 0' }}>
          {deteccao.certeza ? '✓ Reconhecido' : '⚠ Chute'} — {deteccao.porque}.
          {!deteccao.certeza && ' Confira antes de importar.'}
        </p>
      )}

      {aviso?.faltando?.length > 0 && (
        <div className="proto-banner" style={{ marginTop: 10 }}>
          ⚠ O formato {f.rotulo} espera {aviso.faltando.join(' e ')} e este arquivo não trouxe. Ou é outro formato, ou
          falta aba no arquivo.
        </div>
      )}
      {aviso?.sobrando?.length > 0 && (
        <div className="proto-banner" style={{ marginTop: 10 }}>
          ⓘ O arquivo também tem {aviso.sobrando.join(' e ')}, que não é do formato {f.rotulo}. Dá para importar, mas
          confirme que é isso mesmo.
        </div>
      )}
      {f.historico && (
        <p style={{ fontSize: 12, opacity: 0.75, margin: '8px 0 0' }}>
          Este formato traz o realizado do ano anterior ao lado do orçado. Só o bloco do ano orçado entra como
          lançamento — o ano passado já está no realizado.
        </p>
      )}
    </div>
  )
}
