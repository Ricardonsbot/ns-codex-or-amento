# NS Codex — como testar

Maquete navegável do processo de budget. Não é o sistema final: serve para
alinhar **como o processo deveria funcionar** antes de construir.

## Para abrir

Descompacte a pasta e dê **duplo clique em `index.html`**. Abre no navegador.

Não precisa instalar nada, não precisa de internet e nada é enviado para lugar
nenhum — tudo roda dentro do seu navegador, na sua máquina.

> Se estiver usando Chrome ou Edge, funciona direto. Se alguma tela vier vazia,
> tente abrir com outro navegador.

## O que já vem preenchido

| | |
|---|---|
| Plano de contas | **425 contas** reais — 207 já com pacote e subpacote |
| Pacotes de FP&A | **10**, cada um com seus subpacotes |
| Centros de custo | **104**, com código, nome e diretoria (10 diretorias) |
| Empresas | **50**, em 15 torres e 3 BUs |
| Clientes | **3797 CNPJs** com razão social, setor, segmento e classe |
| Produtos | **67**, sendo 14 com sub-produto (33 no total) |
| Fornecedores | **1040** |

As grades já vêm com **60 linhas de Receita, 60 de Despesa e 19 de Capex**,
todas com dados reais do Template Budget PSL. O cadastro de contas, pacotes,
produtos e centros de custo vem do Template Budget das Torres. Pode editar, apagar e acrescentar
à vontade — **nada é gravado**. Ao fechar o navegador tudo volta ao estado
original.

## Por onde começar

**1. Lançar na planilha** — `(+) Revenue`, `(−) Expenses` ou `(−) Capex` no menu
da esquerda. A tela abre direto na grade.

- Filtre por **BU → Torre → Empresa** no topo; a lista de empresas acompanha
- Digite na coluna **Conta** e as sugestões aparecem — o código, a linha do
  P&L, o pacote e o subpacote se preenchem sozinhos
- Na Receita, preencha o **Nome do Cliente** *ou* o **CNPJ**: o outro vem
  junto, com PMR, persona, setor, segmento e classe
- **Cole direto do Excel**: copie um bloco de meses e cole em cima de Janeiro
- `+ Adicionar Linha` no canto superior direito do painel

**2. Importar planilha** — sobe o **Template Budget** como ele é, sem recortar
nada. Só precisa estar em `.xlsx`: arquivo `.xlsb` (Excel binário) não é lido —
no Excel, *Arquivo → Salvar como → Pasta de Trabalho do Excel*. O sistema acha a aba certa, confere linha por linha e mostra o que
impede antes de aceitar. Vale testar com um arquivo de verdade.

**3. Dashboard Executivo** — a leitura do ciclo numa tela. O botão
**Gerar PowerPoint** baixa uma apresentação de 6 slides com os números que
estão na tela.

## O que é real e o que é simulado

**Real:** todos os cadastros, a leitura e a conferência de planilhas, os
cálculos, o export em CSV, PDF e PowerPoint.

**Simulado:** salvar. Não há banco de dados — os botões de gravar, enviar para
aprovação e aprovar mostram o que aconteceria, mas nada persiste.

## O que ainda não existe

- Orçado vs. realizado
- Cópia do orçamento do ciclo anterior
- Cálculo do reajuste pelo aniversário do contrato (o campo já está lá, a conta
  ainda não)
- Ativação vinda da planilha — o template do PSL não traz essa coluna

## Onde anotar o retorno

Qualquer coisa que pareça errada, faltando ou confusa. O mais útil é: **o que
você tentou fazer e onde travou.**
