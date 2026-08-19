# As bases do `FPA_DW/Datalake_readFiles` e o que fazer com elas

> Analisado em 19/08/2026. Pasta:
> `Finanças, Legal & Governança - Documentos/FPA_DW/Datalake_readFiles`
> Oito planilhas, 0,6 MB. **Nada foi copiado para o repositório** — este
> documento é leitura e proposta.

## O que tem lá

| Arquivo | Conteúdo | Vale para nós? |
|---|---|---|
| **`tbl_dbEmpresas.xlsx`** | 177 empresas (154 ativas) · 29 colunas: BU, BU2025, Torre, Torre2025, Torre2025_Sub_STO, CompanyGroup, CNPJ | **Sim — destrava a Fase 1** |
| **`Layouts_BI.xlsx`** | 74 linhas do P&L com ordem, categoria, EBITDAYN, SubtotalYN, PnL_LineTotal, DrillDownYN | **Sim — substitui uma invenção nossa** |
| `tbl_dSYS_Keyreclass.xlsx` | 195 regras Pre_Category/Pre_Line → PnL_Category/PnL_LineName | Sim, na ingestão |
| `tbl_KMM_Organizacional.xlsx` | 3.285 linhas · a mesma do repo, **mais nova** | Sim — o repo está velho |
| `tbl_KMM_Contas.xlsx` | 635 contas · conteúdo **idêntico** ao do repo | Já usamos |
| `tbl_Rateios.xlsx` | 216 linhas de rateio empresa → empresa por mês | Depois (rateio) |
| `tbl_dSYS_BIConn.xlsx` | 37 empresas ligadas ao datalake (`deltalake_client_base`, `Lake_ID_Class`) | Depois (Realizado) |
| `tbl_deltaclient_base.xlsx` | 108 linhas, **sem cabeçalho** — cliente do lake, empresa N1, empresa origem, ID | Depois (Realizado) |

---

## 1. `tbl_dbEmpresas` resolve o de/para que estava travando a Fase 1

O `BANCO-DE-DADOS.md` diz, no passo 2, que **a BU não sai dos arquivos**:

> "A coluna `Nstech_BUConsolidado` só tem quatro valores de *nível* … o de/para
> Torre → BU precisa ser escrito à mão. São 12 torres: uma tabela de 12 linhas,
> não um projeto — mas é uma decisão de negócio, não de engenharia."

**Ela existe, e é por empresa.** `BU2025` × `Torre2025` dá 18 pares, cobrindo as
177 empresas:

```
BU EMBARCADOR  → SW Embarcador (41) · VGR - Embarcador (22) · Insurance Market (8)
                 Mídia (6) · Corporate BU - Embarcador (5) · Corporate BU TMS Embarcador (1)
BU PSL         → TMS (24) · Corporate BU - PSL (7) · VGR - PSL (5) · Fintech (2)
                 Mobilidade (2) · Atua Redes (1) · Corporate BU TMS PSL (1)
Corporate      → Corporate (38)
Projetos       → Projetos (11)          Coligada (1)          Teste (1)
```

E ainda tem `Torre2025_Sub_STO`, que preenche a **Sub Torre** do nosso
`01-cadastro.sql` — hoje opcional justamente porque nada a alimentava.

**O que isso muda:** `bu`, `torre`, `sub_torre` e `empresa` passam a poder ser
carregadas de uma fonte só, sem ninguém escrever de/para à mão. A Fase 1 deixa
de depender de uma decisão de negócio pendente.

⚠ **Duas ressalvas honestas.** As colunas vêm em dois tempos (`BU`/`Torre` e
`BU2025`/`Torre2025`) e **discordam**: `BU` tem 12 valores com granularidade de
torre (TMS, Fintech, V&RM…), `BU2025` tem 7 e é a hierarquia de verdade. Usar a
errada troca o nível inteiro da árvore. E `CNPJ` só está preenchido em **59 das
177** — então não serve como chave.

## 2. `Layouts_BI` substitui uma invenção minha

Hoje o `carrega_contas_no_banco.py` inventa duas coisas em `cadastro.linha_pl`:
`ordem = i * 10` (alfabética dentro do grupo) e `sinal` pelo prefixo. Funciona,
mas não é o P&L da empresa.

O `Layouts_BI` é o P&L de verdade: 74 linhas, com `Cod_Line_ORDR` dando a
sequência, `PnL_Category` agrupando, e flags que a nossa tabela ainda não tem —
`SubtotalYN`, `PnL_LineTotal`, `EBITDAYN`, `DrillDownYN`. É o que separa "Gross
Revenue → Deductions → Net Revenue → CoGS → Gross Margin → G&A → EBITDA" de uma
lista ordenada por acaso.

**⚠ Corrigindo o que escrevi acima: não dá para ligar isso agora.** Fui medir
antes de implementar, e as duas taxonomias **não falam a mesma língua**:

| | |
|---|---:|
| Nossas linhas de P&L (vindas de `FPA_Pacote`) que existem como `PnL_LineName` | **11 de 18** |
| Nossas linhas que o `Keyreclass` sabe traduzir (como `Pre_Line`) | **6 de 18** |

Ficam de fora justamente as maiores: `Personnel Costs`, `Third Party Services &
Mkt`, `Travels/Rental/Generals`, `Telecomunication / Technology expenses`,
`IR/CSLL`. E dos 6 que o `Keyreclass` traduz, alguns apontam para **mais de um
destino** (`Holding - Cost Sharing` vai para três lugares diferentes, conforme a
`Pre_Category`).

Ou seja: o orçamento fala o vocabulário do plano de contas (KMM/`FPA_Pacote`) e
o BI fala o do P&L gerencial. **Ligar os dois é escrever um de/para que não
existe pronto** — e escrevê-lo por semelhança de nome moveria valor de linha no
consolidado sem ninguém perceber. É trabalho de FP&A, não de script.

**Então `linha_pl` continua como está**, com a ordem que o carregador inventa.
Fica registrado o que ela deveria ser, e o que falta para chegar lá.

## 3. `tbl_dSYS_Keyreclass` é a ponte que vai faltar no Realizado

195 regras que levam a classificação de origem para a do P&L — por exemplo,
`(-) CoGS / COFINS` vira `(-) Deductions / COFINS`. Não serve ao orçamento
agora, mas é exatamente o que a Fase 6 (orçado × realizado) vai precisar para
comparar coisa com coisa. Fica mapeado, não implementado.

## 4. O repositório está desatualizado — e isso é um problema de desenho

| | repo | datalake |
|---|---|---|
| `tbl_KMM_Contas.xlsx` | 11/08 | 14/08 — **conteúdo idêntico** |
| `tbl_KMM_Organizacional.xlsx` | 11/08 | 17/08 — **1 linha nova, 20 alteradas** |

Ou seja: **esta pasta é a montante e o repositório guarda uma fotografia que
envelhece sozinha.** Enquanto os dois existirem, alguém vai carregar do arquivo
velho sem perceber.

**Proposta:** o carregador aponta para a pasta do SharePoint por variável de
ambiente (`FPA_DW_DIR`), e o repositório para de versionar as cópias. Onde não
der (máquina sem o SharePoint sincronizado), um passo explícito de sincronizar
que **mostra o diff antes de sobrescrever** — nunca uma cópia silenciosa.

### ⚠ Duas coisas nas alterações que valem uma conferida sua

**19 das 20 linhas alteradas mudaram a coluna `Gastos`, todas para `Buonny`** —
vindas de KMM (5), Digitalcomm (3), Opentech (3), Multisoftware (2), Buonny-BPS
(2), e uma de cada: LogOne, Atua Redes, Nstech, Trizy. `Gastos` decide para qual
empresa o custo vai. Pode ser consolidação legítima da Buonny; também é o padrão
de um preenchimento arrastado por engano. **Só quem mantém a planilha sabe.**

**A linha nova foi inserida por automação de IA**, e ela mesma se declara:

```
IA_Inserido_Por    = 'Automacao IA+Python'
IA_Confianca       = '0.95'
IA_Status_Revisao  = 'Necessita Validacao'
```

É a confirmação do alerta do `BANCO-DE-DADOS.md`: **filtrar por
`IA_Status_Revisao` antes de tratar a organizacional como verdade.** Carregar sem
filtro é aceitar como cadastro algo que a própria fonte marcou como pendente.

---

## Ordem sugerida

1. **`tbl_dbEmpresas` → `bu`, `torre`, `sub_torre`, `empresa`.** É a maior fatia
   de valor e destrava o resto do cadastro. Decidir antes: `BU2025`/`Torre2025`
   (recomendo) ou `BU`/`Torre`.
2. **`Layouts_BI` → `linha_pl`**, com a migration `08-` das quatro colunas novas.
   Some a ordem inventada.
3. **Apontar os carregadores para a pasta** e parar de versionar cópia.
4. **Organizacional** só depois de decidido o filtro de `IA_Status_Revisao` e
   confirmadas as 19 mudanças de `Gastos`.
5. `Keyreclass`, `Rateios`, `BIConn` e `deltaclient_base` ficam para a Fase 6.

## O que eu não faria

**Copiar as oito planilhas para dentro do repositório.** Já temos a lição das
duas atuais: cópia versionada de arquivo vivo vira divergência. E o repositório
já carrega 3.797 CNPJs e 20 MB de planilha, o que é um item aberto nas pendências
do dono da nsView.

---

## Feito em 19/08 — a hierarquia carregada

`ferramentas/carrega_organizacao_no_banco.py` carrega BU → Torre → Sub Torre →
Empresa do `tbl_dbEmpresas.xlsx`. **A Fase 1 deixou de depender de decisão
pendente.**

| | |
|---|---:|
| BUs | 6 (mais 1 de teste, resíduo da Fase 0) |
| Torres | 18 |
| Sub torres | 29 |
| Empresas ativas | **154** de 177 |
| Com CNPJ | 59 |
| Com sub torre | 160 |

```
BU EMBARCADOR  7 torres · 14 sub · 77 empresas
BU PSL         7 torres ·  9 sub · 41 empresas
Corporate      1 torre  ·  3 sub · 31 empresas
Projetos · Coligada · Teste            5 empresas
```

As duas empresas semeadas na Fase 0 (`E-ALFA`, `E-BETA`) foram **inativadas**,
não apagadas — há lançamento apontando para elas. Pelo mesmo motivo a BU `PSL` de
teste continua na tabela, agora sem empresa ativa.

### Duas grafias divergentes, tratadas de formas diferentes

**`BU EMBARCADOR` (83) e `BU Embarcador` (1) foram unificadas.** As duas geram o
mesmo código, então o upsert as juntaria de qualquer jeito — mas o *nome* gravado
seria o da última linha lida, decidido por ordenação. O carregador agora escolhe
a **grafia mais frequente** e registra o que absorveu.

**`SW Embarcador` (41) e `Torre SW Embarcador` (1) NÃO foram unificadas**, e é
decisão sua. Tirar o prefixo "Torre" para juntar é palpite, e juntar torre errada
move empresa de lugar no consolidado. O carregador avisa e segue com as duas.

### O que ainda decide o resultado

**Usei `BU2025`/`Torre2025`, não `BU`/`Torre`.** As duas duplas existem e
discordam — a antiga tem 12 valores de BU com granularidade de torre. Se a
hierarquia certa for a outra, é trocar duas linhas no carregador e recarregar.
