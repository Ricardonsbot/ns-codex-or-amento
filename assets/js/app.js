/*
 * app.js — comportamento de PROTÓTIPO.
 * Nenhuma chamada de rede/backend acontece aqui: os botões apenas simulam
 * o que a ação faria (toast de feedback, mudança de badge, linha de tabela
 * adicionada/removida na tela) para dar a sensação do fluxo real.
 *
 * Única exceção: a exportação do Dashboard, que acontece de verdade — em PDF
 * (imprime a própria página, via @media print) e em CSV (gera e baixa o
 * arquivo a partir do que está na tela). Ainda sem backend: tudo no navegador.
 */

/* ---------- Leitura dos dados de Referencias/ ----------
 * Sem cache de propósito: a graça do protótipo é editar o JSON e ver a tela
 * mudar. O navegador guardava a versão antiga e a alteração "não aparecia".
 */

function carregarRef(arquivo) {
  return fetch(`Referencias/${arquivo}?v=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
}

/* ---------- Toast ---------- */

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity .2s ease";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 200);
  }, 2800);
}

/* ---------- Modal genérico (data-modal-target / data-modal-close) ---------- */

function initModals() {
  document.querySelectorAll("[data-modal-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-modal-open");
      const modal = document.getElementById(id);
      if (modal) modal.classList.add("open");
    });
  });

  document.querySelectorAll("[data-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".modal-overlay")?.classList.remove("open");
    });
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  });
}

/* ---------- Ações simuladas genéricas (data-action) ---------- */

function initSimulatedActions() {
  document.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const action = el.getAttribute("data-action");
      const label = el.getAttribute("data-action-label") || "Ação";

      switch (action) {
        case "save-draft":
          showToast(`Rascunho salvo: ${label}`, "success");
          break;
        case "submit-approval":
          showToast(`Enviado para aprovação: ${label}`, "info");
          updateStatusBadge(el, "status-em-aprovacao", "Em aprovação");
          break;
        case "approve":
          showToast(`Aprovado: ${label}`, "success");
          updateStatusBadge(el, "status-aprovado", "Aprovado");
          break;
        case "reject":
          showToast(`Reprovado: ${label}`, "warning");
          updateStatusBadge(el, "status-reprovado", "Reprovado");
          break;
        case "export":
          showToast(`Exportação simulada gerada: ${label}`, "info");
          break;
        case "delete-row":
          el.closest("tr")?.remove();
          showToast(`Linha removida: ${label}`, "warning");
          break;
        case "duplicate-row": {
          const row = el.closest("tr");
          if (row) {
            const clone = row.cloneNode(true);
            row.after(clone);
            rebindRow(clone);
          }
          showToast(`Linha duplicada: ${label}`, "info");
          break;
        }
        case "new-cycle":
          showToast("Novo ciclo de orçamento criado (simulação)", "success");
          break;
        case "login":
          showToast("Login simulado com sucesso. Redirecionando...", "success");
          setTimeout(() => { window.location.href = "index.html"; }, 900);
          break;
        case "sso-login":
          showToast(`Autenticação simulada via ${label}. Redirecionando...`, "info");
          setTimeout(() => { window.location.href = "index.html"; }, 900);
          break;
        case "forgot-password":
          showToast("Fluxo de recuperação de senha simulado", "info");
          break;
        case "view-bu":
          showToast(`Carregando Budget: ${label}`, "info");
          setTimeout(() => { window.location.href = "index.html"; }, 700);
          break;
        case "start-launch":
          showToast(`Lançamento iniciado: ${label}`, "success");
          setTimeout(() => { window.location.href = "orcamento-receita.html"; }, 700);
          break;
        case "replicate-months":
          replicateJanToAllMonths(el.closest("tr"), label);
          break;
        default:
          showToast(`${label}: ação simulada`, "info");
      }
    });
  });
}

function replicateJanToAllMonths(row, label) {
  if (!row) return;
  const monthInputs = Array.from(row.querySelectorAll("td.month-col input"));
  if (monthInputs.length < 2) return;
  const janValue = monthInputs[0].value;
  monthInputs.forEach((input) => { input.value = janValue; });
  showToast(`Valor de Jan (${janValue}) replicado para os 12 meses: ${label}`, "success");
}

function rebindRow(row) {
  row.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const action = el.getAttribute("data-action");
      const label = el.getAttribute("data-action-label") || "Ação";
      if (action === "delete-row") {
        row.remove();
        showToast(`Linha removida: ${label}`, "warning");
      } else if (action === "duplicate-row") {
        const clone = row.cloneNode(true);
        row.after(clone);
        rebindRow(clone);
        showToast(`Linha duplicada: ${label}`, "info");
      } else if (action === "replicate-months") {
        replicateJanToAllMonths(row, label);
      }
    });
  });
  row.querySelectorAll(".conta-nome-input").forEach(bindContaLookup);
}

function updateStatusBadge(triggerEl, newClass, newLabel) {
  const scope = triggerEl.closest("[data-status-scope]");
  if (!scope) return;
  const badge = scope.querySelector(".badge");
  if (!badge) return;
  badge.className = "badge " + newClass;
  badge.innerHTML = `<span class="badge-dot"></span>${newLabel}`;
}

/* ---------- Adicionar linha em tabelas de orçamento ---------- */

function initAddRow() {
  document.querySelectorAll("[data-add-row]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tableId = btn.getAttribute("data-add-row");
      const table = document.getElementById(tableId);
      if (!table) return;
      const tbody = table.querySelector("tbody");
      const template = tbody.querySelector("tr");
      if (!template) return;

      const clone = template.cloneNode(true);
      clone.querySelectorAll("input").forEach((input) => {
        if (input.type === "number") input.value = "0";
        else input.value = "";
      });
      tbody.appendChild(clone);
      clone.hidden = false; // a linha modelo pode estar escondida por um filtro de pacote

      // a linha nova já nasce no pacote escolhido no contexto do lançamento
      const pacoteInput = clone.querySelector(".pacote-input");
      if (pacoteInput) pacoteInput.value = pacoteDoContexto();

      rebindRow(clone);
      document.querySelectorAll("[data-pacote-filtro]").forEach(aplicarFiltroPacote);
      showToast("Nova linha adicionada", "success");
      clone.querySelector("input")?.focus();
    });
  });
}

/* ---------- Tabs genéricas (data-tabs / data-tab-target / data-tab-panel) ---------- */

function initTabs() {
  document.querySelectorAll("[data-tabs]").forEach((tabs) => {
    tabs.querySelectorAll("[data-tab-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-tab-target");

        tabs.querySelectorAll("[data-tab-target]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const panelGroup = document.querySelector(`[data-tab-panel-group="${tabs.getAttribute("data-tabs")}"]`) || document;
        panelGroup.querySelectorAll(".tab-panel").forEach((panel) => {
          panel.classList.toggle("active", panel.id === targetId);
        });
      });
    });
  });
}

/* ---------- Agrupar/desagrupar colunas de meses (economiza espaço na grade) ---------- */

function initMonthGroup() {
  document.querySelectorAll("[data-month-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const table = document.getElementById(btn.getAttribute("data-month-toggle"));
      if (!table) return;

      const collapsed = table.classList.toggle("months-collapsed");
      const icon = btn.querySelector(".month-toggle-icon");
      if (icon) icon.textContent = collapsed ? "+" : "−";
      btn.lastChild.textContent = collapsed ? " Meses (agrupado)" : " Meses";
      btn.title = collapsed ? "Desagrupar meses" : "Agrupar meses";
    });
  });
}

/* ---------- Sugestões de Conta e Organizacional (pasta Referencias/) ---------- */

/* ---------- Cada conta na sua categoria ----------
 * O plano de contas já separa Receita, Despesa e Capex — está no prefixo da
 * linha do P&L, que veio de FPA_Pacote. O que faltava era a tela respeitar
 * isso: com uma lista só, dava para lançar "SALARIOS E ORDENADOS" em Capex e
 * "EQUIPAMENTOS DE INFORMATICA" em Despesa, e a classificação entrava errada
 * sem ninguém perceber.
 *
 * A tradução prefixo -> categoria mora só aqui. A lista de sugestão, o
 * preenchimento automático e a conferência da importação leem deste mesmo
 * ponto — se cada um tivesse a sua, uma aceitaria o que a outra recusa.
 */

const CONTA_PREFIXO = { receita: "Receita", despesa: "Despesas", capex: "Capex" };
const CONTA_ROTULO = { receita: "Receita", despesa: "Despesa", capex: "Capex" };

function categoriaDaConta(conta) {
  const linha = String(conta?.linhaPL || "");
  return Object.keys(CONTA_PREFIXO).find((k) => linha.startsWith(CONTA_PREFIXO[k] + " >")) || null;
}

function contasDaCategoria(contas, categoria) {
  return categoria ? contas.filter((c) => categoriaDaConta(c) === categoria) : contas;
}

/* A categoria da tela é a mesma marca que a barra de versão já usa para achar
   o prazo do cronograma. Uma declaração só, dois usos. */
function categoriaDaTela() {
  return document.querySelector("[data-versao-barra]")?.dataset.versaoBarra || null;
}

/* No plano de contas real 404 contas orçáveis têm só 323 descrições distintas:
   "COMPARTILHAMENTO DE DESPESAS" aparece em sete contas diferentes. A descrição
   sozinha, portanto, não identifica nada — a opção da lista precisa levar o
   código junto. Depois de escolhida, o campo volta a mostrar só a descrição,
   porque o código já tem coluna própria na grade. */
function rotuloConta(c) {
  return `${c.conta} — ${c.nome}`;
}

function encherDatalist(id, valores) {
  const alvo = document.getElementById(id);
  if (!alvo) return;
  [...new Set(valores)].filter((v) => v && v !== "-").sort().forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    alvo.appendChild(opt);
  });
}

function initReferenceAutocomplete() {
  const contasDatalist = document.getElementById("contas-datalist");
  const centrosDatalist = document.getElementById("centros-datalist");
  // a Receita não tem conta nem centro de custo: ela sugere Torre, Empresa e
  // Produto. Sem este terceiro alvo o init saía antes e as listas dela
  // continuavam vazias, como estavam desde sempre.
  const torresDatalist = document.getElementById("torres-datalist");
  if (!contasDatalist && !centrosDatalist && !torresDatalist) return;

  Promise.all([
    carregarRef("contas.json").catch(() => []),
    carregarRef("centros-custo.json").catch(() => null),
    carregarRef("organizacional.json").catch(() => []),
    carregarRef("produtos.json").catch(() => null),
  ]).then(([contas, centrosRef, organizacional, produtosRef]) => {
    // a tela só sugere e só aceita conta da sua categoria; o resto do plano
    // fica guardado para explicar a recusa em vez de o campo não fazer nada
    const categoria = categoriaDaTela();
    window.__contasRef = contasDaCategoria(contas, categoria);
    window.__contasTodas = contas;
    window.__contaCategoria = categoria;

    if (contasDatalist) {
      window.__contasRef.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = rotuloConta(c);
        contasDatalist.appendChild(opt);
      });
    }

    if (centrosDatalist) {
      // Centro de custo de verdade tem código; as Torres entram como alternativa
      // porque o cadastro real ainda só cobre parte das empresas.
      const opcoes = (centrosRef?.centros || []).map((c) => `${c.codigo} — ${c.nome}`);
      const unidades = new Set(organizacional.map((o) => o.torre).filter((t) => t && t !== "-"));
      unidades.forEach((u) => opcoes.push(u));

      opcoes.forEach((valor) => {
        const opt = document.createElement("option");
        opt.value = valor;
        centrosDatalist.appendChild(opt);
      });
    }

    // O caminho da Receita: Torre → Empresa → Produto → Sub-produto → Tipo.
    // As mesmas fontes das outras telas, para a grade não sugerir empresa que
    // o formulário guiado recusa.
    encherDatalist("torres-datalist", organizacional.map((o) => o.torre));
    encherDatalist("empresas-datalist", organizacional.map((o) => o.empresa));
    if (produtosRef) {
      encherDatalist("produtos-datalist", produtosRef.produtos.map((p) => p.nome));
      encherDatalist("subprodutos-datalist", produtosRef.produtos.flatMap((p) => p.subProdutos));
      encherDatalist("tiposreceita-datalist", produtosRef.tiposReceita);
    }

    document.querySelectorAll(".conta-nome-input").forEach(bindContaLookup);
  });
}

function bindContaLookup(input) {
  // aceita o rótulo inteiro, só o código ou só a descrição — nesta última a
  // primeira conta que casa é a escolhida, e o código fica visível na grade
  const acha = (lista, digitado) =>
    lista.find((c) => rotuloConta(c) === digitado)
    || lista.find((c) => c.conta === digitado)
    || lista.find((c) => c.nome === digitado);

  input.addEventListener("change", () => {
    const digitado = input.value.trim();
    const match = acha(window.__contasRef || [], digitado);

    // Conta de outra categoria não entra calada: sem este aviso o campo
    // simplesmente não reagiria, e quem lança acharia que a conta não existe.
    if (!match) {
      const deFora = acha(window.__contasTodas || [], digitado);
      const daTela = CONTA_ROTULO[window.__contaCategoria];
      if (deFora && daTela) {
        showToast(`${deFora.conta} é conta de ${CONTA_ROTULO[categoriaDaConta(deFora)]} — ` +
          `esta tela só lança ${daTela}`, "warning");
      }
      return;
    }

    const row = input.closest("tr");
    const codigoInput = row?.querySelector(".conta-codigo-input");
    const linhaInput = row?.querySelector(".conta-linha-input");
    const categoriaInput = row?.querySelector(".conta-categoria-input");
    input.value = match.nome;
    if (codigoInput) codigoInput.value = match.conta;
    if (linhaInput) linhaInput.value = match.linhaPL;
    if (categoriaInput) categoriaInput.value = match.categoria;
    showToast(`Conta ${match.conta} — ${match.nome} reconhecida`, "success");
  });
}

/* ---------- Colar em matriz (estilo Excel) nas grades de lançamento ---------- */

function initExcelPaste() {
  document.querySelectorAll(".entry-grid").forEach((table) => {
    table.addEventListener("paste", (e) => {
      const input = e.target.closest("input");
      if (!input) return;

      const clipboard = (e.clipboardData || window.clipboardData).getData("text");
      if (!clipboard || !/[\t\n]/.test(clipboard)) return; // valor único: deixa o paste padrão acontecer

      e.preventDefault();

      const startCell = input.closest("td");
      const startRow = input.closest("tr");
      const startColIndex = Array.from(startRow.children).indexOf(startCell);
      const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
      const startRowIndex = bodyRows.indexOf(startRow);

      const pastedRows = clipboard.replace(/\r/g, "").split("\n").filter((line, i, arr) => !(i === arr.length - 1 && line === ""));

      let filled = 0;
      pastedRows.forEach((line, rOffset) => {
        const targetRow = bodyRows[startRowIndex + rOffset];
        if (!targetRow) return;
        line.split("\t").forEach((value, cOffset) => {
          const targetInput = targetRow.children[startColIndex + cOffset]?.querySelector("input");
          if (targetInput) {
            targetInput.value = value.trim();
            filled++;
          }
        });
      });

      if (filled) showToast(`${filled} célula(s) preenchida(s) a partir da área de transferência`, "success");
    });
  });
}

/* ---------- Sidebar retrátil ---------- */

function initSidebarToggle() {
  document.querySelectorAll("[data-sidebar-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sidebar = document.querySelector(".sidebar");
      sidebar?.classList.toggle("collapsed");
    });
  });
}

/* ---------- Linhas selecionáveis com painel auxiliar dinâmico (drill-down) ---------- */

function initDrillRows() {
  document.querySelectorAll("[data-drill-target]").forEach((row) => {
    row.addEventListener("click", () => {
      const table = row.closest("table");
      table?.querySelectorAll("[data-drill-target]").forEach((r) => r.classList.remove("selected"));
      row.classList.add("selected");

      const targetId = row.getAttribute("data-drill-target");
      document.querySelectorAll(".aux-drill").forEach((panel) => {
        panel.classList.toggle("active", panel.id === targetId);
      });
    });
  });
}

/* ---------- Colapsar/expandir BU e Torre nas tabelas de hierarquia ---------- */

const HIER_LEVELS = ["report-bu-row", "report-torre-row", "report-subtorre-row", "report-empresa-row"];
const HIER_TOGGLE_LEVELS = [0, 1]; // BU e Torre

function hierLevel(row) {
  return HIER_LEVELS.findIndex((cls) => row.classList.contains(cls));
}

/* Recalcula a visibilidade de todas as linhas a partir de quem está recolhido.
   Assim uma Torre recolhida continua recolhida depois de fechar e reabrir a BU. */
function refreshHierarchyVisibility(rows) {
  let hiddenAbove = null; // nível da linha recolhida que está escondendo as de baixo

  rows.forEach((row) => {
    const level = hierLevel(row);

    if (hiddenAbove !== null && level > hiddenAbove) {
      row.hidden = true;
      return;
    }

    hiddenAbove = null;
    row.hidden = false;
    if (row.classList.contains("hier-collapsed")) hiddenAbove = level;
  });
}

function initHierarchyCollapse() {
  document.querySelectorAll("[data-hierarchy-collapse]").forEach((table) => {
    const rows = Array.from(table.querySelectorAll("tbody tr"));

    rows.forEach((row, index) => {
      const level = hierLevel(row);
      if (!HIER_TOGGLE_LEVELS.includes(level)) return;

      // sem linha de nível mais profundo logo abaixo: não há detalhe a colapsar
      const next = rows[index + 1];
      if (!next || hierLevel(next) <= level) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hier-toggle";
      btn.textContent = "−";
      btn.title = "Recolher";
      btn.setAttribute("aria-expanded", "true");

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const collapsed = row.classList.toggle("hier-collapsed");
        btn.textContent = collapsed ? "+" : "−";
        btn.title = collapsed ? "Expandir" : "Recolher";
        btn.setAttribute("aria-expanded", String(!collapsed));
        refreshHierarchyVisibility(rows);
      });

      row.querySelector("td:first-child")?.prepend(btn);
    });
  });
}

/* ---------- Exportar o Dashboard em CSV ----------
 * Exceção ao resto do protótipo: aqui o arquivo é gerado e baixado de verdade,
 * a partir do que está na tela. Continua sem backend — tudo acontece no navegador.
 * Separador ";" e BOM UTF-8 para o Excel em pt-BR abrir com acento e número certos.
 */

function csvCell(value) {
  const text = String(value ?? "").trim();
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/* "− R$ 96,7 mi" -> "-96,7" (número, não texto, na planilha); null se não for valor */
function moneyToNumber(text) {
  const match = String(text).trim().match(/^(−|-)?\s*R\$\s*([\d.]*\d(?:,\d+)?)\s*mi$/);
  return match ? (match[1] ? "-" : "") + match[2] : null;
}

/* O texto que a célula mostra, sem o botão de recolher que initHierarchyCollapse
   enfia na primeira coluna — senão a BU sai como "−Corporate" na planilha. */
function celulaTexto(cel) {
  if (!cel) return "";
  const botao = cel.querySelector(".hier-toggle");
  if (!botao) return cel.textContent.trim();
  return Array.from(cel.childNodes).filter((n) => n !== botao).map((n) => n.textContent).join("").trim();
}

function pushTable(table, push) {
  const headers = Array.from(table.querySelectorAll("thead th"));
  // colunas sem título são de ação ("Ver detalhes"): não vão para a planilha
  const cols = headers.map((th, i) => (th.textContent.trim() ? i : -1)).filter((i) => i >= 0);
  const firstRow = table.querySelector("tbody tr");

  push(...cols.map((i) => {
    const label = headers[i].textContent.trim();
    const sample = firstRow?.children[i]?.textContent || "";
    return moneyToNumber(sample) !== null ? `${label} (R$ mi)` : label;
  }));

  table.querySelectorAll("tbody tr").forEach((row) => {
    push(...cols.map((i) => {
      const text = celulaTexto(row.children[i]);
      return moneyToNumber(text) ?? text;
    }));
  });
}

function buildDashboardCsv() {
  const lines = [];
  const push = (...cells) => lines.push(cells.map(csvCell).join(";"));

  push(document.querySelector(".topbar-title h1")?.textContent || "Dashboard");
  push(document.querySelector(".topbar-title p")?.textContent || "");
  push("Exportado em", new Date().toLocaleString("pt-BR"));
  push("");

  const filtros = document.querySelectorAll(".filter-bar .filter-field");
  if (filtros.length) {
    push("Filtros aplicados");
    filtros.forEach((field) => {
      const select = field.querySelector("select");
      if (!select) return;
      // o rótulo visível, não o `value` — "Todas as BUs" diz mais que "" na planilha
      push(field.querySelector("label")?.textContent, select.selectedOptions[0]?.textContent ?? select.value);
    });
    push("");
  }

  const colunas = document.querySelectorAll(".bridge-chart .bridge-col");
  if (colunas.length) {
    const panel = colunas[0].closest(".panel");
    push(panel?.querySelector(".panel-header h2")?.textContent || "Resumo do Orçamento");
    push("Indicador", "Valor (R$ mi)");
    colunas.forEach((col) => {
      const label = col.querySelector(".bridge-label");
      const sinal = label?.querySelector(".bridge-sign")?.textContent.trim() || "";
      const nome = ((sinal ? sinal + " " : "") + (label?.textContent || "").replace(sinal, "").trim()).trim();
      const valor = col.querySelector(".bridge-value")?.textContent || "";
      push(nome, moneyToNumber(valor) ?? valor);
    });
    push("");
  }

  document.querySelectorAll(".content .panel").forEach((panel) => {
    const table = panel.querySelector("table");
    if (!table) return;
    push(panel.querySelector(".panel-header h2")?.textContent || "Tabela");
    pushTable(table, push);
    push("");
  });

  return lines.join("\r\n");
}

/* Mesmo download do downloadTextFile, mas para conte\u00FAdo bin\u00E1rio j\u00E1 pronto
   (o .xlsx \u00E9 um Blob de ZIP, n\u00E3o d\u00E1 para prefixar BOM nem tratar como texto). */
function downloadBlobFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename, content, mime) {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* PDF = impressão do próprio HTML. Sem biblioteca: o papel usa o @media print
   do style.css, então sai igual à tela. O usuário escolhe "Salvar como PDF". */
function initPdfExport() {
  document.querySelectorAll("[data-export-pdf]").forEach((el) => {
    el.addEventListener("click", () => {
      showToast('Abrindo a impressão — escolha "Salvar como PDF" no destino', "info");
      setTimeout(() => window.print(), 200);
    });
  });
}

function initDashboardExport() {
  document.querySelectorAll("[data-export-dashboard]").forEach((el) => {
    el.addEventListener("click", () => {
      const filename = `dashboard-orcamento-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadTextFile(filename, buildDashboardCsv(), "text/csv;charset=utf-8;");
      showToast(`Dashboard exportado: ${filename}`, "success");
    });
  });
}

/* ---------- Entregas: organograma de quem entrega o quê ----------
 * Uma "entrega" = uma empresa × uma categoria (Receita, Despesa, Capex).
 * A árvore vem de Referencias/entregas.json; os níveis marcados com "-"
 * (sem Sub Torre, por exemplo) são pulados em vez de virarem nó vazio.
 */

const ENTREGA_CATEGORIAS = ["receita", "despesa", "capex"];

const ENTREGA_ROTULO_CATEGORIA = { receita: "Receita", despesa: "Despesa", capex: "Capex" };

const ENTREGA_STATUS = {
  "aprovado": { rotulo: "Entregue", classe: "status-aprovado", concluida: true },
  "em-aprovacao": { rotulo: "Enviado", classe: "status-em-aprovacao", concluida: false },
  "rascunho": { rotulo: "Preenchendo", classe: "status-rascunho", concluida: false },
  // devolvido é diferente de reprovado: a bola voltou para o responsável e
  // ainda conta como entrega pendente, não como recusa definitiva
  "devolvido": { rotulo: "Devolvido", classe: "status-rascunho", concluida: false },
  "reprovado": { rotulo: "Reprovado", classe: "status-reprovado", concluida: false },
  "nao-iniciado": { rotulo: "Não iniciado", classe: "status-nao-iniciado", concluida: false },
};

function escaparTexto(valor) {
  return String(valor ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function infoStatusEntrega(status) {
  return ENTREGA_STATUS[status] || ENTREGA_STATUS["nao-iniciado"];
}

/* atrasada = prazo da categoria já passou e a entrega ainda não foi concluída */
function entregaAtrasada(status, prazoISO) {
  if (!prazoISO || infoStatusEntrega(status).concluida) return false;
  return new Date(prazoISO + "T23:59:59") < new Date();
}

/* achata o JSON em uma linha por (empresa × categoria), já aplicando os filtros */
function linhasDeEntrega(dados, filtros) {
  const linhas = [];

  dados.entregas.forEach((entrega) => {
    if (filtros.bu && entrega.bu !== filtros.bu) return;
    if (filtros.responsavel && entrega.responsavel !== filtros.responsavel) return;

    ENTREGA_CATEGORIAS.forEach((categoria) => {
      if (filtros.categoria && categoria !== filtros.categoria) return;

      const status = entrega.status[categoria];
      const atrasada = entregaAtrasada(status, dados.prazos[categoria]);
      const concluida = infoStatusEntrega(status).concluida;

      if (filtros.situacao === "pendente" && concluida) return;
      if (filtros.situacao === "atrasado" && !atrasada) return;
      if (filtros.situacao === "aprovado" && !concluida) return;

      linhas.push({ entrega, categoria, status, atrasada, concluida, prazo: dados.prazos[categoria] });
    });
  });

  return linhas;
}

function agruparEntregas(linhas) {
  const raiz = { filhos: new Map(), empresas: new Map() };

  linhas.forEach((linha) => {
    const { bu, torre, subTorre, empresa, responsavel } = linha.entrega;
    let no = raiz;

    [bu, torre, subTorre].forEach((nome) => {
      if (!nome || nome === "-") return; // nível não existe para esta empresa: pula
      if (!no.filhos.has(nome)) no.filhos.set(nome, { nome, filhos: new Map(), empresas: new Map() });
      no = no.filhos.get(nome);
    });

    if (!no.empresas.has(empresa)) no.empresas.set(empresa, { nome: empresa, responsavel, linhas: [] });
    no.empresas.get(empresa).linhas.push(linha);
  });

  return raiz;
}

function resumoDoNo(no) {
  const total = { entregas: 0, concluidas: 0, atrasadas: 0, responsaveis: new Set() };

  no.empresas.forEach((emp) => {
    total.responsaveis.add(emp.responsavel);
    emp.linhas.forEach((linha) => {
      total.entregas++;
      if (linha.concluida) total.concluidas++;
      if (linha.atrasada) total.atrasadas++;
    });
  });

  no.filhos.forEach((filho) => {
    const sub = resumoDoNo(filho);
    total.entregas += sub.entregas;
    total.concluidas += sub.concluidas;
    total.atrasadas += sub.atrasadas;
    sub.responsaveis.forEach((r) => total.responsaveis.add(r));
  });

  return total;
}

function htmlChipEntrega(linha) {
  const info = infoStatusEntrega(linha.status);
  const classe = linha.atrasada ? "status-atrasado" : info.classe;
  const rotulo = linha.atrasada ? `${info.rotulo} · atrasada` : info.rotulo;
  const prazo = linha.prazo ? new Date(linha.prazo + "T12:00:00").toLocaleDateString("pt-BR") : "";

  return `<span class="entrega-chip" title="Prazo: ${prazo}">
    <span class="entrega-chip-cat">${ENTREGA_ROTULO_CATEGORIA[linha.categoria]}</span>
    <span class="badge ${classe}"><span class="badge-dot"></span>${rotulo}</span>
  </span>`;
}

function htmlBarraProgresso(resumo) {
  const pct = resumo.entregas ? Math.round((resumo.concluidas / resumo.entregas) * 100) : 0;
  const atraso = resumo.atrasadas
    ? `<span class="org-atrasadas">${resumo.atrasadas} atrasada${resumo.atrasadas > 1 ? "s" : ""}</span>`
    : "";

  return `<span class="org-progresso">
    <span class="org-progresso-trilho"><span class="org-progresso-barra" style="width:${pct}%"></span></span>
    <span class="org-progresso-texto">${resumo.concluidas}/${resumo.entregas}</span>
    ${atraso}
  </span>`;
}

function htmlEmpresaEntrega(empresa) {
  const chips = empresa.linhas.map(htmlChipEntrega).join("");
  const devendo = empresa.linhas.filter((l) => !l.concluida).length;
  const rotuloCobranca = devendo ? `Cobrar (${devendo})` : "Em dia";

  return `<div class="org-empresa">
    <div class="org-empresa-id">
      <strong>${escaparTexto(empresa.nome)}</strong>
      <span class="org-responsavel">👤 ${escaparTexto(empresa.responsavel)}</span>
    </div>
    <div class="org-chips">${chips}</div>
    <button class="btn btn-ghost btn-sm org-cobrar" ${devendo ? "" : "disabled"}
      data-cobrar-responsavel="${escaparTexto(empresa.responsavel)}"
      data-cobrar-empresa="${escaparTexto(empresa.nome)}"
      data-cobrar-qtd="${devendo}">✉ ${rotuloCobranca}</button>
  </div>`;
}

function htmlNoEntrega(no, nivel, caminho, recolhidos) {
  const id = caminho.join(" › ");
  const recolhido = recolhidos.has(id);
  const resumo = resumoDoNo(no);
  const pessoas = resumo.responsaveis.size;

  const filhos = Array.from(no.filhos.values())
    .map((filho) => htmlNoEntrega(filho, nivel + 1, caminho.concat(filho.nome), recolhidos))
    .join("");
  const empresas = Array.from(no.empresas.values()).map(htmlEmpresaEntrega).join("");

  return `<div class="org-no nivel-${nivel}">
    <div class="org-linha" data-org-toggle="${escaparTexto(id)}">
      <button type="button" class="hier-toggle org-toggle" aria-expanded="${!recolhido}"
        title="${recolhido ? "Expandir" : "Recolher"}">${recolhido ? "+" : "−"}</button>
      <span class="org-nome">${escaparTexto(no.nome)}</span>
      <span class="org-meta">${pessoas} responsáve${pessoas === 1 ? "l" : "is"}</span>
      ${htmlBarraProgresso(resumo)}
    </div>
    <div class="org-filhos" ${recolhido ? "hidden" : ""}>${filhos}${empresas}</div>
  </div>`;
}

function initEntregas() {
  const arvore = document.querySelector("[data-org-tree]");
  if (!arvore) return;

  const filtros = { bu: "", responsavel: "", categoria: "", situacao: "" };
  const recolhidos = new Set();
  let dados = null;

  function redesenhar() {
    const linhas = linhasDeEntrega(dados, filtros);

    if (!linhas.length) {
      arvore.innerHTML = '<div class="empty-hint">Nenhuma entrega bate com esses filtros.</div>';
    } else {
      const raiz = agruparEntregas(linhas);
      arvore.innerHTML = Array.from(raiz.filhos.values())
        .map((no) => htmlNoEntrega(no, 0, [no.nome], recolhidos))
        .join("");
    }

    atualizarKpis(linhas);
  }

  function atualizarKpis(linhas) {
    const concluidas = linhas.filter((l) => l.concluida).length;
    const atrasadas = linhas.filter((l) => l.atrasada).length;
    const andamento = linhas.length - concluidas;
    const pct = linhas.length ? Math.round((concluidas / linhas.length) * 100) : 0;

    const escreve = (chave, valor) => {
      const el = document.querySelector(`[data-kpi="${chave}"]`);
      if (el) el.textContent = valor;
    };

    escreve("total", linhas.length);
    escreve("concluidas", concluidas);
    escreve("concluidas-pct", `${pct}% do ciclo`);
    escreve("andamento", andamento);
    escreve("atrasadas", atrasadas);
    escreve("atrasadas-hint", atrasadas ? "prazo vencido, cobrar agora" : "nenhum prazo vencido");
  }

  function preencherFiltros(entregas) {
    const opcoes = (seletor, valores) => {
      const select = document.querySelector(`[data-filtro="${seletor}"]`);
      if (!select) return;
      valores.forEach((valor) => {
        const opt = document.createElement("option");
        opt.value = valor;
        opt.textContent = valor;
        select.appendChild(opt);
      });
    };

    opcoes("bu", Array.from(new Set(entregas.map((e) => e.bu))));
    opcoes("responsavel", Array.from(new Set(entregas.map((e) => e.responsavel))).sort());
  }

  document.querySelectorAll("[data-filtro]").forEach((select) => {
    select.addEventListener("change", () => {
      filtros[select.getAttribute("data-filtro")] = select.value;
      redesenhar();
    });
  });

  document.querySelector("[data-filtro-limpar]")?.addEventListener("click", () => {
    Object.keys(filtros).forEach((chave) => { filtros[chave] = ""; });
    document.querySelectorAll("[data-filtro]").forEach((select) => { select.value = ""; });
    redesenhar();
    showToast("Filtros limpos", "info");
  });

  arvore.addEventListener("click", (e) => {
    const cobrar = e.target.closest("[data-cobrar-responsavel]");
    if (cobrar && !cobrar.disabled) {
      const qtd = cobrar.getAttribute("data-cobrar-qtd");
      showToast(
        `Cobrança enviada para ${cobrar.getAttribute("data-cobrar-responsavel")} — ${qtd} entrega(s) de ${cobrar.getAttribute("data-cobrar-empresa")}`,
        "info"
      );
      return;
    }

    const linha = e.target.closest("[data-org-toggle]");
    if (!linha) return;

    const id = linha.getAttribute("data-org-toggle");
    if (recolhidos.has(id)) recolhidos.delete(id);
    else recolhidos.add(id);
    redesenhar();
  });

  document.querySelector("[data-cobrar-pendentes]")?.addEventListener("click", () => {
    const pendentes = linhasDeEntrega(dados, filtros).filter((l) => !l.concluida);
    const pessoas = new Set(pendentes.map((l) => l.entrega.responsavel));
    if (!pendentes.length) {
      showToast("Nada pendente com os filtros atuais", "success");
      return;
    }
    showToast(`Cobrança enviada para ${pessoas.size} responsável(is) — ${pendentes.length} entregas pendentes`, "info");
  });

  carregarRef("entregas.json")
    .then((json) => {
      dados = json;
      preencherFiltros(json.entregas);
      redesenhar();
    })
    .catch(() => {
      arvore.innerHTML = '<div class="empty-hint">Não foi possível carregar <strong>Referencias/entregas.json</strong>.</div>';
    });
}

/* ---------- Pacote de gasto: separa a despesa pelo MOTIVO ----------
 * Duas linhas na mesma conta contábil podem ter motivos diferentes (uma viagem
 * de operação x uma viagem de abertura de mercado). O pacote é essa distinção.
 * Fonte: Referencias/pacotes.json.
 */

function totalAnualDaLinha(row) {
  return Array.from(row.querySelectorAll("td.month-col input"))
    .reduce((soma, input) => soma + (Number(input.value) || 0), 0);
}

function pacoteDaLinha(row) {
  return row.querySelector(".pacote-input")?.value.trim() || "";
}

function aplicarFiltroPacote(select) {
  const tabela = document.getElementById(select.getAttribute("data-pacote-filtro"));
  if (!tabela) return;

  const escolhido = select.value;
  const linhas = Array.from(tabela.querySelectorAll("tbody tr"));
  const pacotesEmUso = new Set();
  let totalGeral = 0;
  let totalVisivel = 0;
  let visiveis = 0;

  linhas.forEach((row) => {
    const pacote = pacoteDaLinha(row);
    const total = totalAnualDaLinha(row);
    const mostra = !escolhido || pacote === escolhido;

    totalGeral += total;
    if (pacote) pacotesEmUso.add(pacote);

    row.hidden = !mostra;
    if (mostra) {
      visiveis++;
      totalVisivel += total;
    }
  });

  const resumo = document.querySelector(`[data-pacote-resumo="${tabela.id}"]`);
  if (!resumo) return;

  const dinheiro = (valor) => `R$ ${valor.toLocaleString("pt-BR")} mil`;
  const termo = resumo.getAttribute("data-pacote-termo") || "gasto da grade";

  if (!escolhido) {
    resumo.innerHTML = `<strong>${linhas.length} linhas</strong> · ${pacotesEmUso.size} pacote(s) em uso · ${dinheiro(totalGeral)} no ano`;
    return;
  }

  const fatia = totalGeral ? Math.round((totalVisivel / totalGeral) * 100) : 0;
  resumo.innerHTML = visiveis
    ? `<strong>${escaparTexto(escolhido)}</strong> · ${visiveis} de ${linhas.length} linhas · ${dinheiro(totalVisivel)} no ano · <strong>${fatia}%</strong> ${termo === "gasto da grade" ? "do " + termo : "da " + termo}`
    : `<strong>${escaparTexto(escolhido)}</strong> · nenhuma linha nesse pacote ainda`;
}

/* cada tela de lançamento vê só os pacotes que fazem sentido nela */
function pacotesDoTipo(pacotes, tipo) {
  if (!tipo) return pacotes;
  return pacotes.filter((p) => !p.aplicaA || p.aplicaA.includes(tipo));
}

/* pacote escolhido no contexto vira o padrão das linhas novas */
function pacoteDoContexto() {
  const select = document.querySelector("[data-pacote-filtro]");
  return select ? select.value : "";
}

function initPacotes() {
  if (!document.querySelector("[data-pacote-filtro], [data-pacote-campo], #pacotes-datalist")) return;

  carregarRef("pacotes.json")
    .then(({ pacotes }) => {
      window.__pacotesRef = pacotes;

      const datalist = document.getElementById("pacotes-datalist");
      if (datalist) {
        pacotes.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.nome;
          opt.label = p.motivo;
          datalist.appendChild(opt);
        });
      }

      document.querySelectorAll("[data-pacote-filtro]").forEach((select) => {
        pacotesDoTipo(pacotes, select.getAttribute("data-pacote-tipo")).forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.nome;
          opt.textContent = `${p.nome} (${p.tipo})`;
          select.appendChild(opt);
        });
        select.addEventListener("change", () => aplicarFiltroPacote(select));

        // trocar o pacote de uma linha na mão recalcula o resumo na hora
        document.getElementById(select.getAttribute("data-pacote-filtro"))
          ?.addEventListener("change", (e) => {
            if (e.target.closest(".pacote-input") || e.target.matches("td.month-col input")) {
              aplicarFiltroPacote(select);
            }
          });

        aplicarFiltroPacote(select);
      });

      document.querySelectorAll("[data-pacote-campo]").forEach((select) => {
        pacotesDoTipo(pacotes, select.getAttribute("data-pacote-tipo")).forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.nome;
          opt.textContent = p.nome;
          select.appendChild(opt);
        });

        const motivo = select.closest(".panel-body, .field-group, form")?.querySelector("[data-pacote-motivo]")
          || document.querySelector("[data-pacote-motivo]");
        const mostrarMotivo = () => {
          const escolhido = pacotes.find((p) => p.nome === select.value);
          if (motivo && escolhido) motivo.textContent = `${escolhido.motivo} · ${escolhido.tipo}`;
        };
        select.addEventListener("change", mostrarMotivo);
        mostrarMotivo();
      });

      document.querySelectorAll("[data-pacote-legenda]").forEach((legenda) => {
        legenda.innerHTML = pacotesDoTipo(pacotes, legenda.getAttribute("data-pacote-tipo"))
          .map((p) => `<span class="pacote-tag" title="${escaparTexto(p.motivo)}">${escaparTexto(p.nome)}<em>${escaparTexto(p.tipo)}</em></span>`)
          .join("");
      });
    })
    .catch(() => {
      const resumo = document.querySelector("[data-pacote-resumo]");
      if (resumo) resumo.textContent = "Não foi possível carregar Referencias/pacotes.json.";
    });
}

/* ---------- Aprovações: status oficial, situação e validações ----------
 * Três coisas na mesma tela:
 *   1. o status OFICIAL do aprovador (quem decidiu, quando e com que parecer);
 *   2. o que falta de informação e POR QUÊ, com quem resolve e desde quando;
 *   3. as validações nas contas — e uma falha bloqueante impede a aprovação.
 */

const APROV_STATUS = {
  "pendente": { rotulo: "Aguardando decisão", classe: "status-em-aprovacao" },
  "aprovado": { rotulo: "Aprovado", classe: "status-aprovado" },
  "reprovado": { rotulo: "Reprovado", classe: "status-reprovado" },
  "devolvido": { rotulo: "Devolvido para ajuste", classe: "status-rascunho" },
};

const APROV_RESULTADO = {
  "ok": { rotulo: "OK", classe: "val-ok", icone: "✓" },
  "alerta": { rotulo: "Atenção", classe: "val-alerta", icone: "!" },
  "falha": { rotulo: "Falha", classe: "val-falha", icone: "×" },
};

const APROV_CATEGORIA = { receita: "Receita", despesa: "Despesa", capex: "Capex" };

function dataBR(iso) {
  return iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "—";
}

function dataHoraBR(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function diasDesde(iso) {
  if (!iso) return 0;
  const ms = new Date() - new Date(iso + "T12:00:00");
  return Math.max(0, Math.floor(ms / 86400000));
}

/* Aceite final: ato manual e nominal do líder da área, depois da 1ª instância.
   Não existe aprovação em massa aqui — é um de cada vez, e o registro vira log. */
function htmlAceiteFinal(sub, declaracao) {
  const lider = sub.liderResponsavel || { nome: "—", cargo: "" };

  if (sub.aceiteFinal) {
    const obs = sub.aceiteFinal.observacao
      ? `<div class="aceite-obs"><span class="aprov-rotulo">Observação do líder</span>${escaparTexto(sub.aceiteFinal.observacao)}</div>`
      : "";
    return `<div class="aceite-registrado">
      <div class="aceite-quem">
        <strong>${escaparTexto(sub.aceiteFinal.por)}</strong>
        <span>${escaparTexto(sub.aceiteFinal.cargo)}</span>
      </div>
      <div class="aceite-quando">Assumido em ${dataHoraBR(sub.aceiteFinal.em)}</div>
      <div class="aceite-declaracao">“${escaparTexto(sub.aceiteFinal.declaracao)}”</div>
      ${obs}
    </div>`;
  }

  if (sub.statusOficial !== "aprovado") {
    return `<div class="aceite-travado">
      O aceite final só abre depois da aprovação de 1ª instância.
      Status atual: <strong>${APROV_STATUS[sub.statusOficial].rotulo}</strong>.
    </div>`;
  }

  return `<div class="aceite-form">
    <div class="aceite-quem">
      <strong>${escaparTexto(lider.nome)}</strong>
      <span>${escaparTexto(lider.cargo)}</span>
    </div>
    <label class="aceite-check">
      <input type="checkbox" data-aceite-declaro />
      <span>${escaparTexto(declaracao)}</span>
    </label>
    <textarea data-aceite-obs rows="2" placeholder="Observação do líder (opcional) — fica registrada no log"></textarea>
    <button class="btn btn-primary btn-sm" data-aceite-registrar disabled>✍ Registrar aceite final</button>
    <p class="aceite-nota">Ato manual, um de cada vez — não há aprovação em massa. O registro entra no log com nome, cargo e horário, e não pode ser editado nem apagado.</p>
  </div>`;
}

/* falha em regra "bloqueia" impede a aprovação — é o que dá peso à validação */
function bloqueiosDaSubmissao(sub, regrasPorCodigo) {
  return sub.validacoes.filter(
    (v) => v.resultado === "falha" && regrasPorCodigo[v.regra]?.severidade === "bloqueia"
  );
}

function initAprovacoes() {
  const fila = document.querySelector("[data-aprov-fila]");
  const detalhe = document.querySelector("[data-aprov-detalhe]");
  if (!fila || !detalhe) return;

  const VAZIO = { busca: "", bu: "", responsavel: "", categoria: "",
                  status: "pendente", situacao: "", aceite: "" };
  let filtros = { ...VAZIO };
  let dados = null;
  let inputsDoCiclo = [];       // as linhas que compõem cada submissão
  let regrasPorCodigo = {};
  let selecionado = null;
  const marcados = new Set();   // linhas marcadas para decisão em lote

  const inputsDa = (subId) => inputsDoCiclo.filter((x) => x.submissaoId === subId);
  const aprovMil = (v) =>
    `R$ ${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;

  const INPUT_STATUS = {
    pendente:  { rotulo: "Pendente",  classe: "status-em-aprovacao" },
    aprovado:  { rotulo: "Aprovado",  classe: "status-aprovado" },
    rejeitado: { rotulo: "Rejeitado", classe: "status-reprovado" },
  };

  /* Grid das linhas dentro do detalhe da entrega. Usa report-table + entry-grid,
     os mesmos da grade de lançamento, para a tabela não parecer de outro app. */
  function htmlLinhasInput(sub, linhas) {
    if (!linhas.length) {
      return '<div class="empty-hint">Nenhuma linha detalhada para esta entrega.</div>';
    }
    const decidivel = sub.statusOficial === "pendente";
    const pendentes = linhas.filter((l) => l.status === "pendente");

    const lote = decidivel && pendentes.length
      ? `<div class="aprov-acoes">
           <button class="btn btn-secondary btn-sm" data-aprov-linha-todas>
             ${marcados.size === pendentes.length ? "Desmarcar todas" : `Marcar as ${pendentes.length} pendentes`}
           </button>
           <button class="btn btn-success btn-sm" data-aprov-linha-lote="aprovado" ${marcados.size ? "" : "disabled"}>
             ✓ Aprovar ${marcados.size || ""} selecionada(s)
           </button>
           <button class="btn btn-danger btn-sm" data-aprov-linha-lote="rejeitado" ${marcados.size ? "" : "disabled"}>
             ✕ Rejeitar selecionada(s)
           </button>
         </div>`
      : "";

    const corpo = linhas.map((l) => {
      const info = INPUT_STATUS[l.status] || {};
      const dif = l.valorSolicitado - l.valorAtual;
      const pct = l.valorAtual ? (dif / Math.abs(l.valorAtual)) * 100 : 0;
      const pendente = l.status === "pendente" && decidivel;
      return `
        <tr class="${marcados.has(l.id) ? "selected" : ""}">
          <td>${pendente ? `<input type="checkbox" data-aprov-linha-marca="${escaparTexto(l.id)}" ${marcados.has(l.id) ? "checked" : ""} />` : ""}</td>
          <td>${escaparTexto(l.area)}<br><span class="text-muted">${escaparTexto(l.centroCustoCodigo)} · ${escaparTexto(l.centroCusto)}</span></td>
          <td>${escaparTexto(l.conta)}<br><span class="text-muted">${escaparTexto(l.descricao)}</span></td>
          <td class="text-right">${aprovMil(l.valorAtual)}</td>
          <td class="text-right">${aprovMil(l.valorSolicitado)}</td>
          <td class="text-right ${dif > 0 ? "down" : ""}">${dif > 0 ? "+" : ""}${pct.toFixed(1)}%</td>
          <td><span class="badge ${info.classe}">${escaparTexto(info.rotulo)}</span>
              ${l.motivoRejeicao ? `<br><span class="text-muted">${escaparTexto(l.motivoRejeicao)}</span>` : ""}</td>
          <td>${pendente ? `
            <button class="btn btn-ghost btn-sm" data-aprov-linha="aprovado" data-aprov-linha-id="${escaparTexto(l.id)}" title="Aprovar linha">✓</button>
            <button class="btn btn-ghost btn-sm" data-aprov-linha="rejeitado" data-aprov-linha-id="${escaparTexto(l.id)}" title="Rejeitar linha">✕</button>` : ""}</td>
        </tr>`;
    }).join("");

    return `${lote}
      <div class="table-wrap">
        <table class="report-table entry-grid">
          <thead>
            <tr>
              <th></th><th>Área / Centro de Custo</th><th>Conta</th>
              <th class="text-right">Valor Atual</th>
              <th class="text-right">Valor Solicitado</th>
              <th class="text-right">Δ %</th>
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>${corpo}</tbody>
        </table>
      </div>`;
  }

  function decidirLinhas(ids, status) {
    let n = 0;
    ids.forEach((id) => {
      const l = inputsDoCiclo.find((x) => x.id === id);
      if (!l || l.status !== "pendente") return;
      l.status = status;
      l.decididoPor = "Emerson Nakamura";
      if (status === "rejeitado") {
        l.motivoRejeicao = (dados.motivosRejeicaoInput || ["Recusado pelo aprovador."])[0];
      }
      n++;
    });
    marcados.clear();
    redesenhar();
    showToast(`${n} linha(s) ${status === "aprovado" ? "aprovada(s)" : "rejeitada(s)"} — protótipo não grava.`,
              status === "aprovado" ? "success" : "info");
  }

  function visiveis() {
    return dados.submissoes.filter((sub) => {
      if (filtros.bu && sub.bu !== filtros.bu) return false;
      if (filtros.responsavel && sub.responsavel !== filtros.responsavel) return false;
      if (filtros.categoria && sub.categoria !== filtros.categoria) return false;
      if (filtros.status && sub.statusOficial !== filtros.status) return false;

      const busca = filtros.busca.trim().toLowerCase();
      if (busca) {
        const alvo = `${sub.empresa} ${sub.torre} ${sub.bu} ${sub.responsavel} ${sub.id}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }

      const travada = bloqueiosDaSubmissao(sub, regrasPorCodigo).length > 0;
      if (filtros.situacao === "bloqueada" && !travada) return false;
      if (filtros.situacao === "pendencia" && !sub.pendencias.length) return false;
      if (filtros.situacao === "limpa" && (travada || sub.pendencias.length)) return false;

      if (filtros.aceite === "sem" && sub.aceiteFinal) return false;
      if (filtros.aceite === "com" && !sub.aceiteFinal) return false;
      return true;
    });
  }

  function renderKpis() {
    const conta = (chave, valor) => {
      document.querySelectorAll(`[data-aprov-kpi="${chave}"]`).forEach((el) => { el.textContent = valor; });
    };
    const todas = dados.submissoes;
    const pendentes = todas.filter((s) => s.statusOficial === "pendente");

    conta("pendente", pendentes.length);
    conta("bloqueadas", pendentes.filter((s) => bloqueiosDaSubmissao(s, regrasPorCodigo).length).length);
    conta("pendencias", pendentes.filter((s) => s.pendencias.length).length);

    const travadas = pendentes.filter((s) => bloqueiosDaSubmissao(s, regrasPorCodigo).length).length;
    conta("bloqueadas-detalhe", `${travadas} travada(s) por validação`);

    /* O valor vem das LINHAS, não do cabeçalho da submissão: é o que permite
       ver quanto já foi aprovado enquanto a entrega ainda está em análise. */
    const soma = (f) => inputsDoCiclo.filter(f).reduce((t, l) => t + l.valorSolicitado, 0);
    const aprovadosLinha = inputsDoCiclo.filter((l) => l.status === "aprovado");
    const rejeitadosLinha = inputsDoCiclo.filter((l) => l.status === "rejeitado");

    conta("valor-solicitado", aprovMil(soma(() => true)));
    conta("valor-base", `contra ${aprovMil(inputsDoCiclo.reduce((t, l) => t + l.valorAtual, 0))} na base de hoje`);
    conta("valor-aprovado", aprovMil(soma((l) => l.status === "aprovado")));
    conta("valor-aprovado-detalhe", `${aprovadosLinha.length} de ${inputsDoCiclo.length} linha(s)`);
    conta("valor-rejeitado", aprovMil(soma((l) => l.status === "rejeitado")));
    conta("valor-rejeitado-detalhe", `${rejeitadosLinha.length} linha(s) recusada(s)`);

    const aprovadasLista = todas.filter((s) => s.statusOficial === "aprovado");
    const aprovadas = aprovadasLista.length;
    const semAceite = aprovadasLista.filter((s) => !s.aceiteFinal).length;
    conta("sem-aceite", semAceite);
    conta("aceite-detalhe", `${aprovadas - semAceite} de ${aprovadas} já assumidas por um líder`);
  }

  /* o log é auditoria: mostra todos os aceites, sem depender dos filtros da fila */
  function renderLog() {
    const corpo = document.querySelector("[data-log-tabela] tbody");
    const resumo = document.querySelector("[data-log-resumo]");
    if (!corpo) return;

    const registros = dados.submissoes
      .filter((s) => s.aceiteFinal)
      .sort((a, b) => (a.aceiteFinal.em < b.aceiteFinal.em ? 1 : -1));

    if (resumo) {
      const lideres = new Set(registros.map((s) => s.aceiteFinal.por));
      resumo.textContent = `${registros.length} aceite(s) registrado(s) por ${lideres.size} líder(es) · mostra todo o histórico, independente dos filtros acima`;
    }

    corpo.innerHTML = registros.length
      ? registros
          .map(
            (s) => `<tr>
              <td>${dataHoraBR(s.aceiteFinal.em)}</td>
              <td><strong>${escaparTexto(s.aceiteFinal.por)}</strong><br /><span class="log-cargo">${escaparTexto(s.aceiteFinal.cargo)}</span></td>
              <td>${escaparTexto(s.empresa)} · ${APROV_CATEGORIA[s.categoria]}</td>
              <td>${escaparTexto(s.bu)} → ${escaparTexto(s.torre)}</td>
              <td>${escaparTexto(s.aceiteFinal.observacao || "—")}</td>
            </tr>`
          )
          .join("")
      : '<tr><td colspan="5">Nenhum aceite final registrado ainda.</td></tr>';
  }

  function renderFila() {
    const lista = visiveis();
    const contagem = document.querySelector("[data-aprov-contagem]");
    if (contagem) {
      contagem.textContent = `${lista.length} submissão(ões) · clique para ver a situação`;
    }

    if (!lista.length) {
      fila.innerHTML = '<div class="empty-hint">Nenhuma submissão com esses filtros.</div>';
      return;
    }

    fila.innerHTML = lista
      .map((sub) => {
        const status = APROV_STATUS[sub.statusOficial];
        const travas = bloqueiosDaSubmissao(sub, regrasPorCodigo).length;
        const marcas = [
          travas ? `<span class="aprov-marca trava">${travas} validação(ões) travando</span>` : "",
          sub.pendencias.length ? `<span class="aprov-marca falta">${sub.pendencias.length} informação(ões) faltando</span>` : "",
          !travas && !sub.pendencias.length ? '<span class="aprov-marca limpa">pronta para aprovar</span>' : "",
        ].join("");

        return `<button type="button" class="aprov-item ${selecionado === sub.id ? "selecionada" : ""}" data-aprov-id="${sub.id}">
          <span class="aprov-item-topo">
            <strong>${escaparTexto(sub.empresa)}</strong>
            <span class="pill ${sub.categoria}">${APROV_CATEGORIA[sub.categoria]}</span>
            <span class="badge ${status.classe}"><span class="badge-dot"></span>${status.rotulo}</span>
          </span>
          <span class="aprov-item-meta">${escaparTexto(sub.bu)} · ${escaparTexto(sub.torre)} · ${escaparTexto(sub.responsavel)} · enviado em ${dataBR(sub.enviadoEm)}</span>
          <span class="aprov-marcas">${marcas}</span>
        </button>`;
      })
      .join("");
  }

  function renderDetalhe() {
    const sub = dados.submissoes.find((s) => s.id === selecionado);
    if (!sub) {
      detalhe.innerHTML = '<div class="panel-body"><div class="empty-hint">Selecione uma submissão na fila para ver a situação.</div></div>';
      return;
    }

    const status = APROV_STATUS[sub.statusOficial];
    const bloqueios = bloqueiosDaSubmissao(sub, regrasPorCodigo);

    const decisao = sub.decisao
      ? `<div class="aprov-decisao">
           <div><span class="aprov-rotulo">Decidido por</span><strong>${escaparTexto(sub.decisao.por)}</strong> em ${dataBR(sub.decisao.em)}</div>
           <div class="aprov-parecer">“${escaparTexto(sub.decisao.parecer)}”</div>
         </div>`
      : `<div class="aprov-decisao aguardando">
           <span class="aprov-rotulo">Decisão</span>
           Ainda não há status oficial. Enviado há ${diasDesde(sub.enviadoEm)} dia(s).
         </div>`;

    const pendencias = sub.pendencias.length
      ? sub.pendencias
          .map(
            (p) => `<div class="aprov-pendencia">
              <div class="aprov-pendencia-oque">${escaparTexto(p.oQueFalta)}</div>
              <div class="aprov-pendencia-porque"><span class="aprov-rotulo">Por quê</span>${escaparTexto(p.porque)}</div>
              <div class="aprov-pendencia-quem">Com <strong>${escaparTexto(p.quemResolve)}</strong> · parado há ${diasDesde(p.desde)} dia(s), desde ${dataBR(p.desde)}</div>
            </div>`
          )
          .join("")
      : '<div class="empty-hint">Nenhuma informação pendente — a submissão está completa.</div>';

    const validacoes = sub.validacoes
      .map((v) => {
        const regra = regrasPorCodigo[v.regra] || {};
        const res = APROV_RESULTADO[v.resultado];
        return `<div class="aprov-validacao ${res.classe}">
          <span class="aprov-val-icone">${res.icone}</span>
          <span class="aprov-val-texto">
            <strong>${escaparTexto(regra.nome || v.regra)}</strong>
            <em>${escaparTexto(v.detalhe || regra.descricao || "")}</em>
          </span>
          <span class="aprov-val-sev">${regra.severidade === "bloqueia" ? "Bloqueia" : "Alerta"}</span>
        </div>`;
      })
      .join("");

    /* A entrega só é aprovável quando as duas coisas estão resolvidas: nenhuma
       validação bloqueante e nenhuma linha ainda pendente. Aprovar a entrega
       com linha em aberto seria dizer "aprovo o total sem ter olhado as
       partes" — que é exatamente o que esta tela existe para evitar. */
    const linhas = inputsDa(sub.id);
    const linhasPendentes = linhas.filter((l) => l.status === "pendente").length;
    const travado = bloqueios.length > 0 || linhasPendentes > 0;

    const motivos = [];
    if (bloqueios.length) {
      motivos.push(`validação: ${bloqueios.map((b) => escaparTexto(regrasPorCodigo[b.regra].nome)).join(", ")}`);
    }
    if (linhasPendentes) {
      motivos.push(`${linhasPendentes} linha(s) ainda sem decisão`);
    }
    const motivoTrava = travado
      ? `<div class="aprov-trava">Aprovação bloqueada — ${motivos.join(" · ")}. Decida as linhas abaixo, corrija no lançamento ou devolva para ajuste.</div>`
      : "";

    const acoes =
      sub.statusOficial === "pendente"
        ? `${motivoTrava}
           <div class="aprov-acoes">
             <button class="btn btn-success btn-sm" data-aprov-decisao="aprovado" ${travado ? "disabled" : ""}
               title="${travado ? "Há validação bloqueante nas contas" : "Registrar aprovação oficial"}">✓ Aprovar</button>
             <button class="btn btn-secondary btn-sm" data-aprov-decisao="devolvido">↩ Devolver para ajuste</button>
             <button class="btn btn-danger btn-sm" data-aprov-decisao="reprovado">✕ Reprovar</button>
           </div>`
        : `<div class="aprov-acoes">
             <button class="btn btn-secondary btn-sm" data-aprov-decisao="pendente" ${sub.aceiteFinal ? "disabled" : ""}
               title="${sub.aceiteFinal ? "Já há aceite final registrado — reabrir apagaria a responsabilidade assumida pelo líder" : "Voltar para análise"}">↺ Reabrir decisão</button>
             ${sub.aceiteFinal ? '<span class="aprov-nota-trava">Travado pelo aceite final do líder</span>' : ""}
           </div>`;

    detalhe.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>${escaparTexto(sub.empresa)} · ${APROV_CATEGORIA[sub.categoria]}</h2>
          <p>${escaparTexto(sub.bu)} → ${escaparTexto(sub.torre)} · responsável ${escaparTexto(sub.responsavel)} · ${sub.id}</p>
        </div>
        <span class="badge ${status.classe}"><span class="badge-dot"></span>${status.rotulo}</span>
      </div>
      <div class="panel-body">
        <div class="aprov-bloco">
          <h3>Status oficial do aprovador</h3>
          ${decisao}
          ${acoes}
        </div>

        <div class="aprov-bloco">
          <h3>Linhas desta entrega — ${linhas.length} input(s), soma ${aprovMil(linhas.reduce((s, l) => s + l.valorSolicitado, 0))}</h3>
          ${htmlLinhasInput(sub, linhas)}
        </div>

        <div class="aprov-bloco">
          <h3>Situação — o que falta e por quê</h3>
          ${pendencias}
        </div>

        <div class="aprov-bloco">
          <h3>Validações nas contas</h3>
          <div class="aprov-validacoes">${validacoes}</div>
        </div>

        <div class="aprov-bloco">
          <h3>Aceite final do líder</h3>
          ${htmlAceiteFinal(sub, dados.declaracaoAceiteFinal)}
        </div>
      </div>`;
  }

  function redesenhar() {
    renderKpis();
    renderFila();
    renderDetalhe();
    renderLog();
  }

  fila.addEventListener("click", (e) => {
    const item = e.target.closest("[data-aprov-id]");
    if (!item) return;
    selecionado = item.getAttribute("data-aprov-id");
    redesenhar();
  });

  /* o botão só destrava depois do líder marcar a declaração — é o que torna o ato manual */
  detalhe.addEventListener("change", (e) => {
    if (!e.target.matches("[data-aceite-declaro]")) return;
    const registrar = detalhe.querySelector("[data-aceite-registrar]");
    if (registrar) registrar.disabled = !e.target.checked;
  });

  /* Decisão linha a linha. Delegação no painel de detalhe porque ele é
     redesenhado inteiro a cada clique — listener preso no botão sumiria. */
  detalhe.addEventListener("click", (e) => {
    const marca = e.target.closest("[data-aprov-linha-marca]");
    if (marca) {
      const id = marca.getAttribute("data-aprov-linha-marca");
      if (marca.checked) marcados.add(id); else marcados.delete(id);
      renderDetalhe();
      return;
    }

    const todas = e.target.closest("[data-aprov-linha-todas]");
    if (todas) {
      const pendentes = inputsDa(selecionado).filter((l) => l.status === "pendente");
      if (marcados.size === pendentes.length) marcados.clear();
      else { marcados.clear(); pendentes.forEach((l) => marcados.add(l.id)); }
      renderDetalhe();
      return;
    }

    const lote = e.target.closest("[data-aprov-linha-lote]");
    if (lote && !lote.disabled) {
      decidirLinhas([...marcados], lote.getAttribute("data-aprov-linha-lote"));
      return;
    }

    const uma = e.target.closest("[data-aprov-linha]");
    if (uma) {
      decidirLinhas([uma.getAttribute("data-aprov-linha-id")], uma.getAttribute("data-aprov-linha"));
      return;
    }

    const aceitar = e.target.closest("[data-aceite-registrar]");
    if (aceitar && !aceitar.disabled) {
      const sub = dados.submissoes.find((s) => s.id === selecionado);
      const lider = sub?.liderResponsavel;
      if (!sub || !lider) return;

      sub.aceiteFinal = {
        por: lider.nome,
        cargo: lider.cargo,
        em: new Date().toISOString().slice(0, 16),
        declaracao: dados.declaracaoAceiteFinal,
        observacao: detalhe.querySelector("[data-aceite-obs]")?.value.trim() || "",
      };

      showToast(`Aceite final registrado: ${lider.nome} assumiu ${sub.empresa} · ${APROV_CATEGORIA[sub.categoria]}`, "success");
      redesenhar();
      return;
    }

    const botao = e.target.closest("[data-aprov-decisao]");
    if (!botao || botao.disabled) return;

    const sub = dados.submissoes.find((s) => s.id === selecionado);
    if (!sub) return;

    const novo = botao.getAttribute("data-aprov-decisao");
    sub.statusOficial = novo;

    if (novo === "pendente") {
      delete sub.decisao;
      showToast(`${sub.empresa}: decisão reaberta`, "info");
    } else {
      const rotulos = {
        aprovado: "Dentro do quadro aprovado e sem validação bloqueante.",
        reprovado: "Reprovado pelo aprovador — ver parecer com o responsável.",
        devolvido: "Devolvido para ajuste antes de nova análise.",
      };
      sub.decisao = { por: "Emerson Nakamura", em: new Date().toISOString().slice(0, 10), parecer: rotulos[novo] };
      showToast(`${sub.empresa} · ${APROV_CATEGORIA[sub.categoria]}: ${APROV_STATUS[novo].rotulo}`, novo === "reprovado" ? "warning" : "success");
    }

    redesenhar();
  });

  document.querySelectorAll("[data-aprov-filtro]").forEach((campo) => {
    campo.addEventListener(campo.tagName === "SELECT" ? "change" : "input", () => {
      filtros[campo.getAttribute("data-aprov-filtro")] = campo.value;
      redesenhar();
    });
  });

  document.querySelector("[data-aprov-limpar]")?.addEventListener("click", () => {
    filtros = { ...VAZIO, status: "" };
    document.querySelectorAll("[data-aprov-filtro]").forEach((campo) => {
      campo.value = filtros[campo.getAttribute("data-aprov-filtro")] ?? "";
    });
    marcados.clear();
    redesenhar();
    showToast("Filtros limpos.", "info");
  });

  /* inputs.json é opcional: sem ele a tela continua funcionando no nível da
     entrega, só sem o detalhamento por linha. */
  Promise.all([
    carregarRef("aprovacoes.json"),
    carregarRef("inputs.json").catch(() => null),
  ])
    .then(([json, inputsDoc]) => {
      dados = json;
      inputsDoCiclo = inputsDoc ? inputsDoc.inputs : [];
      if (inputsDoc) dados.motivosRejeicaoInput = inputsDoc.motivosRejeicao;
      json.regras.forEach((regra) => { regrasPorCodigo[regra.codigo] = regra; });

      const encher = (chave, valores) => {
        const sel = document.querySelector(`[data-aprov-filtro="${chave}"]`);
        if (!sel || sel.tagName !== "SELECT") return;
        valores.forEach((v) => {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v;
          sel.appendChild(opt);
        });
      };
      encher("bu", [...new Set(json.submissoes.map((s) => s.bu))].sort());
      encher("responsavel", [...new Set(json.submissoes.map((s) => s.responsavel))].sort());

      const primeira = json.submissoes.find((s) => s.statusOficial === "pendente");
      selecionado = primeira ? primeira.id : null;
      redesenhar();
    })
    .catch(() => {
      fila.innerHTML = '<div class="empty-hint">Não foi possível carregar <strong>Referencias/aprovacoes.json</strong>.</div>';
    });
}

/* ---------- Ativação: quanto do gasto sai de Expenses e vira ativo ----------
 * Ativar não cria valor: o caixa é o mesmo. O que muda é o caminho no P&L —
 * o valor ativado sai de Expenses (sobe o EBITDA) e volta diluído como
 * depreciação/amortização, abaixo do EBITDA, ao longo da vida útil.
 * Base: CPC 27 / IAS 16 (imobilizado) e CPC 04 / IAS 38 (intangível).
 */

function dinheiroMil(valor) {
  return `R$ ${Math.round(valor).toLocaleString("pt-BR")} mil`;
}

function initAtivacao() {
  const fluxo = document.querySelector("[data-ativacao-fluxo]");
  if (!fluxo) return;

  const efeito = document.querySelector("[data-ativacao-efeito]");
  const painel = document.querySelector("[data-ativacao-painel]");
  let ref = null;

  function tipoPorNome(nome) {
    return ref.tiposAtivo.find((t) => t.nome === nome) || ref.tiposAtivo[0];
  }

  function calcular() {
    const linhas = Array.from(document.querySelectorAll(".entry-grid tbody tr"));
    const resumo = {
      total: 0, ativado: 0, opex: 0, elegivel: 0, da: 0,
      porTipo: new Map(), alertas: [],
    };

    linhas.forEach((row) => {
      const valor = totalAnualDaLinha(row);
      if (!valor) return;

      const tipo = tipoPorNome(row.querySelector(".ativacao-input")?.value.trim() || "");
      const pct = Math.min(100, Math.max(0, Number(row.querySelector(".ativacao-pct")?.value) || 0));
      const pacote = pacoteDaLinha(row);
      const elegibilidade = ref.elegibilidadePorPacote[pacote];
      const conta = row.querySelector(".conta-nome-input")?.value.trim() || "linha sem descrição";

      resumo.total += valor;
      if (elegibilidade && elegibilidade.grau !== "nao") resumo.elegivel += valor;

      const ativa = tipo.natureza !== "Opex" && pct > 0;
      const valorAtivado = ativa ? (valor * pct) / 100 : 0;

      resumo.ativado += valorAtivado;
      resumo.opex += valor - valorAtivado;

      if (valorAtivado) {
        const atual = resumo.porTipo.get(tipo.nome) || { tipo, valor: 0 };
        atual.valor += valorAtivado;
        resumo.porTipo.set(tipo.nome, atual);
        if (tipo.vidaUtilAnos) resumo.da += valorAtivado / tipo.vidaUtilAnos;
      }

      // inconsistências que um auditor perguntaria
      if (tipo.natureza === "Opex" && pct > 0) {
        resumo.alertas.push(`<strong>${escaparTexto(conta)}</strong>: tem ${pct}% de ativação mas está classificada como Opex.`);
      }
      if (ativa && elegibilidade && elegibilidade.grau === "nao") {
        resumo.alertas.push(`<strong>${escaparTexto(conta)}</strong>: ativa ${pct}% no pacote “${escaparTexto(pacote)}”, que não é elegível — ${escaparTexto(elegibilidade.nota)}`);
      }
      if (ativa && valorAtivado < ref.limiteMaterialidade.valorMil) {
        resumo.alertas.push(`<strong>${escaparTexto(conta)}</strong>: valor ativado abaixo do limite de materialidade de R$ ${ref.limiteMaterialidade.valorMil} mil.`);
      }
    });

    return resumo;
  }

  function render() {
    const r = calcular();
    const pctAtivado = r.total ? Math.round((r.ativado / r.total) * 100) : 0;
    const pctElegivel = r.total ? Math.round((r.elegivel / r.total) * 100) : 0;

    fluxo.innerHTML = `
      <div class="ativ-barra">
        <span class="ativ-parte opex" style="width:${100 - pctAtivado}%"></span>
        <span class="ativ-parte ativado" style="width:${pctAtivado}%"></span>
      </div>
      <div class="ativ-numeros">
        <div class="ativ-num">
          <span class="ativ-rot">Lançado na grade</span>
          <strong>${dinheiroMil(r.total)}</strong>
        </div>
        <div class="ativ-num">
          <span class="ativ-rot">Fica em Opex</span>
          <strong class="opex">${dinheiroMil(r.opex)}</strong>
          <em>${100 - pctAtivado}% do lançado</em>
        </div>
        <div class="ativ-num">
          <span class="ativ-rot">Ativado (sai de Expenses)</span>
          <strong class="ativado">${dinheiroMil(r.ativado)}</strong>
          <em>${pctAtivado}% do lançado</em>
        </div>
        <div class="ativ-num">
          <span class="ativ-rot">Teto elegível pelos pacotes</span>
          <strong>${dinheiroMil(r.elegivel)}</strong>
          <em>${pctElegivel}% — o que a regra permitiria avaliar</em>
        </div>
      </div>`;

    const porTipo = Array.from(r.porTipo.values())
      .map((t) => `<li><strong>${escaparTexto(t.tipo.nome)}</strong> (${escaparTexto(t.tipo.natureza)}, ${t.tipo.vidaUtilAnos} anos) — ${dinheiroMil(t.valor)} · ${escaparTexto(t.tipo.metodo)} de ${dinheiroMil(t.valor / t.tipo.vidaUtilAnos)}/ano</li>`)
      .join("");

    const alertas = r.alertas.length
      ? `<div class="ativ-alertas"><strong>${r.alertas.length} ponto(s) para revisar antes de fechar:</strong><ul>${r.alertas.map((a) => `<li>${a}</li>`).join("")}</ul></div>`
      : "";

    efeito.innerHTML = `
      <h3>Efeito no P&amp;L</h3>
      <div class="ativ-efeito-grid">
        <div class="ativ-efeito-item up"><span>EBITDA</span><strong>+ ${dinheiroMil(r.ativado)}</strong><em>o gasto sai de Expenses</em></div>
        <div class="ativ-efeito-item"><span>Capex</span><strong>+ ${dinheiroMil(r.ativado)}</strong><em>vira investimento no ciclo</em></div>
        <div class="ativ-efeito-item neutro"><span>EBITDA after Capex</span><strong>sem efeito</strong><em>o caixa do ano é o mesmo</em></div>
        <div class="ativ-efeito-item down"><span>D&amp;A a partir do próximo ano</span><strong>− ${dinheiroMil(r.da)}/ano</strong><em>abaixo do EBITDA, reduz o EBIT</em></div>
      </div>
      ${porTipo ? `<div class="ativ-por-tipo"><span class="aprov-rotulo">Ativos gerados</span><ul>${porTipo}</ul></div>` : ""}
      ${alertas}`;

    if (painel && !painel.hidden) renderCriterios();
  }

  function renderCriterios() {
    const normas = ref.normas
      .map((n) => `<div class="ativ-norma">
          <strong>${escaparTexto(n.nome)}</strong> <span class="ativ-tag">${escaparTexto(n.norma)}</span>
          <p><span class="ativ-sim">Ativa</span> ${escaparTexto(n.ativa)}</p>
          <p><span class="ativ-nao">Não ativa</span> ${escaparTexto(n.naoAtiva)}</p>
        </div>`)
      .join("");

    const criterios = ref.criteriosCPC04.map((c) => `<li>${escaparTexto(c)}</li>`).join("");

    const pacotes = Object.entries(ref.elegibilidadePorPacote)
      .map(([nome, e]) => `<li><span class="ativ-grau ${e.grau}">${e.grau === "elegivel" ? "elegível" : e.grau === "parcial" ? "parcial" : "não ativa"}</span><strong>${escaparTexto(nome)}</strong> — ${escaparTexto(e.nota)}</li>`)
      .join("");

    painel.innerHTML = `
      ${normas}
      <div class="ativ-norma">
        <strong>Os seis critérios do CPC 04</strong>
        <p>Para ativar a fase de desenvolvimento, todos precisam ser atendidos ao mesmo tempo:</p>
        <ol>${criterios}</ol>
      </div>
      <div class="ativ-norma">
        <strong>Materialidade</strong>
        <p>${escaparTexto(ref.limiteMaterialidade.texto)}</p>
      </div>
      <div class="ativ-norma">
        <strong>Elegibilidade por pacote</strong>
        <ul class="ativ-pacotes">${pacotes}</ul>
      </div>`;
  }

  document.querySelector("[data-ativacao-criterios]")?.addEventListener("click", () => {
    if (!painel) return;
    painel.hidden = !painel.hidden;
    if (!painel.hidden) renderCriterios();
  });

  document.addEventListener("change", (e) => {
    if (!ref) return;
    if (e.target.closest(".ativacao-input, .ativacao-pct, .pacote-input") || e.target.matches("td.month-col input")) {
      render();
    }
  });

  carregarRef("ativacao.json")
    .then((json) => {
      ref = json;

      const datalist = document.getElementById("ativacao-datalist");
      if (datalist) {
        json.tiposAtivo.forEach((t) => {
          const opt = document.createElement("option");
          opt.value = t.nome;
          opt.label = t.natureza === "Opex" ? t.ajuda : `${t.natureza} · ${t.vidaUtilAnos} anos · ${t.ajuda}`;
          datalist.appendChild(opt);
        });
      }

      render();
    })
    .catch(() => {
      fluxo.innerHTML = '<div class="empty-hint">Não foi possível carregar <strong>Referencias/ativacao.json</strong>.</div>';
    });
}

/* ---------- Diluição de reajuste ----------
 * Coloca um valor (ou um %) e distribui pelos meses escolhidos. O "a partir de"
 * cobre o caso do aniversário do contrato: o reajuste só pega dali para frente.
 * A sobra do arredondamento vai para o último mês marcado, então a soma
 * distribuída bate exatamente com o valor digitado.
 */

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/* ---------- Premissas macro do ciclo (IPCA, IGP-M, câmbio) ----------
 * Índice acumula COMPOSTO: (1+i1)×(1+i2)…−1. Somar as taxas do mês dá um
 * número parecido e errado, e o erro cresce com a inflação.
 */

function acumuladoComposto(mensal) {
  return (mensal.reduce((fator, taxa) => fator * (1 + taxa / 100), 1) - 1) * 100;
}

function initPremissas() {
  const alvo = document.querySelector("[data-premissas]");
  if (!alvo) return;

  carregarRef("premissas.json")
    .then((doc) => {
      const resumo = document.querySelector("[data-premissas-resumo]");
      if (resumo) {
        const indices = doc.premissas.filter((p) => p.tipo === "indice").length;
        resumo.textContent = `${indices} índices e ${doc.premissas.length - indices} câmbio · alimentam a diluição de reajuste nas grades de lançamento`;
      }

      alvo.innerHTML = doc.premissas
        .map((p) => {
          const ehIndice = p.tipo === "indice";
          const fecho = ehIndice
            ? `${acumuladoComposto(p.mensal).toFixed(2).replace(".", ",")}%`
            : `R$ ${p.mensal[p.mensal.length - 1].toFixed(2).replace(".", ",")}`;
          const rotuloFecho = ehIndice ? "Acumulado 12m (composto)" : "Dez/26";

          const variacao = ehIndice
            ? ""
            : `<span class="premissa-var">${(((p.mensal[11] / p.mensal[0]) - 1) * 100).toFixed(1).replace(".", ",")}% no ano</span>`;

          const celulas = p.mensal
            .map((v, i) => `<span class="premissa-mes">
                <em>${MESES_CURTOS[i]}</em>
                <strong>${ehIndice ? v.toFixed(2).replace(".", ",") : v.toFixed(2).replace(".", ",")}</strong>
              </span>`)
            .join("");

          return `<div class="premissa ${p.status === "rascunho" ? "rascunho" : ""}">
            <div class="premissa-topo">
              <div>
                <strong>${escaparTexto(p.nome)}</strong>
                <span class="premissa-tag">${escaparTexto(p.tipo === "indice" ? "Índice" : "Câmbio")}</span>
                <span class="badge ${p.status === "ativo" ? "status-aprovado" : "status-rascunho"}"><span class="badge-dot"></span>${p.status === "ativo" ? "Ativo" : "Rascunho"}</span>
                <p>${escaparTexto(p.descricao)} · fonte ${escaparTexto(p.fonte)} · aplica em <strong>${escaparTexto(p.aplicacao)}</strong></p>
              </div>
              <div class="premissa-fecho">
                <span class="ativ-rot">${rotuloFecho}</span>
                <strong>${fecho}</strong>
                ${variacao}
              </div>
            </div>
            <div class="premissa-serie">${celulas}</div>
          </div>`;
        })
        .join("");
    })
    .catch(() => {
      alvo.innerHTML = '<div class="empty-hint">Não foi possível carregar <strong>Referencias/premissas.json</strong>.</div>';
    });
}

function initReajuste() {
  const overlay = document.getElementById("modal-reajuste");
  if (!overlay) return;

  const campoValor = overlay.querySelector("[data-reajuste-valor]");
  const campoTipo = overlay.querySelector("[data-reajuste-tipo]");
  const campoModo = overlay.querySelector("[data-reajuste-modo]");
  const blocoModo = overlay.querySelector("[data-reajuste-distribuicao]");
  const caixaMeses = overlay.querySelector("[data-reajuste-meses]");
  const selectApartir = overlay.querySelector("[data-reajuste-apartir]");
  const previa = overlay.querySelector("[data-reajuste-previa]");
  const rotulo = overlay.querySelector("[data-reajuste-rotulo]");
  const blocoIndice = overlay.querySelector("[data-reajuste-bloco-indice]");
  const blocoValor = overlay.querySelector("[data-reajuste-bloco-valor]");
  const selectIndice = overlay.querySelector("[data-reajuste-indice]");
  const fonteIndice = overlay.querySelector("[data-reajuste-fonte]");

  let linhaAlvo = null;
  let premissas = [];

  /* o % do índice é o acumulado 12m — é assim que reajuste de contrato funciona:
     no aniversário aplica-se o acumulado do período anterior, não o do mês */
  function premissaEscolhida() {
    return premissas.find((p) => p.codigo === selectIndice?.value) || null;
  }

  function sincronizarIndice() {
    const p = premissaEscolhida();
    if (!p) return;
    const acumulado = acumuladoComposto(p.mensal);
    campoValor.value = acumulado.toFixed(2);
    if (fonteIndice) {
      fonteIndice.textContent = `${p.nome} · acumulado 12m ${acumulado.toFixed(2).replace(".", ",")}% · fonte ${p.fonte} · aplica em ${p.aplicacao}`;
    }
  }

  MESES_CURTOS.forEach((mes, i) => {
    const label = document.createElement("label");
    label.className = "reajuste-mes";
    label.innerHTML = `<input type="checkbox" data-mes="${i}" /><span>${mes}</span>`;
    caixaMeses.appendChild(label);

    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = mes;
    selectApartir.appendChild(opt);
  });

  const inputsMes = () => Array.from(linhaAlvo.querySelectorAll("td.month-col input"));
  const marcados = () => Array.from(caixaMeses.querySelectorAll("input:checked")).map((c) => Number(c.dataset.mes));

  /* devolve o quanto entra em cada mês marcado, já com a sobra ajustada */
  function calcularDistribuicao() {
    const meses = marcados();
    const valor = Number(campoValor.value) || 0;
    if (!linhaAlvo || !meses.length || !valor) return { meses, porMes: new Map(), total: 0 };

    const atuais = inputsMes().map((i) => Number(i.value) || 0);
    const porMes = new Map();

    if (campoTipo.value === "percentual" || campoTipo.value === "indice") {
      meses.forEach((m) => porMes.set(m, Math.round((atuais[m] * valor) / 100)));
    } else if (campoModo.value === "proporcional") {
      const base = meses.reduce((s, m) => s + atuais[m], 0);
      if (!base) {
        meses.forEach((m) => porMes.set(m, Math.round(valor / meses.length)));
      } else {
        meses.forEach((m) => porMes.set(m, Math.round((valor * atuais[m]) / base)));
      }
    } else {
      meses.forEach((m) => porMes.set(m, Math.round(valor / meses.length)));
    }

    // sobra do arredondamento no último mês marcado, para fechar o valor digitado
    if (campoTipo.value === "valor") {
      const somado = meses.reduce((s, m) => s + porMes.get(m), 0);
      const ultimo = meses[meses.length - 1];
      porMes.set(ultimo, porMes.get(ultimo) + (valor - somado));
    }

    return { meses, porMes, total: meses.reduce((s, m) => s + porMes.get(m), 0) };
  }

  function atualizarPrevia() {
    const tipo = campoTipo.value;
    const ehIndice = tipo === "indice";

    blocoModo.hidden = tipo !== "valor";
    if (blocoIndice) blocoIndice.hidden = !ehIndice;
    if (blocoValor) blocoValor.hidden = ehIndice;
    rotulo.textContent = tipo === "percentual" ? "Percentual do reajuste (%)" : "Valor total do reajuste (R$ mil)";

    if (ehIndice) sincronizarIndice();

    const { meses, porMes, total } = calcularDistribuicao();

    if (!linhaAlvo || !meses.length || !total) {
      previa.innerHTML = '<span class="reajuste-vazio">Escolha um valor e ao menos um mês para ver a prévia.</span>';
      return;
    }

    const atuais = inputsMes().map((i) => Number(i.value) || 0);
    const totalAntes = atuais.reduce((s, v) => s + v, 0);
    const detalhe = meses
      .map((m) => `<span class="reajuste-chip">${MESES_CURTOS[m]} <strong>+${porMes.get(m).toLocaleString("pt-BR")}</strong></span>`)
      .join("");

    const p = ehIndice ? premissaEscolhida() : null;
    const origem = p
      ? `<div class="reajuste-origem">Aplicando <strong>${escaparTexto(p.nome)}</strong> — acumulado 12m de ${acumuladoComposto(p.mensal).toFixed(2).replace(".", ",")}%, direto do cadastro de premissas</div>`
      : "";

    previa.innerHTML = `
      ${origem}
      <div class="reajuste-previa-topo">
        <span>${meses.length} mês(es) · <strong>+ R$ ${total.toLocaleString("pt-BR")} mil</strong> no ano</span>
        <span class="reajuste-de-para">total da linha: R$ ${totalAntes.toLocaleString("pt-BR")} → <strong>R$ ${(totalAntes + total).toLocaleString("pt-BR")} mil</strong></span>
      </div>
      <div class="reajuste-chips">${detalhe}</div>`;
  }

  function abrir(botao) {
    linhaAlvo = botao.closest("tr");
    const nome = linhaAlvo.querySelector(".conta-nome-input")?.value.trim()
      || botao.getAttribute("data-action-label") || "linha";
    const atuais = inputsMes().map((i) => Number(i.value) || 0);

    overlay.querySelector("[data-reajuste-linha]").innerHTML =
      `<strong>${escaparTexto(nome)}</strong><br /><span class="reajuste-dica">Hoje: R$ ${atuais.reduce((s, v) => s + v, 0).toLocaleString("pt-BR")} mil no ano</span>`;

    caixaMeses.querySelectorAll("input").forEach((c) => { c.checked = false; });
    selectApartir.value = "";
    campoValor.value = 0;
    atualizarPrevia();
    overlay.classList.add("open");
  }

  document.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-reajuste-abrir]");
    if (botao) abrir(botao);
  });

  selectApartir.addEventListener("change", () => {
    const inicio = selectApartir.value === "" ? null : Number(selectApartir.value);
    caixaMeses.querySelectorAll("input").forEach((c) => {
      c.checked = inicio !== null && Number(c.dataset.mes) >= inicio;
    });
    atualizarPrevia();
  });

  overlay.querySelectorAll("[data-reajuste-atalho]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const todos = btn.getAttribute("data-reajuste-atalho") === "todos";
      caixaMeses.querySelectorAll("input").forEach((c) => { c.checked = todos; });
      selectApartir.value = "";
      atualizarPrevia();
    });
  });

  overlay.addEventListener("change", (e) => {
    if (e.target.matches("[data-reajuste-valor], [data-reajuste-tipo], [data-reajuste-modo], [data-mes], [data-reajuste-indice]")) {
      atualizarPrevia();
    }
  });
  campoValor.addEventListener("input", atualizarPrevia);

  // índices do cadastro de premissas: câmbio fica de fora, não é reajuste em %
  carregarRef("premissas.json")
    .then((doc) => {
      premissas = doc.premissas.filter((p) => p.tipo === "indice");
      if (!selectIndice) return;
      premissas.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.codigo;
        opt.textContent = `${p.nome} — ${p.aplicacao}`;
        selectIndice.appendChild(opt);
      });
      sincronizarIndice();
    })
    .catch(() => {
      campoTipo.querySelector('[value="indice"]')?.remove();
    });

  overlay.querySelector("[data-reajuste-aplicar]").addEventListener("click", () => {
    const { meses, porMes, total } = calcularDistribuicao();
    if (!linhaAlvo || !meses.length || !total) {
      showToast("Informe um valor e marque ao menos um mês", "warning");
      return;
    }

    const inputs = inputsMes();
    meses.forEach((m) => {
      inputs[m].value = (Number(inputs[m].value) || 0) + porMes.get(m);
    });

    // avisa o resto da tela (ativação, pacote) que os valores mudaram
    inputs[meses[0]].dispatchEvent(new Event("change", { bubbles: true }));

    overlay.classList.remove("open");
    showToast(`Reajuste de R$ ${total.toLocaleString("pt-BR")} mil diluído em ${meses.length} mês(es)`, "success");
  });
}

/* ---------- Cronograma do ciclo: Gantt, calendário e reminders ----------
 * O avanço das etapas de lançamento não é digitado: sai de entregas.json,
 * então a linha do tempo mostra a dinâmica real das entregas.
 */

const DIA_MS = 86400000;

function soData(iso) {
  return new Date(iso + "T12:00:00");
}

function diasEntre(a, b) {
  return Math.round((soData(b) - soData(a)) / DIA_MS);
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function statusEtapa(etapa, hoje) {
  if (etapa.avanco >= 100) return { chave: "concluida", rotulo: "Concluída" };
  if (diasEntre(etapa.fim, hoje) > 0) return { chave: "atrasada", rotulo: "Atrasada" };
  if (diasEntre(etapa.inicio, hoje) >= 0) return { chave: "andamento", rotulo: "Em andamento" };
  return { chave: "futura", rotulo: "A começar" };
}

function initCronograma() {
  const gantt = document.querySelector("[data-gantt]");
  if (!gantt) return;

  const hoje = hojeISO();

  Promise.all([
    carregarRef("cronograma.json"),
    carregarRef("entregas.json").catch(() => null),
  ])
    .then(([crono, entregasDoc]) => {
      // avanço real das etapas de lançamento, vindo do mapa de entregas
      crono.etapas.forEach((etapa) => {
        if (!etapa.fonteEntregas || !entregasDoc) return;
        const total = entregasDoc.entregas.length;
        const feitas = entregasDoc.entregas.filter(
          (e) => e.status[etapa.fonteEntregas] === "aprovado"
        ).length;
        etapa.avanco = total ? Math.round((feitas / total) * 100) : 0;
        etapa.detalheAvanco = `${feitas} de ${total} empresas`;
      });

      renderGantt(crono, hoje);
      renderCalendario(crono, hoje);
      renderReminders(crono, hoje);
    })
    .catch(() => {
      gantt.innerHTML = '<div class="empty-hint">Não foi possível carregar <strong>Referencias/cronograma.json</strong>.</div>';
    });

  function renderGantt(crono, hoje) {
    const inicioMin = crono.etapas.reduce((a, e) => (e.inicio < a ? e.inicio : a), crono.etapas[0].inicio);
    const fimMax = crono.etapas.reduce((a, e) => (e.fim > a ? e.fim : a), crono.etapas[0].fim);
    const span = diasEntre(inicioMin, fimMax) + 1;
    const pos = (data) => (diasEntre(inicioMin, data) / span) * 100;

    // cabeçalho de meses, cada um com a largura dos seus dias dentro do intervalo
    const meses = [];
    let cursor = soData(inicioMin);
    cursor.setDate(1);
    while (cursor <= soData(fimMax)) {
      const ano = cursor.getFullYear();
      const mes = cursor.getMonth();
      const primeiro = new Date(ano, mes, 1);
      const ultimo = new Date(ano, mes + 1, 0);
      const de = primeiro < soData(inicioMin) ? soData(inicioMin) : primeiro;
      const ate = ultimo > soData(fimMax) ? soData(fimMax) : ultimo;
      const dias = Math.round((ate - de) / DIA_MS) + 1;
      meses.push({ rotulo: `${MESES_CURTOS[mes]}/${String(ano).slice(2)}`, largura: (dias / span) * 100 });
      cursor = new Date(ano, mes + 1, 1);
    }

    const concluidas = crono.etapas.filter((e) => e.avanco >= 100).length;
    const atrasadas = crono.etapas.filter((e) => statusEtapa(e, hoje).chave === "atrasada").length;
    const resumo = document.querySelector("[data-gantt-resumo]");
    if (resumo) {
      resumo.innerHTML = `${crono.etapas.length} etapas · ${concluidas} concluída(s) · <strong>${atrasadas} atrasada(s)</strong> · versão ativa ${escaparTexto(crono.versaoAtiva)}`;
    }

    const linhas = crono.etapas
      .map((etapa) => {
        const st = statusEtapa(etapa, hoje);
        const esquerda = pos(etapa.inicio);
        const largura = Math.max(1.2, ((diasEntre(etapa.inicio, etapa.fim) + 1) / span) * 100);
        const dependeDe = etapa.depende.length ? ` · depois de ${etapa.depende.join(", ")}` : "";
        const detalhe = etapa.detalheAvanco ? ` (${escaparTexto(etapa.detalheAvanco)})` : "";

        return `<div class="gantt-linha">
          <div class="gantt-rotulo">
            <strong>${escaparTexto(etapa.nome)}</strong>
            <span>${escaparTexto(etapa.responsavel)} · ${escaparTexto(etapa.area)}${dependeDe}</span>
            <em>Dono do dado: ${escaparTexto(etapa.donoDoDado)}</em>
          </div>
          <div class="gantt-faixa">
            <div class="gantt-barra ${st.chave}" style="left:${esquerda}%; width:${largura}%;"
              title="${escaparTexto(etapa.nome)} — ${dataBR(etapa.inicio)} a ${dataBR(etapa.fim)} · ${st.rotulo} · ${etapa.avanco}%">
              <span class="gantt-preenchido" style="width:${etapa.avanco}%"></span>
              <span class="gantt-texto">${etapa.avanco}%${detalhe}</span>
            </div>
          </div>
        </div>`;
      })
      .join("");

    gantt.innerHTML = `
      <div class="gantt-meses">
        <div class="gantt-rotulo"></div>
        <div class="gantt-faixa">${meses.map((m) => `<span style="width:${m.largura}%">${m.rotulo}</span>`).join("")}</div>
      </div>
      <div class="gantt-corpo">
        ${linhas}
        <div class="gantt-hoje-camada">
          <div class="gantt-hoje" style="left:${pos(hoje)}%">
            <span>hoje ${dataBR(hoje)}</span>
          </div>
        </div>
      </div>`;
  }

  function renderCalendario(crono, hoje) {
    const alvo = document.querySelector("[data-calendario]");
    if (!alvo) return;

    alvo.innerHTML = crono.marcos
      .slice()
      .sort((a, b) => (a.data < b.data ? -1 : 1))
      .map((m) => {
        const dias = diasEntre(hoje, m.data);
        const passou = dias < 0;
        const quando = dias === 0 ? "hoje" : passou ? `há ${Math.abs(dias)} dia(s)` : `em ${dias} dia(s)`;
        const d = soData(m.data);

        return `<div class="marco ${passou ? "passado" : dias <= 7 ? "proximo" : ""}">
          <div class="marco-data">
            <strong>${String(d.getDate()).padStart(2, "0")}</strong>
            <span>${MESES_CURTOS[d.getMonth()]}</span>
          </div>
          <div class="marco-texto">
            <strong>${escaparTexto(m.nome)}</strong>
            <span>${escaparTexto(m.detalhe)}</span>
          </div>
          <span class="marco-quando">${quando}</span>
        </div>`;
      })
      .join("");
  }

  function renderReminders(crono, hoje) {
    const regras = document.querySelector("[data-reminder-regras]");
    const fila = document.querySelector("[data-reminder-fila]");
    if (!regras || !fila) return;

    regras.innerHTML = crono.reminders
      .map((r) => {
        const quando = r.diasAntes > 0 ? `${r.diasAntes} dias antes`
          : r.diasAntes === 0 ? "no dia do corte"
          : `${Math.abs(r.diasAntes)} dias depois do corte`;
        return `<div class="reminder-regra">
          <span class="reminder-quando">${quando}</span>
          <div>
            <strong>${escaparTexto(r.para)}</strong> <span class="reminder-canal">${escaparTexto(r.canal)}</span>
            <p>${escaparTexto(r.texto)}</p>
          </div>
        </div>`;
      })
      .join("");

    // cruza cada marco com cada regra e mostra o que ainda vai disparar
    const disparos = [];
    crono.marcos.forEach((m) => {
      crono.reminders.forEach((r) => {
        const data = new Date(soData(m.data) - r.diasAntes * DIA_MS);
        const iso = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
        const dias = diasEntre(hoje, iso);
        if (dias >= 0) disparos.push({ iso, dias, marco: m.nome, para: r.para, canal: r.canal });
      });
    });

    disparos.sort((a, b) => a.dias - b.dias);

    fila.innerHTML = disparos.length
      ? disparos.slice(0, 6).map((d) => `<div class="reminder-disparo">
          <span class="reminder-data">${dataBR(d.iso)}</span>
          <span>${d.dias === 0 ? "<strong>hoje</strong>" : `em ${d.dias} dia(s)`} · ${escaparTexto(d.marco)}</span>
          <span class="reminder-alvo">${escaparTexto(d.para)} · ${escaparTexto(d.canal)}</span>
        </div>`).join("")
      : '<div class="empty-hint">Nenhum lembrete pendente para o restante do ciclo.</div>';
  }
}

/* ---------- Status do ciclo: as três perguntas do dashboard ----------
 * Qual a versão vigente, se ainda tem pendência e quando encerra.
 * Tudo derivado das mesmas bases das outras telas, para não haver dois
 * números diferentes para a mesma pergunta.
 */

/* Onde o ciclo está: o que falta entregar, o que espera decisão e quando fecha.
   Duas telas mostram isso — o Dashboard e o Dashboard Executivo —, então a
   contagem mora aqui em vez de em cada uma. Se divergissem, a apresentação
   diria um número e a tela ao lado diria outro. */
function resumoDoCiclo(crono, entregasDoc, aprov) {
  let faltando = 0, atrasadas = 0, aguardandoDecisao = 0, aguardandoAceite = 0;

  if (entregasDoc) {
    entregasDoc.entregas.forEach((e) => {
      ENTREGA_CATEGORIAS.forEach((c) => {
        if (!infoStatusEntrega(e.status[c]).concluida) faltando++;
        if (entregaAtrasada(e.status[c], entregasDoc.prazos[c])) atrasadas++;
      });
    });
  }
  if (aprov) {
    aguardandoDecisao = aprov.submissoes.filter((s) => s.statusOficial === "pendente").length;
    aguardandoAceite = aprov.submissoes.filter((s) => s.statusOficial === "aprovado" && !s.aceiteFinal).length;
  }

  const hoje = hojeISO();
  const marcos = crono.marcos.slice().sort((a, b) => (a.data < b.data ? -1 : 1));
  const fim = marcos[marcos.length - 1];
  const proximo = marcos.find((m) => diasEntre(hoje, m.data) >= 0);

  return {
    faltando, atrasadas, aguardandoDecisao, aguardandoAceite, fim, proximo,
    diasFim: diasEntre(hoje, fim.data),
    diasProximo: proximo ? diasEntre(hoje, proximo.data) : null,
  };
}

function initStatusCiclo() {
  const alvo = document.querySelector("[data-status-ciclo]");
  if (!alvo) return;

  Promise.all([
    carregarRef("cronograma.json"),
    carregarRef("entregas.json").catch(() => null),
    carregarRef("aprovacoes.json").catch(() => null),
  ])
    .then(([crono, entregasDoc, aprov]) => {
      const r = resumoDoCiclo(crono, entregasDoc, aprov);

      // ---- 1. versão vigente
      const versao = `<a class="status-card" href="budget-settings.html">
          <span class="status-rot">Versão vigente</span>
          <strong class="status-valor">${escaparTexto(crono.versaoAtiva)}</strong>
          <span class="status-linha">Ciclo ${escaparTexto(crono.ciclo)} · ${escaparTexto(crono.versaoTipo || "—")}</span>
          <span class="status-nota">em edição desde ${dataBR(crono.versaoDesde)}</span>
        </a>`;

      // ---- 2. pendências
      const temPendencia = r.faltando + r.aguardandoDecisao + r.aguardandoAceite > 0;
      const grau = r.atrasadas ? "ruim" : temPendencia ? "atencao" : "bom";

      const pendencias = `<div class="status-card ${grau}">
          <span class="status-rot">Ainda tem pendência?</span>
          <strong class="status-valor">${temPendencia ? "Sim" : "Não"}</strong>
          <span class="status-linhas">
            <a href="entregas.html">${r.faltando} entrega(s) por lançar${r.atrasadas ? ` · <strong>${r.atrasadas} atrasada(s)</strong>` : ""}</a>
            <a href="aprovacoes.html">${r.aguardandoDecisao} aguardando decisão do aprovador</a>
            <a href="aprovacoes.html">${r.aguardandoAceite} aguardando aceite do líder</a>
          </span>
        </div>`;

      // ---- 3. encerramento
      const encerramento = `<a class="status-card ${r.diasFim <= 15 ? "atencao" : ""}" href="budget-settings.html">
          <span class="status-rot">Quando encerra</span>
          <strong class="status-valor">${dataBR(r.fim.data)}</strong>
          <span class="status-linha">${escaparTexto(r.fim.nome)} · faltam <strong>${r.diasFim} dia(s)</strong></span>
          <span class="status-nota">${r.proximo && r.proximo !== r.fim
            ? `Próximo corte: ${escaparTexto(r.proximo.nome)}, em ${r.diasProximo} dia(s)`
            : "Último marco do ciclo"}</span>
        </a>`;

      alvo.innerHTML = versao + pendencias + encerramento;
    })
    .catch(() => {
      alvo.innerHTML = '<div class="empty-hint">Não foi possível carregar o status do ciclo.</div>';
    });
}

/* ---------- Notificações: modelos, fila e prévia ----------
 * Sem backend não há envio. O que existe aqui é o que precisa ser decidido
 * antes de ligar em qualquer serviço: quem recebe, quando dispara e o texto.
 * A fila sai dos dados reais — a rejeição carrega o motivo que o aprovador
 * escreveu, não um texto genérico.
 */

function preencherModelo(texto, contexto) {
  return String(texto).replace(/\{\{(\w+)\}\}/g, (_, chave) =>
    contexto[chave] !== undefined ? contexto[chave] : `{{${chave}}}`
  );
}

function initNotificacoes() {
  const fila = document.querySelector("[data-notif-fila]");
  if (!fila) return;

  const previa = document.querySelector("[data-notif-previa]");
  const filtros = { tipo: "", para: "" };
  const CORES = { REJEICAO: "trava", ESCALACAO: "trava", PRAZO: "falta", ACEITE: "falta" };
  let modelos = {};
  let itens = [];
  let selecionado = null;
  let base = null;

  function montarFila(notif, aprov, entregasDoc, crono) {
    const hoje = hojeISO();
    const lista = [];

    // 1. rejeições — o motivo vem do parecer que o aprovador escreveu
    aprov.submissoes
      .filter((s) => s.statusOficial === "reprovado")
      .forEach((s) => {
        lista.push({
          tipo: "REJEICAO",
          para: s.responsavel,
          copia: s.liderResponsavel?.nome || "—",
          titulo: `${s.empresa} · ${APROV_CATEGORIA[s.categoria]}`,
          detalhe: `Reprovado por ${s.decisao?.por} em ${dataBR(s.decisao?.em)}`,
          contexto: {
            ciclo: aprov.ciclo, empresa: s.empresa, categoria: APROV_CATEGORIA[s.categoria],
            bu: s.bu, torre: s.torre, responsavel: s.responsavel,
            aprovador: s.decisao?.por || "—", data: dataBR(s.decisao?.em),
            motivo: s.decisao?.parecer || "—",
          },
        });
      });

    // 2. aceites pendentes do líder
    aprov.submissoes
      .filter((s) => s.statusOficial === "aprovado" && !s.aceiteFinal)
      .forEach((s) => {
        lista.push({
          tipo: "ACEITE",
          para: s.liderResponsavel?.nome || "—",
          copia: "—",
          titulo: `${s.empresa} · ${APROV_CATEGORIA[s.categoria]}`,
          detalhe: `Aprovado, aguardando ${s.liderResponsavel?.cargo || "o líder"}`,
          contexto: {
            ciclo: aprov.ciclo, empresa: s.empresa, categoria: APROV_CATEGORIA[s.categoria],
            lider: s.liderResponsavel?.nome || "—",
            declaracao: aprov.declaracaoAceiteFinal || "",
          },
        });
      });

    // 3. escalação — entrega vencida, uma por empresa
    if (entregasDoc) {
      entregasDoc.entregas.forEach((e) => {
        const vencidas = ENTREGA_CATEGORIAS.filter((c) => entregaAtrasada(e.status[c], entregasDoc.prazos[c]));
        if (!vencidas.length) return;

        const lider = aprov.submissoes.find((s) => s.torre === e.torre)?.liderResponsavel;
        lista.push({
          tipo: "ESCALACAO",
          para: lider?.nome || "Liderança da Torre",
          copia: "FP&A",
          titulo: `${e.empresa} · ${vencidas.length} vencida(s)`,
          detalhe: `${e.torre} · responsável ${e.responsavel}`,
          contexto: {
            ciclo: entregasDoc.ciclo, empresa: e.empresa, torre: e.torre,
            lider: lider?.nome || "Liderança da Torre", responsavel: e.responsavel,
            qtdPendente: vencidas.length,
            categorias: vencidas.map((c) => ENTREGA_ROTULO_CATEGORIA[c]).join(", "),
          },
        });
      });
    }

    // 4. lembretes dos cortes que ainda não venceram
    if (crono) {
      crono.marcos
        .filter((m) => diasEntre(hoje, m.data) >= 0)
        .forEach((m) => {
          const dias = diasEntre(hoje, m.data);
          lista.push({
            tipo: "PRAZO",
            para: "Responsáveis de área",
            copia: "—",
            titulo: m.nome,
            detalhe: `Vence em ${dataBR(m.data)} · ${dias} dia(s)`,
            contexto: {
              ciclo: crono.ciclo, marco: m.nome, prazo: dataBR(m.data),
              diasRestantes: dias, detalhe: m.detalhe, responsavel: "Responsáveis de área",
            },
          });
        });
    }

    lista.forEach((item, i) => {
      item.id = `N${i + 1}`;
      item.contexto.assinatura = notif.assinatura;
    });
    return lista;
  }

  function visiveis() {
    return itens.filter(
      (i) => (!filtros.tipo || i.tipo === filtros.tipo) && (!filtros.para || i.para === filtros.para)
    );
  }

  function renderKpis() {
    Object.keys(modelos).forEach((codigo) => {
      const el = document.querySelector(`[data-notif-kpi="${codigo}"]`);
      if (el) el.textContent = itens.filter((i) => i.tipo === codigo).length;
    });
  }

  function renderFila() {
    const lista = visiveis();
    const contagem = document.querySelector("[data-notif-contagem]");
    if (contagem) contagem.textContent = `${lista.length} notificação(ões) na fila · clique para ver o e-mail`;

    fila.innerHTML = lista.length
      ? lista
          .map((i) => `<button type="button" class="aprov-item ${selecionado === i.id ? "selecionada" : ""}" data-notif-id="${i.id}">
              <span class="aprov-item-topo">
                <strong>${escaparTexto(i.titulo)}</strong>
                <span class="aprov-marca ${CORES[i.tipo]}">${escaparTexto(modelos[i.tipo].nome)}</span>
              </span>
              <span class="aprov-item-meta">${escaparTexto(i.detalhe)}</span>
              <span class="aprov-item-meta">para <strong>${escaparTexto(i.para)}</strong>${i.copia !== "—" ? ` · cc ${escaparTexto(i.copia)}` : ""}</span>
            </button>`)
          .join("")
      : '<div class="empty-hint">Nada na fila com esses filtros.</div>';
  }

  function renderPrevia() {
    const item = itens.find((i) => i.id === selecionado);
    if (!item) {
      previa.innerHTML = '<div class="panel-body"><div class="empty-hint">Selecione uma notificação para ver o e-mail exato que a pessoa receberia.</div></div>';
      return;
    }

    const modelo = modelos[item.tipo];
    previa.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>Prévia do e-mail</h2>
          <p>${escaparTexto(modelo.nome)} · canal ${escaparTexto(modelo.canal)}</p>
        </div>
        <button class="btn btn-primary btn-sm" data-notif-enviar>✉ Enviar agora</button>
      </div>
      <div class="panel-body">
        <div class="email">
          <div class="email-cabecalho">
            <div><span>De</span>${escaparTexto(base.remetente)}</div>
            <div><span>Para</span>${escaparTexto(item.para)}</div>
            ${item.copia !== "—" ? `<div><span>Cc</span>${escaparTexto(item.copia)}</div>` : ""}
            <div><span>Assunto</span><strong>${escaparTexto(preencherModelo(modelo.assunto, item.contexto))}</strong></div>
          </div>
          <pre class="email-corpo">${escaparTexto(preencherModelo(modelo.corpo, item.contexto))}</pre>
        </div>
      </div>`;
  }

  function redesenhar() {
    renderKpis();
    renderFila();
    renderPrevia();
  }

  fila.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-notif-id]");
    if (!botao) return;
    selecionado = botao.getAttribute("data-notif-id");
    redesenhar();
  });

  previa.addEventListener("click", (e) => {
    if (!e.target.closest("[data-notif-enviar]")) return;
    const item = itens.find((i) => i.id === selecionado);
    showToast(`Envio simulado para ${item.para} — o protótipo não tem servidor de e-mail`, "info");
  });

  document.querySelectorAll("[data-notif-filtro]").forEach((select) => {
    select.addEventListener("change", () => {
      filtros[select.getAttribute("data-notif-filtro")] = select.value;
      redesenhar();
    });
  });

  Promise.all([
    carregarRef("notificacoes.json"),
    carregarRef("aprovacoes.json"),
    carregarRef("entregas.json").catch(() => null),
    carregarRef("cronograma.json").catch(() => null),
  ])
    .then(([notif, aprov, entregasDoc, crono]) => {
      base = notif;
      notif.modelos.forEach((m) => { modelos[m.codigo] = m; });
      itens = montarFila(notif, aprov, entregasDoc, crono);

      const selPara = document.querySelector('[data-notif-filtro="para"]');
      if (selPara) {
        Array.from(new Set(itens.map((i) => i.para))).sort().forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p;
          opt.textContent = p;
          selPara.appendChild(opt);
        });
      }

      const modelosEl = document.querySelector("[data-notif-modelos]");
      if (modelosEl) {
        modelosEl.innerHTML = notif.modelos
          .map((m) => `<div class="modelo">
              <div class="modelo-topo">
                <strong>${escaparTexto(m.nome)}</strong>
                <span class="modelo-tag">${escaparTexto(m.canal)}</span>
                <span class="modelo-tag prioridade-${escaparTexto(m.prioridade)}">${escaparTexto(m.prioridade)}</span>
              </div>
              <p class="modelo-gatilho"><strong>Dispara quando:</strong> ${escaparTexto(m.evento)}</p>
              <p class="modelo-gatilho"><strong>Para:</strong> ${escaparTexto(m.para)}${m.copia !== "—" ? ` · <strong>Cc:</strong> ${escaparTexto(m.copia)}` : ""}</p>
              <div class="modelo-assunto">${escaparTexto(m.assunto)}</div>
              <pre class="modelo-corpo">${escaparTexto(m.corpo)}</pre>
            </div>`)
          .join("");
      }

      selecionado = itens.length ? itens[0].id : null;
      redesenhar();
    })
    .catch(() => {
      fila.innerHTML = '<div class="empty-hint">Não foi possível carregar os dados das notificações.</div>';
    });
}

/* ---------- Lançamento guiado ----------
 * Alternativa à planilha para quem não é do financeiro: uma pergunta por vez,
 * em português comum, e o ritmo do valor escolhido por comportamento
 * ("todo mês igual") em vez de 12 caixinhas em branco.
 */

/* Resumo em linguagem de gente: o que já foi lançado, sem parecer planilha */
function renderResumoLancamentos() {
  const alvo = document.querySelector("[data-resumo-lancamentos]");
  if (!alvo) return;

  const tabela = document.getElementById(alvo.getAttribute("data-resumo-lancamentos"));
  if (!tabela) return;

  const linhas = Array.from(tabela.querySelectorAll("tbody tr"));

  // cada grade nomeia e agrupa por colunas diferentes: Despesa por conta e
  // pacote, Receita por produto e tipo de receita
  // sem o atributo tem que ficar -1: procurar título vazio acha a coluna de
  // ações, que também tem <th> sem texto
  const coluna = (attr) => {
    const titulo = alvo.getAttribute(attr);
    return titulo ? colunaPorTitulo(tabela, titulo) : -1;
  };
  const colNome = coluna("data-resumo-nome");
  const colGrupo = coluna("data-resumo-grupo");
  const colDetalhe = coluna("data-resumo-detalhe");
  const celula = (row, i) => (i >= 0 ? row.children[i]?.querySelector("input")?.value.trim() || "" : "");

  const itens = linhas.map((row) => {
    const nome = colNome >= 0
      ? [celula(row, colDetalhe), celula(row, colNome)].filter(Boolean).join(" · ")
      : row.querySelector(".conta-nome-input")?.value.trim() || "(sem descrição)";
    const pacote = colGrupo >= 0
      ? celula(row, colGrupo) || "sem classificação"
      : row.querySelector(".pacote-input")?.value.trim() || "sem motivo definido";

    return { nome: nome || "(sem descrição)", pacote, total: totalAnualDaLinha(row) };
  });

  const totalGeral = itens.reduce((s, i) => s + i.total, 0);
  const porPacote = new Map();
  itens.forEach((i) => porPacote.set(i.pacote, (porPacote.get(i.pacote) || 0) + i.total));

  const resumoTopo = document.querySelector("[data-resumo-topo]");
  if (resumoTopo) {
    const termo = alvo.getAttribute("data-resumo-termo-grupo") || "motivo(s) diferentes";
    resumoTopo.innerHTML = `<strong>${itens.length} lançamento(s)</strong> · R$ ${totalGeral.toLocaleString("pt-BR")} mil no ano · ${porPacote.size} ${termo}`;
  }

  const barras = Array.from(porPacote.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([nome, valor]) => {
      const pct = totalGeral ? Math.round((valor / totalGeral) * 100) : 0;
      return `<div class="resumo-pacote">
        <div class="resumo-pacote-topo">
          <span>${escaparTexto(nome)}</span>
          <strong>R$ ${valor.toLocaleString("pt-BR")} mil · ${pct}%</strong>
        </div>
        <span class="resumo-barra"><span style="width:${pct}%"></span></span>
      </div>`;
    })
    .join("");

  const cartoes = itens.length
    ? itens
        .map((i) => `<div class="resumo-item">
            <div>
              <strong>${escaparTexto(i.nome)}</strong>
              <span>${escaparTexto(i.pacote)}</span>
            </div>
            <span class="resumo-valor">R$ ${i.total.toLocaleString("pt-BR")} mil</span>
          </div>`)
        .join("")
    : '<div class="empty-hint">Nada lançado ainda. Use a aba <strong>Lançar</strong> para começar.</div>';

  alvo.innerHTML = `${barras ? `<div class="resumo-pacotes">${barras}</div>` : ""}<div class="resumo-itens">${cartoes}</div>`;
}

function colunaPorTitulo(tabela, titulo) {
  const ths = Array.from(tabela.querySelectorAll("thead tr:last-child th"));
  return ths.findIndex((th) => th.textContent.trim() === titulo);
}

function initFormLancamento() {
  // atalho do resumo para a aba de lançamento
  document.querySelectorAll("[data-ir-para-lancar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector('[data-tab-target="tab-lancar"]')?.click();
      document.querySelector("[data-form-lancamento] [data-campo='descricao']")?.focus();
    });
  });

  document.querySelectorAll("[data-form-lancamento]").forEach((form) => {
    const tabela = document.getElementById(form.getAttribute("data-form-lancamento"));
    if (!tabela) return;

    const tipo = form.getAttribute("data-form-tipo");
    const caixaMeses = form.querySelector("[data-form-meses]");
    const caixaVariavel = form.querySelector("[data-form-variavel]");
    const selectAtivacao = form.querySelector('[data-campo="ativacao"]');
    const passoAtivacao = selectAtivacao?.closest(".passo");
    const campoValor = form.querySelector('[data-campo="valor"]');
    const erro = form.querySelector("[data-form-erro]");
    let pacoteEscolhido = "";

    // padrão: um valor, num mês só. O Phasing abre a distribuição no ano.
    const caixaPontual = form.querySelector("[data-modo-pontual]");
    const painelPhasing = form.querySelector("[data-modo-phasing]");
    const btnPhasing = form.querySelector("[data-phasing-toggle]");
    const campoPontual = form.querySelector('[data-campo="valor-pontual"]');
    const selectMes = form.querySelector('[data-campo="mes-pontual"]');
    let phasing = false;

    // a grade de Receita não tem coluna de ativação: o passo some
    if (passoAtivacao && !tabela.querySelector(".ativacao-input")) passoAtivacao.remove();

    /* Nem todo formulário guiado tem o painel de Phasing. Sem estas guardas,
       um formulário sem ele derrubava o DOMContentLoaded inteiro — e com ele
       todos os init seguintes da página, não só este. */
    MESES_CURTOS.forEach((mes, i) => {
      if (caixaMeses) {
        const label = document.createElement("label");
        label.className = "reajuste-mes";
        label.innerHTML = `<input type="checkbox" data-mes="${i}" /><span>${mes}</span>`;
        caixaMeses.appendChild(label);
      }
      if (caixaVariavel) {
        const campo = document.createElement("label");
        campo.className = "mes-variavel";
        campo.innerHTML = `<span>${mes}</span><input type="number" data-mes-valor="${i}" value="0" min="0" />`;
        caixaVariavel.appendChild(campo);
      }
      if (selectMes) selectMes.appendChild(new Option(mes, String(i)));
    });

    function ritmo() {
      return form.querySelector('input[name="ritmo"]:checked').value;
    }

    /* devolve os 12 meses conforme o ritmo escolhido */
    function valoresDosMeses() {
      // sem phasing o lançamento cai inteiro no mês escolhido
      if (!phasing) {
        const mes = Number(selectMes.value) || 0;
        const unico = Number(campoPontual.value) || 0;
        return MESES_CURTOS.map((_, i) => (i === mes ? unico : 0));
      }

      const modo = ritmo();
      const valor = Number(campoValor.value) || 0;

      if (modo === "igual") return MESES_CURTOS.map(() => valor);

      if (modo === "alguns") {
        const marcados = Array.from(caixaMeses.querySelectorAll("input:checked")).map((c) => Number(c.dataset.mes));
        return MESES_CURTOS.map((_, i) => (marcados.includes(i) ? valor : 0));
      }

      return Array.from(caixaVariavel.querySelectorAll("[data-mes-valor]")).map((i) => Number(i.value) || 0);
    }

    function atualizar() {
      caixaPontual.hidden = phasing;
      painelPhasing.hidden = !phasing;

      const modo = ritmo();
      form.querySelector("[data-ritmo-valor]").hidden = modo === "variavel";
      form.querySelector("[data-ritmo-meses]").hidden = modo !== "alguns";
      form.querySelector("[data-ritmo-variavel]").hidden = modo !== "variavel";

      const total = valoresDosMeses().reduce((s, v) => s + v, 0);
      form.querySelector("[data-form-total]").innerHTML =
        `Total no ano: <strong>R$ ${total.toLocaleString("pt-BR")} mil</strong>`;

      // eco da conta reconhecida, para a pessoa ver que o sistema entendeu
      const eco = form.querySelector('[data-eco="conta"]');
      const digitado = form.querySelector('[data-campo="descricao"]')?.value.trim() || "";
      const match = (window.__contasRef || []).find((c) => c.nome === digitado);
      if (eco) {
        eco.textContent = match
          ? `Reconhecido: conta ${match.conta} · ${match.linhaPL}`
          : digitado ? "Conta não reconhecida — vai entrar como texto livre, sem classificação automática." : "";
        eco.className = `passo-eco ${match ? "ok" : digitado ? "alerta" : ""}`;
      }
    }

    form.addEventListener("input", atualizar);
    form.addEventListener("change", atualizar);

    function trocarPhasing(ligado) {
      phasing = ligado;
      btnPhasing.setAttribute("aria-pressed", String(ligado));
      btnPhasing.classList.toggle("btn-primary", ligado);
      btnPhasing.classList.toggle("btn-secondary", !ligado);
      btnPhasing.closest(".phasing-topo").classList.toggle("ligado", ligado);
      form.querySelector("[data-phasing-estado]").textContent = ligado
        ? "Distribuído ao longo do ano"
        : "Valor único, em um mês";
      atualizar();
    }

    btnPhasing.addEventListener("click", () => {
      // leva o valor já digitado para o outro layout, para não redigitar
      if (!phasing && !Number(campoValor.value)) campoValor.value = campoPontual.value;
      if (phasing && !Number(campoPontual.value)) campoPontual.value = campoValor.value;
      trocarPhasing(!phasing);
    });

    form.querySelector("[data-form-limpar]")?.addEventListener("click", () => {
      form.reset();
      trocarPhasing(false);
      caixaMeses?.querySelectorAll("input").forEach((c) => { c.checked = false; });
      caixaVariavel?.querySelectorAll("input").forEach((i) => { i.value = 0; });
      form.querySelectorAll(".cartao-pacote").forEach((c) => c.classList.remove("escolhido"));
      pacoteEscolhido = "";
      if (erro) erro.hidden = true;
      atualizar();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const campoDescricao = form.querySelector('[data-campo="descricao"]');
      const descricao = campoDescricao ? campoDescricao.value.trim() : "";
      const valores = valoresDosMeses();
      const total = valores.reduce((s, v) => s + v, 0);

      const faltas = [];
      if (campoDescricao && !descricao) faltas.push("dizer o que é");
      if (form.querySelector("[data-cartoes-pacote]") && !pacoteEscolhido) faltas.push("escolher o motivo");

      // campos obrigatórios da estrutura (Receita: Torre, Empresa, Produto, Tipo)
      form.querySelectorAll("[data-campo][data-coluna][required]").forEach((campo) => {
        if (!campo.value) faltas.push(`escolher ${campo.getAttribute("data-coluna").toLowerCase()}`);
      });

      if (!total) faltas.push("informar um valor maior que zero");

      if (faltas.length) {
        erro.textContent = `Falta ${faltas.join(", ")}.`;
        erro.hidden = false;
        return;
      }
      erro.hidden = true;

      const modelo = tabela.querySelector("tbody tr");
      const nova = modelo.cloneNode(true);
      nova.hidden = false;
      nova.classList.remove("selected");
      nova.removeAttribute("data-drill-target");
      nova.querySelectorAll("input").forEach((i) => { i.value = i.type === "number" ? 0 : ""; });

      const campoConta = nova.querySelector(".conta-nome-input");
      if (campoConta) campoConta.value = descricao;
      const match = (window.__contasRef || []).find((c) => c.nome === descricao);
      if (match) {
        const set = (sel, v) => { const el = nova.querySelector(sel); if (el) el.value = v; };
        set(".conta-codigo-input", match.conta);
        set(".conta-linha-input", match.linhaPL);
        set(".conta-categoria-input", match.categoria);
      }

      const pac = nova.querySelector(".pacote-input");
      if (pac) pac.value = pacoteEscolhido;

      const contextoEl = form.querySelector('[data-campo="contexto"]');
      if (contextoEl) {
        const idx = colunaPorTitulo(tabela, form.getAttribute("data-form-coluna-contexto"));
        if (contextoEl.value.trim() && idx >= 0) {
          const alvo = nova.children[idx]?.querySelector("input");
          if (alvo) alvo.value = contextoEl.value.trim();
        }
      }

      // campos que declaram a coluna que preenchem (estrutura da Receita)
      form.querySelectorAll("[data-campo][data-coluna]").forEach((campo) => {
        const idx = colunaPorTitulo(tabela, campo.getAttribute("data-coluna"));
        if (idx < 0) return;
        const alvo = nova.children[idx]?.querySelector("input");
        if (alvo) alvo.value = campo.value || "—";
      });

      if (selectAtivacao && nova.querySelector(".ativacao-input")) {
        nova.querySelector(".ativacao-input").value = selectAtivacao.value;
        const pct = nova.querySelector(".ativacao-pct");
        if (pct) pct.value = selectAtivacao.value.startsWith("Não ativa") ? 0 : 100;
      }

      Array.from(nova.querySelectorAll("td.month-col input")).forEach((input, i) => {
        input.value = valores[i];
      });
      const totalCell = nova.querySelector(".total-cell");
      if (totalCell) totalCell.textContent = `R$ ${total.toLocaleString("pt-BR")}`;

      tabela.querySelector("tbody").appendChild(nova);
      rebindRow(nova);

      nova.querySelector("td.month-col input")?.dispatchEvent(new Event("change", { bubbles: true }));

      const rotulo = descricao || Array.from(form.querySelectorAll("[data-campo][data-coluna][required]"))
        .map((c) => c.value).filter(Boolean).slice(-2).join(" · ") || "Lançamento";
      showToast(`"${rotulo}" adicionado — R$ ${total.toLocaleString("pt-BR")} mil no ano`, "success");
      form.querySelector("[data-form-limpar]").click();
      renderResumoLancamentos();
    });

    /* Receita: Torre → Empresa → Produto → Sub-produto encadeados, para a
       pessoa não escolher combinação que não existe */
    const selTorre = form.querySelector('[data-campo="torre"]');
    if (selTorre) {
      const selEmpresa = form.querySelector('[data-campo="empresa"]');
      const selProduto = form.querySelector('[data-campo="produto"]');
      const selSub = form.querySelector('[data-campo="subproduto"]');
      const selTipo = form.querySelector('[data-campo="tiporeceita"]');

      const encher = (select, valores, vazio) => {
        select.innerHTML = "";
        if (vazio) select.appendChild(new Option(vazio, ""));
        valores.forEach((v) => select.appendChild(new Option(v, v)));
        select.disabled = valores.length === 0;
      };

      Promise.all([carregarRef("organizacional.json"), carregarRef("produtos.json")])
        .then(([org, cat]) => {
          const torres = Array.from(new Set(org.filter((o) => o.torre !== "-").map((o) => o.torre)));
          encher(selTorre, torres, "Escolha a Torre");
          encher(selEmpresa, [], "Escolha a Torre primeiro");
          encher(selProduto, [], "Escolha a Torre primeiro");
          encher(selSub, ["—"], null);
          encher(selTipo, cat.tiposReceita, "Escolha o tipo");

          selTorre.addEventListener("change", () => {
            const empresas = Array.from(new Set(
              org.filter((o) => o.torre === selTorre.value).map((o) => o.empresa)
            ));
            encher(selEmpresa, empresas, empresas.length ? "Escolha a empresa" : "Sem empresa nesta Torre");

            const produtos = cat.produtos.filter((p) => p.torres.includes(selTorre.value)).map((p) => p.nome);
            encher(selProduto, produtos, produtos.length ? "Escolha o produto" : "Sem produto nesta Torre");
            encher(selSub, ["—"], null);
            atualizar();
          });

          selProduto.addEventListener("change", () => {
            const p = cat.produtos.find((x) => x.nome === selProduto.value);
            const subs = p && p.subProdutos.length ? ["—"].concat(p.subProdutos) : ["—"];
            encher(selSub, subs, null);
            atualizar();
          });
        });
    }

    // cartões de motivo (pacote) e opções de ativação, do mesmo cadastro da planilha
    carregarRef("pacotes.json")
      .then(({ pacotes }) => {
        const caixa = form.querySelector("[data-cartoes-pacote]");
        // Receita não tem cartões de pacote desde ba03567 — ela é classificada
        // por Tipo de Receita. Sem esta saída, o forEach abaixo estourava em
        // caixa.appendChild e derrubava o resto do init do formulário.
        if (!caixa) return;
        pacotesDoTipo(pacotes, tipo).forEach((p) => {
          const cartao = document.createElement("button");
          cartao.type = "button";
          cartao.className = "cartao-pacote";
          cartao.innerHTML = `<strong>${escaparTexto(p.nome)}</strong><span>${escaparTexto(p.motivo)}</span>`;
          cartao.addEventListener("click", () => {
            caixa.querySelectorAll(".cartao-pacote").forEach((c) => c.classList.remove("escolhido"));
            cartao.classList.add("escolhido");
            pacoteEscolhido = p.nome;
          });
          caixa.appendChild(cartao);
        });
      });

    if (selectAtivacao) {
      carregarRef("ativacao.json")
        .then(({ tiposAtivo }) => {
          tiposAtivo.forEach((t) => {
            const opt = document.createElement("option");
            opt.value = t.nome;
            opt.textContent = t.natureza === "Opex" ? "Não — é um gasto do dia a dia" : `Sim — ${t.nome}`;
            selectAtivacao.appendChild(opt);
          });
        });
    }

    atualizar();
  });
}

/* ---------- Sidebar: marca item ativo pela página atual ---------- */

function markActiveNav() {
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    if (item.getAttribute("data-page") === current) {
      item.classList.add("active");
    }
  });
}

/* ==========================================================================
   Auditoria — quem mexeu em cada número, quando e o que mudou
   ==========================================================================
   A trilha vem de Referencias/auditoria.json, derivada de aprovacoes.json:
   mesmas pessoas, mesmas datas, mesmos valores. Duas leituras na mesma tela —
   a lista do ciclo inteiro e a vida de um lançamento só.
*/

/* Classe de cor e símbolo da bolinha da linha do tempo.
   Os símbolos são explícitos porque a inicial do rótulo não serve:
   Editou, Excluiu e Enviou dariam todos "E". */
const AUD_ACOES = {
  criou:    { classe: "aud-criou",    simbolo: "+" },
  editou:   { classe: "aud-editou",   simbolo: "✎" },
  excluiu:  { classe: "aud-excluiu",  simbolo: "−" },
  enviou:   { classe: "aud-enviou",   simbolo: "↑" },
  validou:  { classe: "aud-validou",  simbolo: "⚙" },
  aprovou:  { classe: "aud-aprovou",  simbolo: "✓" },
  reprovou: { classe: "aud-reprovou", simbolo: "✕" },
  devolveu: { classe: "aud-devolveu", simbolo: "↩" },
  aceitou:  { classe: "aud-aceitou",  simbolo: "★" },
};

function audFormatarQuando(iso, comAno = false) {
  if (!iso) return "—";
  const [data, hora] = String(iso).split("T");
  const [a, m, d] = data.split("-");
  return `${d}/${m}${comAno ? "/" + a : ""}${hora ? " " + hora : ""}`;
}

/* Valores das grades são em R$ mil — manter a unidade explícita evita
   alguém ler 180 como cento e oitenta reais numa reunião. */
function audFormatarValor(v) {
  if (v === null || v === undefined) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
}

function audDescreverMudanca(ev) {
  if (ev.acao === "validou") return escaparTexto(ev.observacao || "—");
  if (ev.campo === "valor") {
    const de = audFormatarValor(ev.de);
    const para = audFormatarValor(ev.para);
    let delta = "";
    if (ev.de !== null && ev.de !== undefined && ev.para !== null && ev.para !== undefined && ev.de !== 0) {
      const pct = ((ev.para - ev.de) / Math.abs(ev.de)) * 100;
      const cls = pct >= 0 ? "aud-delta-up" : "aud-delta-down";
      delta = ` <span class="${cls}">${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span>`;
    }
    return `<span class="aud-de">${de}</span> <span class="aud-seta">→</span> <strong>${para}</strong>${delta}`;
  }
  if (ev.campo === "statusOficial") {
    return `<span class="aud-de">${escaparTexto(ev.de)}</span> <span class="aud-seta">→</span> <strong>${escaparTexto(ev.para)}</strong>`;
  }
  if (ev.acao === "aceitou") return "<strong>assumiu a responsabilidade</strong>";
  return "—";
}

function initAuditoria() {
  const corpo = document.querySelector("[data-aud-corpo]");
  const painel = document.querySelector("[data-aud-detalhe]");
  if (!corpo || !painel) return;

  const filtros = { bu: "", torre: "", quem: "", acao: "", categoria: "", de: "", ate: "", busca: "" };
  let dados = null;
  let selecionado = null;

  const rotulo = (acao) => (dados.acoes[acao] || {}).rotulo || acao;

  function visiveis() {
    const busca = filtros.busca.trim().toLowerCase();
    return dados.eventos.filter((ev) => {
      if (filtros.bu && ev.bu !== filtros.bu) return false;
      if (filtros.torre && ev.torre !== filtros.torre) return false;
      if (filtros.quem && ev.quem !== filtros.quem) return false;
      if (filtros.acao && ev.acao !== filtros.acao) return false;
      if (filtros.categoria && ev.categoria !== filtros.categoria) return false;
      if (filtros.de && ev.quando.slice(0, 10) < filtros.de) return false;
      if (filtros.ate && ev.quando.slice(0, 10) > filtros.ate) return false;
      if (busca) {
        const alvo = `${ev.empresa} ${ev.quem} ${ev.papel} ${ev.observacao || ""} ${ev.torre} ${ev.lancamento}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      return true;
    });
  }

  /* KPIs olham o ciclo inteiro, não o filtro: são o retrato do ciclo. */
  function renderKpis() {
    const poe = (chave, valor) => {
      document.querySelectorAll(`[data-aud-kpi="${chave}"]`).forEach((el) => { el.textContent = valor; });
    };
    const evs = dados.eventos;
    const edicoes = evs.filter((e) => e.acao === "editou");
    const pessoas = [...new Set(evs.filter((e) => e.quem !== "Sistema").map((e) => e.quem))];

    poe("total", evs.length);
    poe("lancamentos", new Set(evs.map((e) => e.lancamento)).size);
    poe("edicoes", edicoes.length);
    poe("edicoes-detalhe", `em ${new Set(edicoes.map((e) => e.lancamento)).size} lançamentos`);
    poe("exclusoes", evs.filter((e) => e.acao === "excluiu").length);
    poe("pessoas", pessoas.length);
    poe("pessoas-detalhe", `${evs.filter((e) => e.quem === "Sistema").length} validações automáticas`);
    poe("aceites", evs.filter((e) => e.acao === "aceitou").length);
  }

  function renderTrilha() {
    const lista = visiveis();
    const vazio = document.querySelector("[data-aud-vazio]");
    const resumo = document.querySelector("[data-aud-resumo]");

    if (resumo) {
      const total = dados.eventos.length;
      resumo.textContent = lista.length === total
        ? `${total} registros · ${audFormatarQuando(dados.eventos[0].quando, true)} até ${audFormatarQuando(dados.eventos[total - 1].quando, true)}`
        : `${lista.length} de ${total} registros`;
    }
    if (vazio) vazio.hidden = lista.length > 0;

    /* mais recente primeiro: a pergunta na reunião é sempre "o que mudou agora" */
    corpo.innerHTML = lista.slice().reverse().map((ev) => `
      <tr data-aud-lanc="${escaparTexto(ev.lancamento)}"
          class="${selecionado === ev.lancamento ? "aud-linha-ativa" : ""}">
        <td class="aud-quando">${audFormatarQuando(ev.quando)}</td>
        <td>
          <span class="aud-quem">${escaparTexto(ev.quem)}</span>
          <span class="aud-papel">${escaparTexto(ev.papel)}</span>
        </td>
        <td><span class="badge ${(AUD_ACOES[ev.acao] || {}).classe || ""}">${escaparTexto(rotulo(ev.acao))}</span></td>
        <td>
          <span class="aud-empresa">${escaparTexto(ev.empresa)}</span>
          <span class="aud-onde">${escaparTexto(ev.torre)} · ${escaparTexto(ev.categoria)}</span>
        </td>
        <td class="aud-col-mudou">${audDescreverMudanca(ev)}</td>
      </tr>`).join("");
  }

  function renderDetalhe() {
    const sub = document.querySelector("[data-aud-detalhe-sub]");
    if (!selecionado) {
      painel.innerHTML = '<p class="empty-hint">Nenhum lançamento selecionado.</p>';
      if (sub) sub.textContent = "Clique numa linha da trilha para abrir a vida inteira daquele número.";
      return;
    }

    const hist = dados.eventos.filter((e) => e.lancamento === selecionado);
    if (!hist.length) return;
    const primeiro = hist[0];
    if (sub) sub.textContent = `${primeiro.empresa} · ${primeiro.torre} · ${primeiro.categoria} — ${hist.length} registros`;

    /* último valor conhecido: o que a linha vale depois de todo o vaivém */
    const comValor = hist.filter((e) => e.campo === "valor" && e.para !== null && e.para !== undefined);
    const atual = comValor.length ? comValor[comValor.length - 1].para : null;
    const inicial = comValor.length ? comValor[0].para : null;
    const excluido = hist.some((e) => e.acao === "excluiu");

    const topo = `
      <div class="aud-detalhe-topo">
        <div>
          <span class="aud-detalhe-label">Valor de origem</span>
          <strong>${audFormatarValor(inicial)}</strong>
        </div>
        <span class="aud-seta-grande">→</span>
        <div>
          <span class="aud-detalhe-label">${excluido ? "Situação" : "Valor atual"}</span>
          <strong>${excluido ? "excluído do ciclo" : audFormatarValor(atual)}</strong>
        </div>
        <div class="aud-detalhe-id">${escaparTexto(selecionado)}</div>
      </div>`;

    const linha = hist.map((ev) => {
      const estado = ["aprovou", "aceitou"].includes(ev.acao) ? "done"
                   : ["reprovou", "excluiu"].includes(ev.acao) ? "rejected" : "";
      return `
        <div class="timeline-item ${estado}">
          <div class="timeline-dot ${(AUD_ACOES[ev.acao] || {}).classe || ""}">${(AUD_ACOES[ev.acao] || {}).simbolo || "•"}</div>
          <div class="timeline-content">
            <div class="aud-tl-topo">
              <strong>${escaparTexto(rotulo(ev.acao))}</strong>
              <span class="aud-tl-quando">${audFormatarQuando(ev.quando, true)}</span>
            </div>
            <div class="aud-tl-quem">${escaparTexto(ev.quem)} <span class="aud-papel">${escaparTexto(ev.papel)}</span></div>
            <div class="aud-tl-mudou">${audDescreverMudanca(ev)}</div>
            ${ev.observacao && ev.acao !== "validou"
              ? `<p class="aud-tl-obs">${escaparTexto(ev.observacao)}</p>` : ""}
          </div>
        </div>`;
    }).join("");

    painel.innerHTML = topo + `<div class="timeline">${linha}</div>`;
  }

  function popularFiltros() {
    const preencher = (chave, valores) => {
      const sel = document.querySelector(`[data-aud-filtro="${chave}"]`);
      if (!sel) return;
      valores.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
    };
    const unicos = (campo) => [...new Set(dados.eventos.map((e) => e[campo]))].sort();
    preencher("bu", unicos("bu"));
    preencher("torre", unicos("torre"));
    preencher("quem", unicos("quem"));

    const selAcao = document.querySelector('[data-aud-filtro="acao"]');
    if (selAcao) {
      Object.entries(dados.acoes).forEach(([chave, info]) => {
        const opt = document.createElement("option");
        opt.value = chave;
        opt.textContent = info.rotulo;
        selAcao.appendChild(opt);
      });
    }
  }

  document.querySelectorAll("[data-aud-filtro]").forEach((campo) => {
    campo.addEventListener(campo.tagName === "SELECT" ? "change" : "input", () => {
      filtros[campo.dataset.audFiltro] = campo.value;
      renderTrilha();
    });
  });

  /* Deep link: as grades de Receita, Despesa e Capex mandam para cá já
     filtrado. Roda depois de popularFiltros, senão o <select> ainda não tem
     a opção que se quer selecionar. */
  function aplicarUrl() {
    const p = new URLSearchParams(location.search);
    Object.keys(filtros).forEach((chave) => {
      const valor = p.get(chave);
      if (!valor) return;
      filtros[chave] = valor;
      const campo = document.querySelector(`[data-aud-filtro="${chave}"]`);
      if (campo) campo.value = valor;
    });
    const lanc = p.get("lanc");
    if (lanc && dados.eventos.some((e) => e.lancamento === lanc)) selecionado = lanc;
  }

  /* Exporta o que está filtrado, não a base inteira: o CSV serve para levar
     para a reunião o recorte que a pessoa acabou de montar na tela. */
  function exportarCsv() {
    const lista = visiveis();
    const linhas = [["Quando", "Quem", "Papel", "Acao", "BU", "Torre", "Empresa",
                     "Categoria", "Lancamento", "Campo", "De", "Para", "Observacao"]
                    .map(csvCell).join(";")];
    lista.slice().reverse().forEach((ev) => {
      linhas.push([ev.quando.replace("T", " "), ev.quem, ev.papel, rotulo(ev.acao),
                   ev.bu, ev.torre, ev.empresa, ev.categoria, ev.lancamento,
                   ev.campo || "", ev.de ?? "", ev.para ?? "", ev.observacao || ""]
                  .map(csvCell).join(";"));
    });
    const nome = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadTextFile(nome, linhas.join("\n"), "text/csv;charset=utf-8;");
    showToast(`${lista.length} registro(s) exportado(s): ${nome}`, "success");
  }

  document.querySelectorAll("[data-aud-export]").forEach((btn) => {
    btn.addEventListener("click", exportarCsv);
  });

  /* Delegação no tbody: as linhas são recriadas a cada filtro, então listener
     preso na <tr> sumiria no primeiro render. */
  corpo.addEventListener("click", (ev) => {
    const tr = ev.target.closest("[data-aud-lanc]");
    if (!tr) return;
    selecionado = tr.dataset.audLanc;
    renderTrilha();
    renderDetalhe();
  });

  carregarRef("auditoria.json").then((json) => {
    dados = json;
    dados.eventos.sort((a, b) => a.quando.localeCompare(b.quando));
    popularFiltros();
    aplicarUrl();
    renderKpis();
    renderTrilha();
    renderDetalhe();
  });
}

/* ==========================================================================
   Importar planilha — modelo para baixar, arquivo preenchido para subir
   ==========================================================================
   Item 13 do roadmap. O arquivo é lido no navegador: nada sobe para servidor
   nenhum, porque não existe servidor. A leitura e as validações são de
   verdade; o que é simulado é só o passo de gravar.

   Formato CSV e não .xlsx de propósito: o protótipo não usa biblioteca
   externa, e ler .xlsx exigiria implementar leitor de ZIP e parser de XML
   à mão. O Excel abre e salva CSV nativamente.
*/

/* ==========================================================================
   .xlsx à mão — sem biblioteca, como manda a arquitetura do projeto
   ==========================================================================
   Um .xlsx é um ZIP de arquivos XML. Para LER basta achar duas peças dentro
   do ZIP (a planilha e a tabela de textos) e descompactar; o navegador já traz
   DecompressionStream e DOMParser. Para ESCREVER, monta-se o ZIP com os
   arquivos "stored" (sem compressão) — assim não é preciso um compressor,
   só o CRC32 de cada peça. O Excel abre normalmente.
*/

/* ---------- ZIP: leitura ---------- */

function zipEntradas(buffer) {
  const dv = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  // O fim do diretório central fica no rodapé; o comentário final tem tamanho
  // variável, então varre-se de trás para frente atrás da assinatura.
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0 && i > u8.length - 65558; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Arquivo .xlsx inválido: não achei o índice do ZIP.");

  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entradas = [];

  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo    = dv.getUint16(p + 10, true);
    const compSize  = dv.getUint32(p + 20, true);
    const nomeLen   = dv.getUint16(p + 28, true);
    const extraLen  = dv.getUint16(p + 30, true);
    const comentLen = dv.getUint16(p + 32, true);
    const localOff  = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nomeLen));

    // O extra do cabeçalho local costuma ter tamanho diferente do que está no
    // diretório central — precisa ser lido de lá, senão o offset sai torto.
    const lNomeLen  = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const inicio = localOff + 30 + lNomeLen + lExtraLen;

    entradas.push({ nome, metodo, dados: u8.subarray(inicio, inicio + compSize) });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return entradas;
}

async function zipTexto(entrada) {
  if (!entrada) return "";
  if (entrada.metodo === 0) return new TextDecoder().decode(entrada.dados);
  if (entrada.metodo !== 8) throw new Error("Compressão do .xlsx não suportada.");
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Este navegador não sabe descompactar .xlsx. Use o modelo em CSV.");
  }
  const fluxo = new Blob([entrada.dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(fluxo).text();
}

/* ---------- ZIP: escrita (tudo "stored", sem compressão) ---------- */

const ZIP_CRC_TABELA = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function zipCrc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = ZIP_CRC_TABELA[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const ZIP_MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ZIP_MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function zipMontar(arquivos, mime = ZIP_MIME_XLSX) {
  const cod = new TextEncoder();
  const partes = [], central = [];
  let offset = 0;

  const escreve = (n, bytes) => {
    const b = new Uint8Array(n);
    const dv = new DataView(b.buffer);
    if (n === 2) dv.setUint16(0, bytes, true); else dv.setUint32(0, bytes, true);
    return b;
  };

  arquivos.forEach(({ nome, texto }) => {
    const dados = cod.encode(texto);
    const nomeB = cod.encode(nome);
    const crc = zipCrc32(dados);

    const local = [
      escreve(4, 0x04034b50), escreve(2, 20), escreve(2, 0), escreve(2, 0),
      escreve(2, 0), escreve(2, 0),                    // hora e data zeradas
      escreve(4, crc), escreve(4, dados.length), escreve(4, dados.length),
      escreve(2, nomeB.length), escreve(2, 0), nomeB, dados,
    ];
    const tamLocal = local.reduce((s, x) => s + x.length, 0);
    partes.push(...local);

    central.push(
      escreve(4, 0x02014b50), escreve(2, 20), escreve(2, 20), escreve(2, 0),
      escreve(2, 0), escreve(2, 0), escreve(2, 0),
      escreve(4, crc), escreve(4, dados.length), escreve(4, dados.length),
      escreve(2, nomeB.length), escreve(2, 0), escreve(2, 0), escreve(2, 0),
      escreve(2, 0), escreve(4, 0), escreve(4, offset), nomeB,
    );
    offset += tamLocal;
  });

  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fim = [
    escreve(4, 0x06054b50), escreve(2, 0), escreve(2, 0),
    escreve(2, arquivos.length), escreve(2, arquivos.length),
    escreve(4, tamCentral), escreve(4, offset), escreve(2, 0),
  ];
  return new Blob([...partes, ...central, ...fim], { type: mime });
}

/* ---------- XML: escape compartilhado pela planilha e pela apresentação ---------- */

function xmlEscapar(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* "AB" -> 27. Célula vazia é omitida do XML, então a referência é o único
   jeito de saber em qual coluna o valor cai. */
function xlsxColunaDeRef(ref) {
  const letras = String(ref).match(/^[A-Z]+/i);
  if (!letras) return 0;
  let n = 0;
  for (const ch of letras[0].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function xlsxLetraDeColuna(i) {
  let s = "", n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/* Lê a primeira planilha e devolve linhas de texto, no mesmo formato do CSV. */
async function xlsxLer(buffer) {
  const entradas = zipEntradas(buffer);
  const acha = (nome) => entradas.find((e) => e.nome === nome);

  const compartilhados = [];
  const ssXml = await zipTexto(acha("xl/sharedStrings.xml"));
  if (ssXml) {
    const doc = new DOMParser().parseFromString(ssXml, "application/xml");
    doc.querySelectorAll("si").forEach((si) => {
      // <si> pode ter vários <t> quando o texto tem formatação no meio
      compartilhados.push([...si.querySelectorAll("t")].map((t) => t.textContent).join(""));
    });
  }

  const planilha = entradas.find((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.nome));
  if (!planilha) throw new Error("Arquivo .xlsx sem planilha legível.");
  const doc = new DOMParser().parseFromString(await zipTexto(planilha), "application/xml");

  const linhas = [];
  doc.querySelectorAll("sheetData > row").forEach((row) => {
    const celulas = [];
    row.querySelectorAll("c").forEach((c) => {
      const tipo = c.getAttribute("t");
      let valor = "";
      if (tipo === "s") {
        const i = Number(c.querySelector("v")?.textContent);
        valor = compartilhados[i] ?? "";
      } else if (tipo === "inlineStr") {
        valor = [...c.querySelectorAll("is t")].map((t) => t.textContent).join("");
      } else {
        valor = c.querySelector("v")?.textContent ?? "";
      }
      celulas[xlsxColunaDeRef(c.getAttribute("r") || "")] = valor;
    });
    for (let i = 0; i < celulas.length; i++) if (celulas[i] === undefined) celulas[i] = "";
    linhas.push(celulas);
  });
  return linhas.filter((l) => l.some((c) => String(c).trim() !== ""));
}

/* Gera um .xlsx mínimo: uma aba, texto em linha (dispensa sharedStrings). */
function xlsxGerar(matriz, nomeAba = "Modelo") {
  const linhas = matriz.map((linha, r) => {
    const celulas = linha.map((valor, c) => {
      const ref = `${xlsxLetraDeColuna(c)}${r + 1}`;
      const txt = String(valor ?? "");
      const ehNumero = txt !== "" && /^-?\d+(\.\d+)?$/.test(txt);
      return ehNumero
        ? `<c r="${ref}"><v>${txt}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscapar(txt)}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${celulas}</row>`;
  }).join("");

  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const rns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  return zipMontar([
    { nome: "[Content_Types].xml", texto:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { nome: "_rels/.rels", texto:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rns}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nome: "xl/workbook.xml", texto:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}" xmlns:r="${rns}"><sheets><sheet name="${xmlEscapar(nomeAba)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { nome: "xl/_rels/workbook.xml.rels", texto:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rns}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { nome: "xl/worksheets/sheet1.xml", texto:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}"><sheetData>${linhas}</sheetData></worksheet>` },
  ]);
}

/* ==========================================================================
   PowerPoint sem biblioteca — o mesmo truque do .xlsx acima
   ==========================================================================
   Um .pptx também é um ZIP de XML, e o ZIP já está escrito ali em cima. O que
   a apresentação exige a mais é uma corrente mínima de peças, senão o
   PowerPoint abre pedindo reparo: apresentação → slide master → layout → tema.
   Nada disso aparece na tela; é só o andaime que o formato pede.

   Não existe gráfico nativo aqui. As barras da ponte são retângulos
   posicionados, do mesmo jeito que a tela desenha com <div> — o slide sai
   igual ao painel porque é desenhado a partir dos mesmos números.

   Medida do OOXML é EMU (English Metric Unit). Ninguém pensa um slide em EMU,
   então as funções recebem centímetros e convertem aqui dentro.
*/

const PPT_LARGURA_CM = 33.87;   // 16:9 widescreen
const PPT_ALTURA_CM = 19.05;
const PPT_CM = 360000;          // 1 cm em EMU

function pptCm(v) { return Math.round(v * PPT_CM); }
function pptTam(v) { return Math.max(1, Math.round(v * PPT_CM)); }

/* Caixa de texto. `texto` aceita string ou lista — cada item vira parágrafo e
   pode ter tamanho/cor próprios, que é o que faz um cartão de KPI (rótulo
   pequeno em cima, número grande embaixo) caber numa forma só. */
function pptTexto(id, o) {
  const paragrafos = (Array.isArray(o.texto) ? o.texto : [o.texto]).map((linha) => {
    const t = typeof linha === "object" ? linha : { texto: linha };
    const espaco = t.espacoAntes ? `<a:spcBef><a:spcPts val="${Math.round(t.espacoAntes * 100)}"/></a:spcBef>` : "";
    const rpr = `<a:rPr lang="pt-BR" sz="${Math.round((t.tam ?? o.tam ?? 12) * 100)}" b="${(t.negrito ?? o.negrito) ? 1 : 0}" dirty="0">` +
      `<a:solidFill><a:srgbClr val="${t.cor ?? o.cor ?? "1B2436"}"/></a:solidFill>` +
      `<a:latin typeface="Segoe UI"/><a:cs typeface="Segoe UI"/></a:rPr>`;
    return `<a:p><a:pPr algn="${t.alinha || o.alinha || "l"}">${espaco}</a:pPr>` +
      `<a:r>${rpr}<a:t>${xmlEscapar(t.texto)}</a:t></a:r></a:p>`;
  }).join("");

  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Texto ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${pptCm(o.x)}" y="${pptCm(o.y)}"/><a:ext cx="${pptTam(o.l)}" cy="${pptTam(o.a)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${o.ancora || "t"}">` +
    `<a:noAutofit/></a:bodyPr><a:lstStyle/>${paragrafos}</p:txBody></p:sp>`;
}

function pptRetangulo(id, o) {
  const geom = o.raio
    ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${o.raio}"/></a:avLst></a:prstGeom>`
    : `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`;
  const preenche = o.cor ? `<a:solidFill><a:srgbClr val="${o.cor}"/></a:solidFill>` : "<a:noFill/>";
  const borda = o.borda
    ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${o.borda}"/></a:solidFill></a:ln>`
    : "<a:ln><a:noFill/></a:ln>";

  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Forma ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${pptCm(o.x)}" y="${pptCm(o.y)}"/><a:ext cx="${pptTam(o.l)}" cy="${pptTam(o.a)}"/></a:xfrm>` +
    `${geom}${preenche}${borda}</p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="pt-BR"/></a:p></p:txBody></p:sp>`;
}

/* Tabela de verdade (a:tbl), não texto alinhado com espaço: quem recebe o
   arquivo consegue editar célula por célula. Sem tableStyleId de propósito —
   o id apontaria para uma peça de estilos que este pacote não traz, e aí o
   PowerPoint desenharia a tabela sem borda nenhuma. Cor vai célula a célula. */
function pptTabela(id, o) {
  const tam = o.tamFonte || 10;
  const alturaLinha = pptCm(o.alturaLinha || 0.72);
  const larguras = o.colunas.map((c) => pptCm(c.largura));

  const celula = (texto, e) =>
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${e.alinha}"/>` +
    `<a:r><a:rPr lang="pt-BR" sz="${Math.round(e.tam * 100)}" b="${e.negrito ? 1 : 0}" dirty="0">` +
    `<a:solidFill><a:srgbClr val="${e.cor}"/></a:solidFill><a:latin typeface="Segoe UI"/></a:rPr>` +
    `<a:t>${xmlEscapar(texto)}</a:t></a:r></a:p></a:txBody>` +
    `<a:tcPr marL="91440" marR="91440" marT="45720" marB="45720" anchor="ctr">` +
    `<a:lnB w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="E3E7EE"/></a:solidFill>` +
    "<a:prstDash val=\"solid\"/></a:lnB>" +
    `<a:solidFill><a:srgbClr val="${e.fundo}"/></a:solidFill></a:tcPr></a:tc>`;

  const cabecalho = `<a:tr h="${alturaLinha}">` + o.colunas.map((c) =>
    celula(c.titulo, { alinha: c.alinha || "l", negrito: true, cor: "FFFFFF", fundo: "12213F", tam })
  ).join("") + "</a:tr>";

  const corpo = o.linhas.map((linha) => `<a:tr h="${alturaLinha}">` + linha.map((cel, i) => {
    const c = typeof cel === "object" ? cel : { texto: cel };
    return celula(c.texto, {
      alinha: c.alinha || o.colunas[i].alinha || "l",
      negrito: !!c.negrito,
      cor: c.cor || "1B2436",
      fundo: c.fundo || "FFFFFF",
      tam: c.tam || tam,
    });
  }).join("") + "</a:tr>").join("");

  const largura = larguras.reduce((s, w) => s + w, 0);
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Tabela ${id}"/>` +
    '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>' +
    `<p:xfrm><a:off x="${pptCm(o.x)}" y="${pptCm(o.y)}"/>` +
    `<a:ext cx="${largura}" cy="${alturaLinha * (o.linhas.length + 1)}"/></p:xfrm>` +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">' +
    `<a:tbl><a:tblPr firstRow="1" bandRow="0"/><a:tblGrid>${larguras.map((w) => `<a:gridCol w="${w}"/>`).join("")}</a:tblGrid>` +
    `${cabecalho}${corpo}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

/* Um slide em construção. O id da forma só precisa ser único dentro do slide,
   então o contador reinicia a cada desenho novo. */
function pptDesenho() {
  const formas = [];
  let id = 1;
  return {
    formas,
    texto: (o) => formas.push(pptTexto(++id, o)),
    retangulo: (o) => formas.push(pptRetangulo(++id, o)),
    tabela: (o) => formas.push(pptTabela(++id, o)),
  };
}

const PPT_NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PPT_NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const PPT_NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PPT_NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types";
const PPT_NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const PPT_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/* O grupo raiz que todo spTree precisa ter antes das formas. */
const PPT_GRUPO_RAIZ =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
  '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

/* Tema mínimo porém completo: o esquema de cores precisa das 12 entradas na
   ordem certa, e o fmtScheme de três estilos em cada lista. Faltando qualquer
   uma delas o PowerPoint recusa o arquivo. As cores são as do style.css. */
function pptTema() {
  const solido = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const linha = (w) => `<a:ln w="${w}"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>`;
  const fonte = (tag) => `<a:${tag}><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:${tag}>`;

  return PPT_XML + `<a:theme xmlns:a="${PPT_NS_A}" name="NS Codex">` +
    "<a:themeElements>" +
    '<a:clrScheme name="NS Codex">' +
      '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
      '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
      '<a:dk2><a:srgbClr val="12213F"/></a:dk2><a:lt2><a:srgbClr val="F4F6F9"/></a:lt2>' +
      '<a:accent1><a:srgbClr val="1F4FD6"/></a:accent1><a:accent2><a:srgbClr val="1A9C6A"/></a:accent2>' +
      '<a:accent3><a:srgbClr val="D64545"/></a:accent3><a:accent4><a:srgbClr val="7A4FD6"/></a:accent4>' +
      '<a:accent5><a:srgbClr val="B8860B"/></a:accent5><a:accent6><a:srgbClr val="6B7280"/></a:accent6>' +
      '<a:hlink><a:srgbClr val="1F4FD6"/></a:hlink><a:folHlink><a:srgbClr val="7A4FD6"/></a:folHlink>' +
    "</a:clrScheme>" +
    `<a:fontScheme name="NS Codex">${fonte("majorFont")}${fonte("minorFont")}</a:fontScheme>` +
    '<a:fmtScheme name="NS Codex">' +
      `<a:fillStyleLst>${solido}${solido}${solido}</a:fillStyleLst>` +
      `<a:lnStyleLst>${linha(6350)}${linha(12700)}${linha(19050)}</a:lnStyleLst>` +
      "<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle>" +
      "<a:effectStyle><a:effectLst/></a:effectStyle>" +
      "<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>" +
      `<a:bgFillStyleLst>${solido}${solido}${solido}</a:bgFillStyleLst>` +
    "</a:fmtScheme>" +
    "</a:themeElements></a:theme>";
}

/* Monta o .pptx. `slides` é uma lista de listas de formas — o resultado de
   pptDesenho().formas, um por slide. */
function pptxGerar(slides) {
  const rel = (id, tipo, alvo) => `<Relationship Id="${id}" Type="${PPT_NS_R}/${tipo}" Target="${alvo}"/>`;
  const rels = (conteudo) => `${PPT_XML}<Relationships xmlns="${PPT_NS_REL}">${conteudo}</Relationships>`;
  const arquivos = [];

  arquivos.push({ nome: "[Content_Types].xml", texto:
    PPT_XML + `<Types xmlns="${PPT_NS_CT}">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("") +
    "</Types>" });

  arquivos.push({ nome: "_rels/.rels", texto: rels(rel("rId1", "officeDocument", "ppt/presentation.xml")) });

  // rId1 é o master; os slides começam em rId2 e seguem a ordem do sldIdLst
  arquivos.push({ nome: "ppt/presentation.xml", texto:
    PPT_XML + `<p:presentation xmlns:a="${PPT_NS_A}" xmlns:r="${PPT_NS_R}" xmlns:p="${PPT_NS_P}">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    "<p:sldIdLst>" + slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("") + "</p:sldIdLst>" +
    `<p:sldSz cx="${pptCm(PPT_LARGURA_CM)}" cy="${pptCm(PPT_ALTURA_CM)}"/>` +
    '<p:notesSz cx="6858000" cy="9144000"/></p:presentation>' });

  arquivos.push({ nome: "ppt/_rels/presentation.xml.rels", texto: rels(
    rel("rId1", "slideMaster", "slideMasters/slideMaster1.xml") +
    slides.map((_, i) => rel(`rId${i + 2}`, "slide", `slides/slide${i + 1}.xml`)).join("")) });

  arquivos.push({ nome: "ppt/slideMasters/slideMaster1.xml", texto:
    PPT_XML + `<p:sldMaster xmlns:a="${PPT_NS_A}" xmlns:r="${PPT_NS_R}" xmlns:p="${PPT_NS_P}">` +
    '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
    `<p:spTree>${PPT_GRUPO_RAIZ}</p:spTree></p:cSld>` +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" ' +
    'accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>' });

  arquivos.push({ nome: "ppt/slideMasters/_rels/slideMaster1.xml.rels", texto: rels(
    rel("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml") +
    rel("rId2", "theme", "../theme/theme1.xml")) });

  arquivos.push({ nome: "ppt/slideLayouts/slideLayout1.xml", texto:
    PPT_XML + `<p:sldLayout xmlns:a="${PPT_NS_A}" xmlns:r="${PPT_NS_R}" xmlns:p="${PPT_NS_P}" type="blank" preserve="1">` +
    `<p:cSld name="Em branco"><p:spTree>${PPT_GRUPO_RAIZ}</p:spTree></p:cSld>` +
    "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>" });

  arquivos.push({ nome: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", texto: rels(
    rel("rId1", "slideMaster", "../slideMasters/slideMaster1.xml")) });

  arquivos.push({ nome: "ppt/theme/theme1.xml", texto: pptTema() });

  slides.forEach((formas, i) => {
    arquivos.push({ nome: `ppt/slides/slide${i + 1}.xml`, texto:
      PPT_XML + `<p:sld xmlns:a="${PPT_NS_A}" xmlns:r="${PPT_NS_R}" xmlns:p="${PPT_NS_P}">` +
      `<p:cSld><p:spTree>${PPT_GRUPO_RAIZ}${formas.join("")}</p:spTree></p:cSld>` +
      "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>" });
    arquivos.push({ nome: `ppt/slides/_rels/slide${i + 1}.xml.rels`, texto: rels(
      rel("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml")) });
  });

  return zipMontar(arquivos, ZIP_MIME_PPTX);
}

const IMP_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
                   "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/* Não se pede o que dá para deduzir: Linha do P&L e Categoria saem da Conta,
   então não viram coluna do modelo. */
const IMP_SPEC = {
  receita: {
    rotulo: "Receita",
    colunas: [
      { nome: "Torre",        obrigatoria: true,  aceita: "torre" },
      { nome: "Empresa",      obrigatoria: true,  aceita: "empresa" },
      { nome: "Produto",      obrigatoria: true,  aceita: "produto" },
      { nome: "Sub-produto",  obrigatoria: false, aceita: "subproduto" },
      { nome: "Tipo Receita", obrigatoria: true,  aceita: "tipoReceita" },
    ],
    chave: ["Torre", "Empresa", "Produto", "Sub-produto", "Tipo Receita"],
  },
  despesa: {
    rotulo: "Despesa",
    colunas: [
      { nome: "Conta",           obrigatoria: true,  aceita: "conta" },
      { nome: "Empresa",         obrigatoria: true,  aceita: "empresa" },
      { nome: "Centro de Custo", obrigatoria: true,  aceita: "texto" },
      { nome: "Pacote",          obrigatoria: true,  aceita: "pacote" },
      { nome: "Ativação",        obrigatoria: false, aceita: "texto" },
      { nome: "% Ativação",      obrigatoria: false, aceita: "percentual" },
      { nome: "Fornecedor",      obrigatoria: false, aceita: "texto" },
      { nome: "Obs",             obrigatoria: false, aceita: "texto" },
    ],
    chave: ["Conta", "Empresa", "Centro de Custo"],
  },
  capex: {
    rotulo: "Capex",
    colunas: [
      { nome: "Conta",           obrigatoria: true,  aceita: "conta" },
      { nome: "Empresa",         obrigatoria: true,  aceita: "empresa" },
      { nome: "Centro de Custo", obrigatoria: true,  aceita: "texto" },
      { nome: "Pacote",          obrigatoria: true,  aceita: "pacote" },
      { nome: "Projeto",         obrigatoria: true,  aceita: "texto" },
      { nome: "Justificativa",   obrigatoria: false, aceita: "texto" },
    ],
    chave: ["Conta", "Empresa", "Centro de Custo", "Projeto"],
  },
};

/* Leitor de CSV que aguenta campo entre aspas com ; e " dentro, BOM e CRLF.
   Split simples por ";" quebraria em "Obs" com ponto e vírgula no meio. */
function impLerCsv(texto) {
  const t = texto.replace(/^﻿/, "");
  const linhas = [];
  let campo = "", linha = [], aspas = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; }
        else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { aspas = true; continue; }
    if (c === ";") { linha.push(campo); campo = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); campo = ""; linha = [];
      continue;
    }
    campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => String(c).trim() !== ""));
}

/* Aceita "1.234,50" e "1234.50": quem preenche no Excel pt-BR manda o
   primeiro, quem exporta de sistema manda o segundo. */
function impNumero(valor) {
  const s = String(valor ?? "").trim();
  if (!s) return null;
  const limpo = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

function initImportacao() {
  const areaTipos = document.querySelector("[data-imp-tipo]");
  const inputArquivo = document.querySelector("[data-imp-arquivo]");
  if (!areaTipos || !inputArquivo) return;

  let tipo = "receita";
  let ref = null;              // dados de cadastro
  let analise = null;          // resultado da última conferência
  let filtro = "problema";

  /* ---------- cadastro ---------- */

  function empresas()  { return [...new Set(ref.org.map((o) => o.empresa))].sort(); }
  function torres()    { return [...new Set(ref.org.map((o) => o.torre))].filter((t) => t !== "-").sort(); }
  function pacotesDo(t){ return ref.pacotes.pacotes.filter((p) => p.aplicaA.includes(t)); }

  function descreveAceita(col) {
    switch (col.aceita) {
      case "empresa":     return `uma das ${empresas().length} empresas do cadastro`;
      case "torre":       return `uma das ${torres().length} torres`;
      case "produto":     return `produto do catálogo, compatível com a Torre (${ref.produtos.produtos.length} disponíveis)`;
      case "subproduto":  return "sub-produto do produto escolhido — deixe vazio se ele não tem divisão";
      case "tipoReceita": return ref.produtos.tiposReceita.join(" · ");
      case "conta":       return `código do plano de contas de ${IMP_SPEC[tipo].rotulo} ` +
                                 `(${contasDaCategoria(ref.contas, tipo).length} disponíveis)`;
      case "pacote":      return pacotesDo(tipo).map((p) => p.nome).join(" · ");
      case "percentual":  return "número de 0 a 100";
      default:            return "texto livre";
    }
  }

  /* ---------- modelo para baixar ---------- */

  function linhasExemplo() {
    const spec = IMP_SPEC[tipo];
    const org = ref.org.filter((o) => o.torre !== "-");
    const pac = pacotesDo(tipo)[0];
    const exemplos = [];

    for (let i = 0; i < 2; i++) {
      const o = org[i % org.length];
      const linha = {};
      if (tipo === "receita") {
        const prod = ref.produtos.produtos.find((p) => p.torres.includes(o.torre)) || ref.produtos.produtos[0];
        Object.assign(linha, {
          "Torre": o.torre, "Empresa": o.empresa, "Produto": prod.nome,
          "Sub-produto": prod.subProdutos[0] || "",
          "Tipo Receita": ref.produtos.tiposReceita[i % ref.produtos.tiposReceita.length],
        });
      } else {
        // o exemplo do modelo tem de passar na conferência da própria tela:
        // conta de Capex num modelo de Despesa voltaria como erro
        const pool = contasDaCategoria(ref.contas, tipo);
        const c = pool[i * 3 % pool.length];
        Object.assign(linha, {
          "Conta": c.conta, "Empresa": o.empresa,
          "Centro de Custo": o.torre, "Pacote": pac ? pac.nome : "",
        });
        if (tipo === "despesa") {
          Object.assign(linha, { "Ativação": "Não ativa — Opex", "% Ativação": "0",
                                 "Fornecedor": "", "Obs": "" });
        } else {
          Object.assign(linha, { "Projeto": `Projeto exemplo ${i + 1}`, "Justificativa": "" });
        }
      }
      IMP_MESES.forEach((m, j) => { linha[m] = String(100 + i * 50 + j * 5); });
      exemplos.push(linha);
    }
    return exemplos;
  }

  function baixarModelo(formato) {
    const spec = IMP_SPEC[tipo];
    const cabecalho = [...spec.colunas.map((c) => c.nome), ...IMP_MESES];
    const matriz = [cabecalho, ...linhasExemplo().map((ex) => cabecalho.map((c) => ex[c] ?? ""))];
    const base = `modelo-${tipo}-${new Date().toISOString().slice(0, 10)}`;

    if (formato === "csv") {
      const texto = matriz.map((l) => l.map(csvCell).join(";")).join("\r\n");
      downloadTextFile(`${base}.csv`, texto, "text/csv;charset=utf-8;");
    } else {
      downloadBlobFile(`${base}.xlsx`, xlsxGerar(matriz, spec.rotulo));
    }
    showToast(`Modelo de ${spec.rotulo} baixado: ${base}.${formato}`, "success");
  }

  /* ---------- conferência ---------- */

  /* Recebe a grade já lida — .csv e .xlsx chegam aqui no mesmo formato,
     então a validação é uma só e não pode divergir entre os dois. */
  function conferir(grade) {
    const spec = IMP_SPEC[tipo];
    if (!grade.length) return { fatal: "O arquivo está vazio." };

    const cabecalho = grade[0].map((c) => c.trim());
    const esperadas = [...spec.colunas.map((c) => c.nome), ...IMP_MESES];
    const faltando = esperadas.filter((e) => !cabecalho.includes(e));
    if (faltando.length) {
      return { fatal: `O arquivo não parece ser o modelo de ${spec.rotulo}. Faltam as colunas: ${faltando.join(", ")}.` };
    }

    const col = (linha, nome) => (linha[cabecalho.indexOf(nome)] ?? "").trim();
    const setEmpresas = new Set(empresas());
    const setTorres   = new Set(torres());
    const setTipos    = new Set(ref.produtos.tiposReceita);
    const setPacotes  = new Set(pacotesDo(tipo).map((p) => p.nome));
    const contaPorCodigo = new Map(ref.contas.map((c) => [String(c.conta).trim(), c]));
    const produtoPorNome = new Map(ref.produtos.produtos.map((p) => [p.nome, p]));

    const vistas = new Map();
    const linhas = [];

    grade.slice(1).forEach((bruta, i) => {
      const erros = [], alertas = [];
      const valor = (n) => col(bruta, n);

      spec.colunas.forEach((c) => {
        if (c.obrigatoria && !valor(c.nome)) erros.push(`${c.nome} está vazio`);
      });

      if (valor("Empresa") && !setEmpresas.has(valor("Empresa"))) {
        erros.push(`Empresa "${valor("Empresa")}" não existe no cadastro`);
      }

      if (tipo === "receita") {
        if (valor("Torre") && !setTorres.has(valor("Torre"))) {
          erros.push(`Torre "${valor("Torre")}" não existe`);
        }
        const prod = produtoPorNome.get(valor("Produto"));
        if (valor("Produto") && !prod) {
          erros.push(`Produto "${valor("Produto")}" não está no catálogo`);
        } else if (prod && valor("Torre") && !prod.torres.includes(valor("Torre"))) {
          erros.push(`Produto "${prod.nome}" não pertence à ${valor("Torre")}`);
        }
        if (prod) {
          const sub = valor("Sub-produto");
          if (sub && !prod.subProdutos.includes(sub)) {
            erros.push(`Sub-produto "${sub}" não é de "${prod.nome}"`);
          } else if (!sub && prod.subProdutos.length) {
            alertas.push(`"${prod.nome}" tem sub-produto e o campo ficou vazio`);
          }
        }
        if (valor("Tipo Receita") && !setTipos.has(valor("Tipo Receita"))) {
          erros.push(`Tipo Receita "${valor("Tipo Receita")}" não é um dos quatro aceitos`);
        }
      } else {
        const c = contaPorCodigo.get(valor("Conta"));
        if (valor("Conta") && !c) {
          erros.push(`Conta "${valor("Conta")}" não existe no plano de contas`);
        } else if (c && !c.linhaPL) {
          erros.push(`Conta ${c.conta} não tem linha de P&L — não entra no consolidado`);  // regra PL
        } else if (c && categoriaDaConta(c) !== tipo) {
          // planilha de Despesa com conta de Capex passava batido e a linha
          // entrava no consolidado na categoria errada
          erros.push(`Conta ${c.conta} é de ${CONTA_ROTULO[categoriaDaConta(c)]} — ` +
            `esta planilha é de ${spec.rotulo}`);
        }
        if (valor("Pacote") && !setPacotes.has(valor("Pacote"))) {
          erros.push(`Pacote "${valor("Pacote")}" não se aplica a ${spec.rotulo}`);        // regra PAC
        }
        if (tipo === "despesa" && valor("% Ativação")) {
          const p = impNumero(valor("% Ativação"));
          if (Number.isNaN(p) || p < 0 || p > 100) erros.push("% Ativação precisa ser um número de 0 a 100");
        }
      }

      // meses
      let zerados = 0, somaLinha = 0;
      IMP_MESES.forEach((m) => {
        const n = impNumero(valor(m));
        if (n === null) { zerados++; return; }
        if (Number.isNaN(n)) { erros.push(`${m} não é um número ("${valor(m)}")`); return; }
        if (n === 0) zerados++;
        somaLinha += n;
      });
      if (zerados === 12) erros.push("Os 12 meses estão vazios ou zerados");
      else if (zerados) alertas.push(`${zerados} mês(es) sem valor — costuma ser esquecimento`);  // regra MES

      // duplicidade dentro do próprio arquivo — regra DUP
      const chave = spec.chave.map((k) => valor(k)).join(" | ");
      if (vistas.has(chave)) erros.push(`Repete a linha ${vistas.get(chave)} (mesma ${spec.chave.join(" + ")})`);
      else vistas.set(chave, i + 2);

      linhas.push({
        numero: i + 2,           // +2: cabeçalho é a linha 1 do arquivo
        resumo: spec.chave.map((k) => valor(k)).filter(Boolean).join(" · "),
        total: somaLinha,
        erros, alertas,
        situacao: erros.length ? "erro" : alertas.length ? "alerta" : "ok",
      });
    });

    return { linhas };
  }

  /* ---------- tela ---------- */

  function renderColunas() {
    const corpo = document.querySelector("[data-imp-colunas]");
    const spec = IMP_SPEC[tipo];
    corpo.innerHTML = spec.colunas.map((c) => `
      <tr>
        <td><strong>${escaparTexto(c.nome)}</strong></td>
        <td>${c.obrigatoria ? '<span class="badge status-reprovado">Sim</span>'
                            : '<span class="badge status-rascunho">Opcional</span>'}</td>
        <td class="imp-aceita">${escaparTexto(descreveAceita(c))}</td>
      </tr>`).join("") + `
      <tr>
        <td><strong>Jan … Dez</strong></td>
        <td><span class="badge status-reprovado">Sim</span></td>
        <td class="imp-aceita">um número por mês, em R$ mil — aceita 1.234,50 ou 1234.50</td>
      </tr>`;
    document.querySelectorAll("[data-imp-rotulo]").forEach((el) => { el.textContent = spec.rotulo; });
    const p2 = document.querySelector("[data-imp-passo2]");
    if (p2) p2.textContent = `${spec.colunas.length + 12} colunas: ${spec.colunas.length} de contexto e os 12 meses`;
  }

  function renderResultado() {
    const painel = document.querySelector("[data-imp-resultado]");
    const corpo = document.querySelector("[data-imp-linhas]");
    const vazio = document.querySelector("[data-imp-vazio]");
    if (!analise || analise.fatal) { painel.hidden = true; return; }
    painel.hidden = false;

    const todas = analise.linhas;
    const conta = (s) => todas.filter((l) => l.situacao === s).length;
    const poe = (k, v) => document.querySelectorAll(`[data-imp-kpi="${k}"]`)
                                  .forEach((el) => { el.textContent = v; });
    poe("lidas", todas.length);
    poe("ok", conta("ok"));
    poe("erros", conta("erro"));
    poe("alertas", conta("alerta"));

    const resumo = document.querySelector("[data-imp-resumo]");
    if (resumo) {
      resumo.textContent = conta("erro")
        ? `${conta("erro")} linha(s) travada(s) — corrija no Excel e suba de novo`
        : `Tudo certo: ${todas.length} linha(s) prontas para entrar`;
    }
    const btn = document.querySelector("[data-imp-confirmar]");
    if (btn) btn.disabled = conta("ok") + conta("alerta") === 0;

    const lista = todas.filter((l) => {
      if (filtro === "") return true;
      if (filtro === "problema") return l.situacao !== "ok";
      return l.situacao === filtro;
    });
    if (vazio) vazio.hidden = lista.length > 0;

    const selo = { ok: ["status-aprovado", "Pronta"], alerta: ["status-em-aprovacao", "Alerta"],
                   erro: ["status-reprovado", "Travada"] };
    corpo.innerHTML = lista.map((l) => `
      <tr class="imp-linha-${l.situacao}">
        <td class="imp-num">${l.numero}</td>
        <td><span class="badge ${selo[l.situacao][0]}">${selo[l.situacao][1]}</span></td>
        <td>
          <span class="imp-resumo">${escaparTexto(l.resumo || "(linha sem identificação)")}</span>
          <span class="imp-total">total ${l.total.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil</span>
        </td>
        <td class="imp-motivos">
          ${l.erros.map((e) => `<span class="imp-erro">${escaparTexto(e)}</span>`).join("")}
          ${l.alertas.map((a) => `<span class="imp-alerta">${escaparTexto(a)}</span>`).join("")}
          ${!l.erros.length && !l.alertas.length ? "—" : ""}
        </td>
      </tr>`).join("");
  }

  function processar(arquivo) {
    const nome = document.querySelector("[data-imp-nome]");
    const ehXlsx = /\.xlsx$/i.test(arquivo.name);
    const leitor = new FileReader();
    leitor.onload = async () => {
      try {
        const grade = ehXlsx ? await xlsxLer(leitor.result) : impLerCsv(String(leitor.result));
        analise = conferir(grade);
      } catch (erro) {
        analise = { fatal: erro.message || "Não consegui ler esse arquivo." };
      }
      if (nome) { nome.hidden = false; nome.textContent = `📄 ${arquivo.name}`; }
      if (analise.fatal) {
        document.querySelector("[data-imp-resultado]").hidden = true;
        showToast(analise.fatal, "error");
        return;
      }
      filtro = "problema";
      const selFiltro = document.querySelector("[data-imp-filtro]");
      if (selFiltro) selFiltro.value = "problema";
      renderResultado();
      const travadas = analise.linhas.filter((l) => l.situacao === "erro").length;
      showToast(travadas ? `${travadas} linha(s) precisam de correção`
                         : `${analise.linhas.length} linha(s) conferidas, tudo certo`,
                travadas ? "error" : "success");
      document.querySelector("[data-imp-resultado]").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (ehXlsx) leitor.readAsArrayBuffer(arquivo);
    else leitor.readAsText(arquivo, "UTF-8");
  }

  /* ---------- eventos ---------- */

  document.querySelectorAll("[data-imp-tipo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-imp-tipo]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      tipo = btn.dataset.impTipo;
      analise = null;
      document.querySelector("[data-imp-resultado]").hidden = true;
      const nome = document.querySelector("[data-imp-nome]");
      if (nome) nome.hidden = true;
      renderColunas();
    });
  });

  document.querySelectorAll("[data-imp-baixar]").forEach((btn) => {
    btn.addEventListener("click", () => baixarModelo(btn.dataset.impBaixar || "xlsx"));
  });
  inputArquivo.addEventListener("change", () => {
    if (inputArquivo.files[0]) processar(inputArquivo.files[0]);
  });

  const drop = document.querySelector("[data-imp-drop]");
  if (drop) {
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault(); drop.classList.add("arrastando");
    }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault(); drop.classList.remove("arrastando");
    }));
    drop.addEventListener("drop", (e) => {
      const f = e.dataTransfer.files[0];
      if (f) processar(f);
    });
  }

  document.querySelector("[data-imp-filtro]")?.addEventListener("change", (e) => {
    filtro = e.target.value;
    renderResultado();
  });

  document.querySelector("[data-imp-confirmar]")?.addEventListener("click", () => {
    const n = analise.linhas.filter((l) => l.situacao !== "erro").length;
    showToast(`${n} linha(s) entrariam no orçamento — protótipo não grava.`, "info");
  });

  Promise.all([
    carregarRef("organizacional.json"),
    carregarRef("contas.json"),
    carregarRef("produtos.json"),
    carregarRef("pacotes.json"),
  ]).then(([org, contas, produtos, pacotes]) => {
    ref = { org, contas, produtos, pacotes };
    renderColunas();
  });
}

/* ==========================================================================
   Barra "versão em edição" — Receita, Despesa e Capex
   ==========================================================================
   Lê cronograma.json em vez de repetir o texto em cada página. Com três
   cópias em HTML fixo, virar o ciclo exigiria lembrar de editar três
   arquivos — e o que depende de lembrar, diverge.

   O prazo mostrado é o da CATEGORIA da tela, não um só para todas: o
   cronograma tem um corte por categoria, e quem está lançando despesa
   precisa ver o prazo da despesa, não o da receita.
*/

const VERSAO_MARCO = {
  receita: "Corte de Receita",
  despesa: "Corte de Despesa",
  capex:   "Corte de Capex",
};

function initVersaoBarra() {
  const barra = document.querySelector("[data-versao-barra]");
  if (!barra) return;
  const categoria = barra.dataset.versaoBarra;

  carregarRef("cronograma.json").then((crono) => {
    const atual = barra.querySelector("[data-versao-atual]");
    if (atual) {
      atual.innerHTML =
        `Ciclo ${escaparTexto(crono.ciclo)} · ${escaparTexto(crono.versaoAtiva)} ` +
        `<span class="pill tipo-revisao">${escaparTexto(crono.versaoTipo || "—")}</span>`;
    }

    const prazoEl = barra.querySelector("[data-versao-prazo]");
    const marco = (crono.marcos || []).find((m) => m.nome === VERSAO_MARCO[categoria]);
    if (!prazoEl || !marco) return;

    const dias = Math.round(
      (new Date(marco.data + "T12:00:00") - new Date(hojeISO() + "T12:00:00")) / 86400000
    );
    const bloco = prazoEl.closest(".version-status-deadline");
    const plural = (n) => `${n} ${n === 1 ? "dia" : "dias"}`;

    if (dias < 0) {
      prazoEl.innerHTML = `${dataBR(marco.data)} <span class="text-muted">— encerrado há ${plural(Math.abs(dias))}</span>`;
      if (bloco) bloco.classList.add("warn");
    } else {
      prazoEl.innerHTML = `${dataBR(marco.data)} <span class="text-muted">(${dias === 0 ? "hoje" : plural(dias)})</span>`;
      // uma semana ou menos já merece destaque
      if (bloco) bloco.classList.toggle("warn", dias <= 7);
    }
  });
}

/* ==========================================================================
   Correções — o que o aprovador devolveu volta para quem lançou
   ==========================================================================
   Fecha o ciclo que antes terminava no vazio: o aprovador devolvia e o dado
   ficava sem destino, porque a grade de lançamento não sabia que aquela
   entrega tinha voltado.

   Só entra aqui o que foi DEVOLVIDO ou REPROVADO. O que está aguardando
   decisão fica travado de propósito — dado enviado não se edita pelas costas
   de quem está analisando.
*/

function corFormatarMil(v) {
  if (v === null || v === undefined) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
}

function initCorrecoes() {
  const fila = document.querySelector("[data-cor-fila]");
  const painel = document.querySelector("[data-cor-detalhe]");
  if (!fila || !painel) return;

  const filtros = { responsavel: "", categoria: "", situacao: "" };
  let dados = null, regrasPorCodigo = {}, selecionado = null;
  // correções feitas nesta sessão: o protótipo não grava, mas a tela precisa
  // mostrar o efeito de ter corrigido
  const corrigidas = new Map();

  const devolvidas = () =>
    dados.submissoes.filter((s) => ["devolvido", "reprovado"].includes(s.statusOficial));

  function visiveis() {
    return devolvidas().filter((s) => {
      if (filtros.responsavel && s.responsavel !== filtros.responsavel) return false;
      if (filtros.categoria && s.categoria !== filtros.categoria) return false;
      if (filtros.situacao && s.statusOficial !== filtros.situacao) return false;
      return true;
    });
  }

  const bloqueiosDe = (sub) => bloqueiosDaSubmissao(sub, regrasPorCodigo);

  function renderKpis() {
    const poe = (k, v) => document.querySelectorAll(`[data-cor-kpi="${k}"]`)
                            .forEach((el) => { el.textContent = v; });
    const lista = devolvidas();
    const devolv = lista.filter((s) => s.statusOficial === "devolvido").length;

    poe("fila", lista.length);
    poe("fila-detalhe", `${devolv} devolvidas · ${lista.length - devolv} reprovadas`);
    poe("valor", corFormatarMil(lista.reduce((t, s) => t + (s.valor || 0), 0)));
    poe("bloqueadas", lista.filter((s) => bloqueiosDe(s).length).length);
    poe("corrigidas", corrigidas.size);
  }

  function renderFila() {
    const lista = visiveis();
    const vazio = document.querySelector("[data-cor-vazio]");
    const resumo = document.querySelector("[data-cor-resumo]");
    if (resumo) {
      const total = devolvidas().length;
      resumo.textContent = lista.length === total
        ? `${total} item(ns) esperando correção`
        : `${lista.length} de ${total} itens`;
    }
    if (vazio) vazio.hidden = lista.length > 0;

    fila.innerHTML = lista.map((s) => {
      const info = APROV_STATUS[s.statusOficial] || {};
      const travas = bloqueiosDe(s).length;
      const feito = corrigidas.get(s.id);
      return `
        <button class="cor-card ${selecionado === s.id ? "escolhido" : ""} ${feito ? "corrigido" : ""}"
                data-cor-item="${escaparTexto(s.id)}">
          <div class="cor-card-topo">
            <strong>${escaparTexto(s.empresa)}</strong>
            <span class="badge ${info.classe || ""}">${escaparTexto(info.rotulo || s.statusOficial)}</span>
          </div>
          <div class="cor-card-meio">${escaparTexto(s.torre)} · ${escaparTexto(s.categoria)}</div>
          <div class="cor-card-baixo">
            <span>${corFormatarMil(s.valor)}</span>
            ${travas ? `<span class="cor-trava">${travas} validação(ões) travando</span>` : ""}
            ${feito ? `<span class="cor-pronto">✓ corrigido, pronto para reenviar</span>` : ""}
          </div>
        </button>`;
    }).join("");
  }

  function renderDetalhe() {
    const sub = document.querySelector("[data-cor-detalhe-sub]");
    const s = dados.submissoes.find((x) => x.id === selecionado);
    if (!s) {
      painel.innerHTML = '<p class="empty-hint">Nenhum item selecionado.</p>';
      if (sub) sub.textContent = "Escolha um item da fila ao lado.";
      return;
    }
    if (sub) sub.textContent = `${s.empresa} · ${s.torre} · ${s.categoria} — ${s.id}`;

    const dec = s.decisao || {};
    const travas = bloqueiosDe(s);
    const feito = corrigidas.get(s.id);
    const valorAtual = feito ? feito.valor : s.valor;

    const falhas = (s.validacoes || []).filter((v) => v.resultado !== "ok");

    painel.innerHTML = `
      <div class="cor-motivo">
        <span class="cor-motivo-rot">Por que voltou — ${escaparTexto(dec.por || "aprovador")}, ${dataBR(dec.em)}</span>
        <p>${escaparTexto(dec.parecer || "Sem parecer registrado.")}</p>
      </div>

      ${falhas.length ? `
        <div class="cor-bloco">
          <span class="cor-bloco-rot">O que o sistema apontou</span>
          <ul class="cor-validacoes">
            ${falhas.map((v) => {
              const r = regrasPorCodigo[v.regra] || {};
              const trava = r.severidade === "bloqueia";
              return `<li class="${trava ? "trava" : "alerta"}">
                        <strong>${escaparTexto(r.nome || v.regra)}</strong>
                        ${trava ? '<span class="cor-tag-trava">trava o reenvio</span>' : '<span class="cor-tag-alerta">alerta</span>'}
                        ${v.detalhe ? `<span class="cor-detalhe-val">${escaparTexto(v.detalhe)}</span>` : ""}
                      </li>`;
            }).join("")}
          </ul>
        </div>` : ""}

      ${(s.pendencias || []).length ? `
        <div class="cor-bloco">
          <span class="cor-bloco-rot">Informação que ainda falta</span>
          <ul class="cor-pendencias">
            ${s.pendencias.map((p) => `
              <li><strong>${escaparTexto(p.oQueFalta)}</strong>
                  <span>${escaparTexto(p.porque)}</span>
                  <span class="cor-quem">com ${escaparTexto(p.quemResolve)} desde ${dataBR(p.desde)}</span></li>`).join("")}
          </ul>
        </div>` : ""}

      <div class="cor-bloco">
        <span class="cor-bloco-rot">Corrigir o valor</span>
        <div class="cor-antes-depois">
          <div>
            <span class="cor-ad-rot">Foi enviado</span>
            <strong>${corFormatarMil(s.valor)}</strong>
          </div>
          <span class="cor-ad-seta">→</span>
          <div>
            <span class="cor-ad-rot">Passa a ser</span>
            <input type="number" step="0.1" class="cor-input-valor"
                   data-cor-valor value="${valorAtual}" />
          </div>
          <div class="cor-ad-delta" data-cor-delta>—</div>
        </div>
      </div>

      <div class="cor-bloco">
        <span class="cor-bloco-rot">O que você mudou <span class="cor-obrigatorio">obrigatório</span></span>
        <textarea class="cor-justificativa" data-cor-justificativa rows="3"
          placeholder="Ex: consolidei as duas linhas duplicadas na conta 4.7.03 e ajustei o rateio do CC.">${feito ? escaparTexto(feito.justificativa) : ""}</textarea>
        <p class="cor-ajuda">Vai junto no reenvio e fica na trilha de auditoria com o seu nome.</p>
      </div>

      ${travas.length ? `
        <label class="cor-confirma">
          <input type="checkbox" data-cor-confirma ${feito ? "checked" : ""} />
          <span>Confirmo que corrigi as ${travas.length} validação(ões) que travavam: ${
            travas.map((b) => escaparTexto((regrasPorCodigo[b.regra] || {}).nome || b.regra)).join(", ")}.</span>
        </label>` : ""}

      <div class="cor-acoes">
        <button class="btn btn-primary" data-cor-reenviar disabled>↑ Reenviar para aprovação</button>
        <span class="cor-aviso" data-cor-aviso>Explique o que mudou para liberar o reenvio.</span>
      </div>`;

    ligarFormulario(s, travas);
  }

  /* Reenvio só libera com justificativa escrita e, havendo trava, com a
     confirmação marcada. É a mesma exigência que o aceite final faz do líder:
     assumir o que está mandando. */
  function ligarFormulario(s, travas) {
    const campoValor = painel.querySelector("[data-cor-valor]");
    const campoJust  = painel.querySelector("[data-cor-justificativa]");
    const confirma   = painel.querySelector("[data-cor-confirma]");
    const botao      = painel.querySelector("[data-cor-reenviar]");
    const aviso      = painel.querySelector("[data-cor-aviso]");
    const delta      = painel.querySelector("[data-cor-delta]");

    function atualizar() {
      const novo = Number(campoValor.value);
      const dif = novo - s.valor;
      if (!Number.isFinite(novo)) {
        delta.textContent = "—";
      } else if (dif === 0) {
        delta.innerHTML = '<span class="cor-delta-igual">sem mudança de valor</span>';
      } else {
        const pct = s.valor ? (dif / Math.abs(s.valor)) * 100 : 0;
        delta.innerHTML = `<span class="${dif > 0 ? "cor-delta-sobe" : "cor-delta-desce"}">
            ${dif > 0 ? "+" : ""}${corFormatarMil(dif)} · ${dif > 0 ? "+" : ""}${pct.toFixed(1)}%</span>`;
      }

      const temJust = campoJust.value.trim().length >= 10;
      const okTrava = !travas.length || (confirma && confirma.checked);
      botao.disabled = !(temJust && okTrava);
      aviso.textContent = !temJust
        ? "Explique o que mudou para liberar o reenvio."
        : !okTrava ? "Confirme que corrigiu as validações que travam."
        : "Pronto para reenviar.";
    }

    campoValor.addEventListener("input", atualizar);
    campoJust.addEventListener("input", atualizar);
    if (confirma) confirma.addEventListener("change", atualizar);

    botao.addEventListener("click", () => {
      corrigidas.set(s.id, {
        valor: Number(campoValor.value),
        justificativa: campoJust.value.trim(),
      });
      showToast(`${s.empresa} · ${s.categoria} reenviado para aprovação — protótipo não grava.`, "success");
      renderKpis();
      renderFila();
      renderDetalhe();
    });

    atualizar();
  }

  /* Delegação: os cartões da fila são recriados a cada filtro. */
  fila.addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-cor-item]");
    if (!card) return;
    selecionado = card.dataset.corItem;
    renderFila();
    renderDetalhe();
  });

  document.querySelectorAll("[data-cor-filtro]").forEach((campo) => {
    campo.addEventListener("change", () => {
      filtros[campo.dataset.corFiltro] = campo.value;
      renderFila();
    });
  });

  carregarRef("aprovacoes.json").then((json) => {
    dados = json;
    regrasPorCodigo = Object.fromEntries(json.regras.map((r) => [r.codigo, r]));

    const sel = document.querySelector('[data-cor-filtro="responsavel"]');
    if (sel) {
      [...new Set(devolvidas().map((s) => s.responsavel))].sort().forEach((nome) => {
        const opt = document.createElement("option");
        opt.value = nome; opt.textContent = nome;
        sel.appendChild(opt);
      });
    }
    renderKpis();
    renderFila();
    renderDetalhe();
  });
}

/* ==========================================================================
   Capex — o investimento e o que ele vira no P&L
   ==========================================================================
   A diferença para a tela de Despesa: lá o gasto se divide entre opex e capex
   conforme o percentual de ativação. Aqui a linha JÁ É investimento inteiro,
   e o que importa é o tipo de ativo — é ele que define a vida útil e se a
   volta ao resultado é depreciação (CPC 27) ou amortização (CPC 04).

   Ativar não cria valor: o caixa é o mesmo. Muda o caminho — sai de Capex e
   volta diluído abaixo do EBITDA ao longo da vida útil. É essa conta, que
   ninguém faz de cabeça, que o painel mostra enquanto a pessoa lança.
*/

function initCapex() {
  const tabela = document.getElementById("tabela-capex");
  const efeito = document.querySelector("[data-cpx-efeito]");
  if (!tabela) return;

  let ref = null;
  const dinheiro = (v) =>
    `R$ ${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  const tipoPorNome = (nome) => (ref.tiposAtivo || []).find((t) => t.nome === nome) || null;

  /* A depreciação começa no mês SEGUINTE ao da entrada do ativo — convenção
     mais comum e a mais conservadora para orçamento. Ativo que entra em
     dezembro não gera D&A nenhuma no próprio ciclo. */
  function medirLinha(row) {
    const meses = Array.from(row.querySelectorAll("td.month-col input"))
      .map((i) => Number(i.value) || 0);
    const total = meses.reduce((s, v) => s + v, 0);
    const tipo = tipoPorNome(row.querySelector(".ativacao-input")?.value.trim() || "");
    const vida = tipo ? tipo.vidaUtilAnos : 0;

    let daNoCiclo = 0;
    if (vida > 0) {
      meses.forEach((v, m) => {
        if (v) daNoCiclo += (v / (vida * 12)) * Math.max(0, 11 - m);
      });
    }
    return {
      total, tipo, vida, daNoCiclo,
      daAno: vida > 0 ? total / vida : 0,
      pacote: pacoteDaLinha(row),
      nome: row.querySelector(".conta-nome-input")?.value.trim() || "projeto sem nome",
    };
  }

  function calcular() {
    const linhas = Array.from(tabela.querySelectorAll("tbody tr"))
      .map(medirLinha).filter((l) => l.total > 0);

    const r = { investido: 0, daAno: 0, daNoCiclo: 0, projetos: linhas.length,
                porTipo: new Map(), alertas: [] };

    linhas.forEach((l) => {
      r.investido += l.total;
      r.daAno += l.daAno;
      r.daNoCiclo += l.daNoCiclo;

      if (l.tipo) {
        const at = r.porTipo.get(l.tipo.nome) || { tipo: l.tipo, valor: 0, daAno: 0 };
        at.valor += l.total;
        at.daAno += l.daAno;
        r.porTipo.set(l.tipo.nome, at);
      } else {
        r.alertas.push(`<strong>${escaparTexto(l.nome)}</strong> está sem tipo de ativo — sem ele não há vida útil nem depreciação.`);
      }

      const lim = ref.limiteMaterialidade;
      if (lim && l.total < lim.valorMil) {
        r.alertas.push(`<strong>${escaparTexto(l.nome)}</strong> soma ${dinheiro(l.total)}, abaixo do limite de materialidade. ${escaparTexto(lim.texto)}`);
      }

      const eleg = (ref.elegibilidadePorPacote || {})[l.pacote];
      if (eleg && eleg.grau === "nao") {
        r.alertas.push(`Pacote <strong>${escaparTexto(l.pacote)}</strong> não é elegível a ativação. ${escaparTexto(eleg.nota)}`);
      } else if (eleg && eleg.grau === "parcial") {
        r.alertas.push(`Pacote <strong>${escaparTexto(l.pacote)}</strong> é elegível só em parte. ${escaparTexto(eleg.nota)}`);
      }
    });

    /* média ponderada pelo valor: a simples enganaria, porque um projeto de
       10 anos e R$ 50 mil pesaria igual a um de 5 anos e R$ 2 milhões */
    const comVida = linhas.filter((l) => l.vida > 0);
    const peso = comVida.reduce((s, l) => s + l.total, 0);
    r.vidaMedia = peso ? comVida.reduce((s, l) => s + l.vida * l.total, 0) / peso : 0;
    return r;
  }

  function render() {
    if (!ref) return;
    const r = calcular();
    const poe = (k, v) => document.querySelectorAll(`[data-cpx-kpi="${k}"]`)
                            .forEach((el) => { el.textContent = v; });

    poe("investido", dinheiro(r.investido));
    poe("projetos", `${r.projetos} projeto(s) na grade`);
    poe("da-ano", dinheiro(r.daAno));
    poe("da-ciclo", dinheiro(r.daNoCiclo));
    poe("da-ciclo-detalhe", r.daAno ? `${Math.round((r.daNoCiclo / r.daAno) * 100)}% de um ano cheio` : "—");
    poe("vida", r.vidaMedia ? `${r.vidaMedia.toFixed(1)} anos` : "—");

    if (!efeito) return;
    if (!r.projetos) {
      efeito.innerHTML = '<div class="empty-hint">Lance um projeto na grade para ver o efeito.</div>';
      return;
    }

    const porTipo = [...r.porTipo.values()].sort((a, b) => b.valor - a.valor).map((x) => `
      <tr>
        <td><strong>${escaparTexto(x.tipo.nome)}</strong><br><span class="text-muted">${escaparTexto(x.tipo.natureza)} · ${escaparTexto(x.tipo.norma)}</span></td>
        <td class="text-right">${x.tipo.vidaUtilAnos} anos</td>
        <td>${escaparTexto(x.tipo.metodo)}</td>
        <td class="text-right">${dinheiro(x.valor)}</td>
        <td class="text-right down">${dinheiro(x.daAno)}</td>
      </tr>`).join("");

    efeito.innerHTML = `
      <div class="table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Tipo de ativo</th><th class="text-right">Vida útil</th><th>Volta como</th>
              <th class="text-right">Investido no ano</th><th class="text-right">D&amp;A por ano cheio</th>
            </tr>
          </thead>
          <tbody>${porTipo}</tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td class="text-right">${r.vidaMedia ? r.vidaMedia.toFixed(1) + " anos" : "—"}</td>
              <td>—</td>
              <td class="text-right"><strong>${dinheiro(r.investido)}</strong></td>
              <td class="text-right down"><strong>${dinheiro(r.daAno)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="passo-ajuda">
        Destes ${dinheiro(r.daAno)} de D&amp;A por ano cheio, <strong>${dinheiro(r.daNoCiclo)}</strong>
        caem já neste ciclo — o resto começa nos anos seguintes, porque a depreciação
        só corre a partir do mês seguinte à entrada de cada ativo.
      </p>
      ${r.alertas.length ? `<div class="aprov-trava">${r.alertas.join("<br>")}</div>` : ""}`;
  }

  /* Delegação no document: a grade é editada célula a célula e as linhas são
     clonadas em "duplicar" — listener por input sumiria na cópia. */
  ["input", "change"].forEach((ev) => {
    document.addEventListener(ev, (e) => {
      if (e.target.closest("#tabela-capex")) render();
    });
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-action]")) setTimeout(render, 60);
  });

  carregarRef("ativacao.json").then((json) => {
    ref = json;
    // Capex não oferece "Não ativa — Opex": se fosse opex não estaria aqui
    const ativos = (json.tiposAtivo || []).filter((t) => t.natureza !== "Opex");

    const lista = document.getElementById("ativacao-datalist");
    if (lista) {
      ativos.forEach((t) => {
        const o = document.createElement("option");
        o.value = t.nome;
        lista.appendChild(o);
      });
    }

    const sel = document.querySelector('[data-campo="tipoativo"]');
    const ajuda = document.querySelector("[data-cpx-ajuda-tipo]");
    if (sel) {
      ativos.forEach((t) => {
        const o = document.createElement("option");
        o.value = t.nome;
        o.textContent = `${t.nome} — ${t.vidaUtilAnos} anos`;
        sel.appendChild(o);
      });
      const explicar = () => {
        const t = tipoPorNome(sel.value);
        if (ajuda && t) ajuda.textContent = `${t.norma} · ${t.metodo} em ${t.vidaUtilAnos} anos. ${t.ajuda || ""}`;
      };
      sel.addEventListener("change", explicar);
      explicar();
    }
    render();
  });
}

/* ==========================================================================
   Dashboard Executivo — a leitura do ciclo numa tela, e o deck que sai dela
   ==========================================================================
   Item 21 do roadmap. Duas coisas na mesma tela, de propósito:

   1. A leitura que a liderança pede — qual é o número, quanto ele mudou
      contra a base, quem mexeu nele, quanto dele já está aprovado e o que
      ainda falta entregar.
   2. O PowerPoint. E ele não é gerado do HTML: sai do MESMO objeto que
      desenhou a tela (execModelo). Painel e slide não têm como divergir
      porque são a mesma conta lida duas vezes.

   Tudo vem de Referencias/inputs.json — as linhas que a tela de Aprovações
   já mostra uma a uma. Valores no arquivo estão em R$ mil; os totais aparecem
   em R$ mi e a tabela linha a linha em R$ mil, com a unidade no cabeçalho.
*/

const EXEC_CATEGORIAS = [
  { chave: "receita", rotulo: "Revenue",  sinal: "(+)", classe: "receita", cor: "1A9C6A" },
  { chave: "despesa", rotulo: "Expenses", sinal: "(−)", classe: "despesa", cor: "D64545" },
  { chave: "capex",   rotulo: "Capex",    sinal: "(−)", classe: "capex",   cor: "7A4FD6" },
];

const EXEC_SITUACAO = {
  aprovado:  { rotulo: "Aprovado",  badge: "status-aprovado",     cor: "1A9C6A" },
  pendente:  { rotulo: "Pendente",  badge: "status-em-aprovacao", cor: "B8860B" },
  rejeitado: { rotulo: "Rejeitado", badge: "status-reprovado",    cor: "D64545" },
};

const EXEC_MARGEM = 1.6;
const EXEC_LARG = PPT_LARGURA_CM - 2 * EXEC_MARGEM;

function execNum(v, casas = 1) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/* Total em R$ mi, no mesmo formato das outras telas ("− R$ 96,7 mi") — é o que
   o export em CSV sabe reconverter para número. Entra em R$ mil. */
function execMi(v) {
  return `${v < 0 ? "− " : ""}R$ ${execNum(Math.abs(v) / 1000)} mi`;
}

/* Linha a linha o valor é pequeno demais para milhão: 16,9 mil viraria 0,0 mi.
   Aqui sai só o número e a unidade fica no cabeçalho da coluna. */
function execMil(v) {
  return execNum(v);
}

/* Sem sinal quando a variação some no arredondamento: "− 0,0 mi" parece defeito
   para quem lê, e a diferença entre −44 mil e zero não muda decisão nenhuma. */
function execDeltaMi(v) {
  const mi = Math.abs(v) / 1000;
  return `${mi < 0.05 ? "" : v > 0 ? "+" : "−"}${execNum(mi)} mi`;
}

/* A seta diz para onde o número foi; a cor diz se isso é bom. Numa linha de
   custo as duas coisas discordam — despesa que sobe é seta para cima e
   vermelho —, e juntar as duas num símbolo só confunde. */
function execSeta(delta) {
  return Math.abs(delta) / 1000 < 0.05 ? "•" : delta > 0 ? "▲" : "▼";
}

function execPct(v) {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${execNum(Math.abs(v))}%`;
}

function execAgregado(nivel, rotulo, lista) {
  const base = lista.reduce((s, i) => s + i.valorAtual, 0);
  const solicitado = lista.reduce((s, i) => s + i.valorSolicitado, 0);
  const pendentes = lista.filter((i) => i.status === "pendente").length;
  const rejeitadas = lista.filter((i) => i.status === "rejeitado").length;

  const partes = [];
  if (pendentes) partes.push(`${pendentes} pendente(s)`);
  if (rejeitadas) partes.push(`${rejeitadas} rejeitada(s)`);

  return {
    nivel, rotulo, base, solicitado,
    delta: solicitado - base,
    pct: base ? ((solicitado - base) / base) * 100 : 0,
    linhas: lista.length, pendentes, rejeitadas,
    situacao: partes.length ? partes.join(" · ") : "Tudo decidido",
    grau: pendentes ? "pendente" : rejeitadas ? "rejeitado" : "aprovado",
  };
}

/* O modelo. Uma função pura: entram os JSON e o recorte, sai tudo que a tela
   desenha e o deck imprime. */
function execCalcular(dados, filtros) {
  const todas = dados.inputs.inputs;
  const doRecorte = todas.filter((i) => !filtros.bu || i.bu === filtros.bu);
  const linhas = doRecorte.filter((i) => filtros.base !== "aprovado" || i.status === "aprovado");

  const totais = {};
  EXEC_CATEGORIAS.forEach((c) => {
    totais[c.chave] = execAgregado("categoria", c.rotulo, linhas.filter((i) => i.categoria === c.chave));
  });

  const R = totais.receita.solicitado, D = totais.despesa.solicitado, C = totais.capex.solicitado;
  const Rb = totais.receita.base, Db = totais.despesa.base, Cb = totais.capex.base;

  // A ponte anda de um degrau para o outro: cada etapa sabe de onde a barra
  // sai, onde ela chega e em que altura o traço segue para a coluna seguinte.
  const etapas = [
    { chave: "receita", rotulo: "Revenue", sinal: "(+)", classe: "receita", cor: "1A9C6A",
      valor: R, de: 0, ate: R, acumulado: R, delta: R - Rb, bom: R - Rb >= 0 },
    { chave: "despesa", rotulo: "Expenses", sinal: "(−)", classe: "despesa", cor: "D64545",
      valor: -D, de: R - D, ate: R, acumulado: R - D, delta: D - Db, bom: D - Db <= 0 },
    { chave: "ebitda", rotulo: "EBITDA", sinal: "", classe: "subtotal", cor: "C3CAD6",
      valor: R - D, de: 0, ate: R - D, acumulado: R - D,
      delta: (R - D) - (Rb - Db), bom: (R - D) - (Rb - Db) >= 0 },
    { chave: "capex", rotulo: "Capex", sinal: "(−)", classe: "capex", cor: "7A4FD6",
      valor: -C, de: R - D - C, ate: R - D, acumulado: R - D - C, delta: C - Cb, bom: C - Cb <= 0 },
    { chave: "final", rotulo: "EBITDA after Capex", sinal: "", classe: "final", cor: "1F4FD6",
      valor: R - D - C, de: 0, ate: R - D - C, acumulado: R - D - C,
      delta: (R - D - C) - (Rb - Db - Cb), bom: (R - D - C) - (Rb - Db - Cb) >= 0 },
  ];

  // A firmeza descreve o número inteiro do recorte, então ignora o filtro de
  // base: com "só aprovado" ligado ela responderia 100% e não diria nada.
  const totalRecorte = doRecorte.reduce((s, i) => s + i.valorSolicitado, 0);
  const firmeza = Object.keys(EXEC_SITUACAO).map((chave) => {
    const l = doRecorte.filter((i) => i.status === chave);
    const valor = l.reduce((s, i) => s + i.valorSolicitado, 0);
    return {
      chave, rotulo: EXEC_SITUACAO[chave].rotulo, cor: EXEC_SITUACAO[chave].cor,
      valor, linhas: l.length, pct: totalRecorte ? (valor / totalRecorte) * 100 : 0,
    };
  });

  const movimento = [];
  [...new Set(linhas.map((i) => i.bu))].sort().forEach((bu) => {
    const daBu = linhas.filter((i) => i.bu === bu);
    movimento.push(execAgregado("bu", bu, daBu));
    [...new Set(daBu.map((i) => i.torre))].sort().forEach((torre) => {
      movimento.push(execAgregado("torre", torre === "-" ? "(sem torre)" : torre,
        daBu.filter((i) => i.torre === torre)));
    });
  });

  // Os oito maiores movimentos em módulo: as altas e as quedas que sozinhas
  // explicam a maior parte do Δ. Ordenados da maior alta para a maior queda.
  const top = linhas
    .map((i) => ({ ...i, delta: i.valorSolicitado - i.valorAtual }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 8)
    .sort((a, b) => b.delta - a.delta);

  const ciclo = resumoDoCiclo(dados.crono, dados.entregas, dados.aprov);
  const rotuloBu = filtros.bu || "Todas as BUs";
  const rotuloBase = filtros.base === "aprovado" ? "Só o que já foi aprovado" : "Tudo que foi solicitado";
  const agora = new Date();

  return {
    filtros, etapas, firmeza, movimento, top, totais, ciclo,
    total: execAgregado("total", "Total", linhas),
    ciclos: { ciclo: dados.inputs.ciclo, rotulo: dados.inputs.cicloRotulo, base: dados.inputs.baseComparacao },
    versao: dados.crono.versaoAtiva,
    titulo: `Orçamento ${dados.inputs.ciclo}`,
    subtitulo: `${dados.inputs.cicloRotulo} · ${rotuloBu} · ${rotuloBase}`,
    rotuloBu, rotuloBase,
    rodape: `NS Codex · ${dados.inputs.cicloRotulo} · versão ${dados.crono.versaoAtiva} · ` +
      `recorte: ${rotuloBu}, ${rotuloBase.toLowerCase()} · gerado em ${agora.toLocaleString("pt-BR")}`,
    geradoEm: agora,
  };
}

/* ---------- Leituras em texto: a frase que sobra se o executivo ler uma só ---------- */

function execLeituraPonte(m) {
  const final = m.etapas[4], receita = m.etapas[0], capex = m.etapas[3];
  const sinal = final.valor < 0 ? "não se paga" : "se paga";
  return `Com ${execMi(receita.valor)} de Revenue e ${execMi(Math.abs(capex.valor))} de Capex, ` +
    `o ciclo fecha em ${execMi(final.valor)} de EBITDA after Capex — ${execDeltaMi(final.delta)} ` +
    `contra o ${m.ciclos.base}. O Capex ${sinal} com o EBITDA do próprio ano.`;
}

function execLeituraFirmeza(m) {
  const aprovado = m.firmeza.find((f) => f.chave === "aprovado");
  const pendente = m.firmeza.find((f) => f.chave === "pendente");
  return `${execNum(aprovado.pct, 0)}% do número já passou pelo aprovador. ` +
    `Os ${execNum(pendente.pct, 0)}% pendentes valem ${execMi(pendente.valor)} em ${pendente.linhas} linha(s) — ` +
    `é o quanto o total ainda pode se mexer sem ninguém lançar nada novo.`;
}

/* ---------- Desenho da tela ---------- */

function execRenderKpis(m) {
  const alvo = document.querySelector("[data-exec-kpis]");
  const final = m.etapas[4];

  const cartao = (classe, rotulo, valor, delta, bom) => `
    <div class="kpi-card ${classe}">
      <div class="kpi-label">${escaparTexto(rotulo)}</div>
      <div class="kpi-value">${escaparTexto(valor)}</div>
      <div class="kpi-delta ${bom ? "up" : "down"}">${execSeta(delta)} ${escaparTexto(execDeltaMi(delta))} vs. ${escaparTexto(m.ciclos.base)}</div>
    </div>`;

  alvo.innerHTML =
    EXEC_CATEGORIAS.map((c) => {
      const t = m.totais[c.chave];
      const bom = c.chave === "receita" ? t.delta >= 0 : t.delta <= 0;
      return cartao(c.chave, `${c.sinal} ${c.rotulo}`, execMi(t.solicitado), t.delta, bom);
    }).join("") +
    cartao("margem", "EBITDA after Capex", execMi(final.valor), final.delta, final.bom);
}

function execRenderPonte(m) {
  const alvo = document.querySelector("[data-exec-ponte]");
  const min = Math.min(0, ...m.etapas.map((e) => Math.min(e.de, e.ate)));
  const max = Math.max(0, ...m.etapas.map((e) => Math.max(e.de, e.ate)));
  const faixa = max - min || 1;
  const pct = (v) => ((v - min) / faixa) * 100;

  // linha do zero: só aparece quando algum degrau desce abaixo dele
  const zero = min < 0
    ? `<div class="exec-zero" style="bottom:${pct(0).toFixed(2)}%"><span class="exec-zero-rot">0</span></div>`
    : "";

  const conector = (nivel) => `<div class="bridge-connector">
      <div class="bridge-value">&nbsp;</div>
      <div class="bridge-connector-track"><div class="bridge-connector-line" style="bottom:${nivel.toFixed(2)}%;"></div></div>
      <div class="bridge-label">&nbsp;</div>
      <div class="exec-delta">&nbsp;</div>
    </div>`;

  alvo.innerHTML = m.etapas.map((e, i) => {
    const baixo = pct(Math.min(e.de, e.ate));
    const alto = pct(Math.max(e.de, e.ate));
    const classeDelta = Math.abs(e.delta) / 1000 < 0.05 ? "neutro" : e.bom ? "sobe" : "desce";
    const seta = execSeta(e.delta);

    const col = `<div class="bridge-col">
        <div class="bridge-value">${escaparTexto(execMi(e.valor))}</div>
        <div class="bridge-track">${zero}<div class="bridge-bar ${e.classe}" style="bottom:${baixo.toFixed(2)}%; height:${Math.max(alto - baixo, 0.4).toFixed(2)}%;"></div></div>
        <div class="bridge-label">${e.sinal ? `<span class="bridge-sign">${e.sinal}</span>` : ""}${escaparTexto(e.rotulo)}</div>
        <div class="exec-delta ${classeDelta}">${seta} ${escaparTexto(execDeltaMi(e.delta))}</div>
      </div>`;

    return i < m.etapas.length - 1 ? col + conector(pct(e.acumulado)) : col;
  }).join("");

  document.querySelector("[data-exec-ponte-sub]").textContent =
    `${m.ciclos.rotulo} · ${m.rotuloBu} · ${m.rotuloBase} · comparado com ${m.ciclos.base} (R$ milhões)`;
  document.querySelector("[data-exec-ponte-leitura]").textContent = execLeituraPonte(m);
}

function execRenderFirmeza(m) {
  const alvo = document.querySelector("[data-exec-firmeza]");

  const barra = m.firmeza.filter((f) => f.pct > 0).map((f) =>
    `<div class="exec-barra-parte ${f.chave}" style="width:${f.pct.toFixed(2)}%" title="${escaparTexto(f.rotulo)}">${
      f.pct >= 8 ? execNum(f.pct, 0) + "%" : ""}</div>`).join("");

  const itens = m.firmeza.map((f) => `
    <div class="exec-firmeza-item ${f.chave}">
      <strong>${escaparTexto(execMi(f.valor))}</strong>
      <span>${escaparTexto(f.rotulo)} · ${f.linhas} linha(s) · ${execNum(f.pct, 0)}% do total</span>
    </div>`).join("");

  alvo.innerHTML = `<div class="exec-barra">${barra}</div>
    <div class="exec-firmeza-itens">${itens}</div>
    <p class="exec-leitura">${escaparTexto(execLeituraFirmeza(m))}</p>`;
}

function execRenderMovimento(m) {
  const corpo = document.querySelector("[data-exec-movimento]");
  const linha = (a, classe) => `
    <tr class="${classe}">
      <td>${escaparTexto(a.rotulo)}</td>
      <td class="text-right">${escaparTexto(execMi(a.base))}</td>
      <td class="text-right">${escaparTexto(execMi(a.solicitado))}</td>
      <td class="text-right ${a.delta >= 0 ? "up" : "down"}">${escaparTexto(execDeltaMi(a.delta))}</td>
      <td class="text-right ${a.delta >= 0 ? "up" : "down"}">${escaparTexto(execPct(a.pct))}</td>
      <td class="text-right">${a.linhas}</td>
      <td><span class="badge ${EXEC_SITUACAO[a.grau].badge}"><span class="badge-dot"></span>${escaparTexto(a.situacao)}</span></td>
    </tr>`;

  corpo.innerHTML = m.movimento.length
    ? m.movimento.map((a) => linha(a, a.nivel === "bu" ? "report-bu-row" : "report-torre-row")).join("")
    : '<tr><td colspan="7"><div class="empty-hint">Nenhuma linha no recorte escolhido.</div></td></tr>';

  document.querySelector("[data-exec-total]").innerHTML = m.movimento.length ? `
    <tr>
      <td>Total — ${escaparTexto(m.rotuloBu)}</td>
      <td class="text-right">${escaparTexto(execMi(m.total.base))}</td>
      <td class="text-right">${escaparTexto(execMi(m.total.solicitado))}</td>
      <td class="text-right ${m.total.delta >= 0 ? "up" : "down"}">${escaparTexto(execDeltaMi(m.total.delta))}</td>
      <td class="text-right ${m.total.delta >= 0 ? "up" : "down"}">${escaparTexto(execPct(m.total.pct))}</td>
      <td class="text-right">${m.total.linhas}</td>
      <td></td>
    </tr>` : "";

  // as linhas nasceram agora; o colapso de BU/Torre precisa ser religado nelas
  initHierarchyCollapse();
}

function execRenderTop(m) {
  const corpo = document.querySelector("[data-exec-top]");

  corpo.innerHTML = m.top.length ? m.top.map((i) => `
    <tr>
      <td>${escaparTexto(i.empresa)}</td>
      <td>${escaparTexto(i.descricao)}<br><span class="text-muted">${escaparTexto(i.conta)}</span></td>
      <td>${escaparTexto(i.centroCusto)}</td>
      <td class="text-right">${escaparTexto(execMil(i.valorAtual))}</td>
      <td class="text-right">${escaparTexto(execMil(i.valorSolicitado))}</td>
      <td class="text-right ${i.delta >= 0 ? "up" : "down"}">${i.delta >= 0 ? "+" : "−"}${escaparTexto(execMil(Math.abs(i.delta)))}</td>
      <td class="exec-justificativa">${escaparTexto(i.justificativa || "—")}</td>
      <td><span class="badge ${EXEC_SITUACAO[i.status].badge}"><span class="badge-dot"></span>${escaparTexto(EXEC_SITUACAO[i.status].rotulo)}</span></td>
    </tr>`).join("")
    : '<tr><td colspan="8"><div class="empty-hint">Nenhuma linha no recorte escolhido.</div></td></tr>';
}

/* ---------- O deck ----------
   Um slide por painel, na ordem em que a conversa acontece: qual é o número,
   quem mexeu nele, o que explica o movimento, quanto dele está firme e o que
   ainda falta acontecer.
*/

function execSlideBase(m, titulo, subtitulo) {
  const d = pptDesenho();
  d.retangulo({ x: 0, y: 0, l: PPT_LARGURA_CM, a: 0.3, cor: "1F4FD6" });
  d.texto({ x: EXEC_MARGEM, y: 1.15, l: EXEC_LARG, a: 1.25, texto: titulo, tam: 21, negrito: true, cor: "12213F" });
  d.texto({ x: EXEC_MARGEM, y: 2.5, l: EXEC_LARG, a: 0.75, texto: subtitulo, tam: 11, cor: "6B7280" });
  d.retangulo({ x: EXEC_MARGEM, y: 3.3, l: EXEC_LARG, a: 0.045, cor: "E3E7EE" });
  d.texto({ x: EXEC_MARGEM, y: 17.7, l: EXEC_LARG, a: 0.6, texto: m.rodape, tam: 8.5, cor: "9AA1AD" });
  return d;
}

function execSlideCapa(m) {
  const d = pptDesenho();
  const aprovado = m.firmeza.find((f) => f.chave === "aprovado");

  d.retangulo({ x: 0, y: 0, l: PPT_LARGURA_CM, a: PPT_ALTURA_CM, cor: "12213F" });
  d.retangulo({ x: 0, y: 0, l: PPT_LARGURA_CM, a: 0.32, cor: "1F4FD6" });

  d.texto({ x: EXEC_MARGEM, y: 5.2, l: EXEC_LARG, a: 0.8, texto: "NS CODEX", tam: 12, negrito: true, cor: "7FA0E8" });
  d.texto({ x: EXEC_MARGEM, y: 6.4, l: EXEC_LARG, a: 2.6, texto: m.titulo, tam: 36, negrito: true, cor: "FFFFFF" });
  d.texto({ x: EXEC_MARGEM, y: 9.3, l: EXEC_LARG, a: 1, texto: m.subtitulo, tam: 14, cor: "C7D2E8" });

  [
    { rot: "Revenue solicitado", val: execMi(m.etapas[0].valor) },
    { rot: "EBITDA after Capex", val: execMi(m.etapas[4].valor) },
    { rot: "Já decidido pelo aprovador", val: `${execNum(aprovado.pct, 0)}%` },
  ].forEach((c, i) => {
    const x = EXEC_MARGEM + i * 7.5;
    d.retangulo({ x, y: 11.4, l: 6.9, a: 2.9, cor: "1C3566", raio: 8000 });
    d.texto({ x: x + 0.6, y: 11.95, l: 5.7, a: 0.6, texto: c.rot, tam: 9.5, cor: "9DB2DC" });
    d.texto({ x: x + 0.6, y: 12.75, l: 5.7, a: 1.2, texto: c.val, tam: 19, negrito: true, cor: "FFFFFF" });
  });

  d.texto({ x: EXEC_MARGEM, y: 17.4, l: EXEC_LARG, a: 0.7, texto: m.rodape, tam: 9, cor: "8593AD" });
  return d.formas;
}

function execSlidePonte(m) {
  const d = execSlideBase(m, "Revenue → EBITDA after Capex",
    `${m.rotuloBu} · ${m.rotuloBase} · comparado com ${m.ciclos.base} (R$ milhões)`);

  const x0 = 2.2, largura = 29.4, colL = largura / m.etapas.length, barraL = 3.2;
  const topo = 5.4, baseY = 13.9, alturaPlot = baseY - topo;

  const min = Math.min(0, ...m.etapas.map((e) => Math.min(e.de, e.ate)));
  const max = Math.max(0, ...m.etapas.map((e) => Math.max(e.de, e.ate)));
  const faixa = max - min || 1;
  const y = (v) => baseY - ((v - min) / faixa) * alturaPlot;

  if (min < 0) {
    d.retangulo({ x: x0, y: y(0), l: largura, a: 0.025, cor: "AAB2C0" });
    d.texto({ x: x0 - 1.2, y: y(0) - 0.3, l: 1, a: 0.5, texto: "0", tam: 9, cor: "9AA1AD", alinha: "r" });
  }

  m.etapas.forEach((e, i) => {
    const centro = x0 + i * colL + colL / 2;
    const yTopo = y(Math.max(e.de, e.ate));
    const yBase = y(Math.min(e.de, e.ate));

    d.retangulo({ x: centro - barraL / 2, y: yTopo, l: barraL, a: Math.max(yBase - yTopo, 0.06), cor: e.cor, raio: 6000 });
    d.texto({ x: centro - colL / 2, y: yTopo - 0.78, l: colL, a: 0.7, texto: execMi(e.valor),
      tam: 11.5, negrito: true, alinha: "ctr", cor: "1B2436" });
    d.texto({ x: centro - colL / 2, y: baseY + 0.35, l: colL, a: 0.6,
      texto: (e.sinal ? e.sinal + " " : "") + e.rotulo, tam: 10.5, alinha: "ctr", cor: "6B7280" });
    d.texto({ x: centro - colL / 2, y: baseY + 1.05, l: colL, a: 0.6,
      texto: `${execSeta(e.delta)} ${execDeltaMi(e.delta)}`, tam: 9.5, negrito: true, alinha: "ctr",
      cor: Math.abs(e.delta) / 1000 < 0.05 ? "6B7280" : e.bom ? "1A9C6A" : "D64545" });

    if (i < m.etapas.length - 1) {
      d.retangulo({ x: centro + barraL / 2, y: y(e.acumulado), l: colL - barraL, a: 0.025, cor: "C3CAD6" });
    }
  });

  d.retangulo({ x: EXEC_MARGEM, y: 15.5, l: EXEC_LARG, a: 1.7, cor: "F4F6F9", raio: 6000 });
  d.texto({ x: EXEC_MARGEM + 0.5, y: 15.85, l: EXEC_LARG - 1, a: 1.3, texto: execLeituraPonte(m), tam: 11, cor: "1B2436" });
  return d.formas;
}

function execSlideMovimento(m) {
  const d = execSlideBase(m, "Como o número mudou — por BU e Torre",
    `Solicitado contra ${m.ciclos.base} · ${m.rotuloBase} (R$ milhões)`);

  const linhas = m.movimento.slice(0, 13).map((a) => {
    const corDelta = a.delta >= 0 ? "1A9C6A" : "D64545";
    const fundo = a.nivel === "bu" ? "EEF1F6" : "FFFFFF";
    return [
      { texto: a.nivel === "bu" ? a.rotulo : `   ${a.rotulo}`, negrito: a.nivel === "bu", fundo },
      { texto: execMi(a.base), alinha: "r", fundo },
      { texto: execMi(a.solicitado), alinha: "r", negrito: a.nivel === "bu", fundo },
      { texto: execDeltaMi(a.delta), alinha: "r", cor: corDelta, negrito: true, fundo },
      { texto: execPct(a.pct), alinha: "r", cor: corDelta, fundo },
      { texto: a.situacao, fundo, cor: "6B7280" },
    ];
  });

  linhas.push([
    { texto: `Total — ${m.rotuloBu}`, negrito: true, cor: "FFFFFF", fundo: "12213F" },
    { texto: execMi(m.total.base), alinha: "r", cor: "FFFFFF", fundo: "12213F" },
    { texto: execMi(m.total.solicitado), alinha: "r", negrito: true, cor: "FFFFFF", fundo: "12213F" },
    { texto: execDeltaMi(m.total.delta), alinha: "r", negrito: true, cor: "FFFFFF", fundo: "12213F" },
    { texto: execPct(m.total.pct), alinha: "r", cor: "FFFFFF", fundo: "12213F" },
    { texto: `${m.total.linhas} linha(s)`, cor: "FFFFFF", fundo: "12213F" },
  ]);

  d.tabela({
    x: EXEC_MARGEM, y: 4.1, alturaLinha: 0.78, tamFonte: 10.5,
    colunas: [
      { titulo: "BU / Torre", largura: 8.7 },
      { titulo: "Base", largura: 4.2, alinha: "r" },
      { titulo: "Solicitado", largura: 4.4, alinha: "r" },
      { titulo: "Δ R$", largura: 3.9, alinha: "r" },
      { titulo: "Δ %", largura: 3.2, alinha: "r" },
      { titulo: "Situação", largura: 6.27 },
    ],
    linhas,
  });
  return d.formas;
}

function execSlideTop(m) {
  const d = execSlideBase(m, "Os movimentos que explicam a variação",
    "Maiores altas e quedas em R$, com a justificativa de quem lançou (R$ mil)");

  const linhas = m.top.map((i) => [
    { texto: i.empresa },
    { texto: i.descricao },
    { texto: execMil(i.valorAtual), alinha: "r" },
    { texto: execMil(i.valorSolicitado), alinha: "r" },
    { texto: `${i.delta >= 0 ? "+" : "−"}${execMil(Math.abs(i.delta))}`, alinha: "r",
      negrito: true, cor: i.delta >= 0 ? "1A9C6A" : "D64545" },
    { texto: i.justificativa || "—", cor: "6B7280", tam: 9 },
    { texto: EXEC_SITUACAO[i.status].rotulo, cor: EXEC_SITUACAO[i.status].cor, negrito: true },
  ]);

  d.tabela({
    x: EXEC_MARGEM, y: 4.1, alturaLinha: 0.95, tamFonte: 9.5,
    colunas: [
      { titulo: "Empresa", largura: 3.9 },
      { titulo: "Conta", largura: 5.2 },
      { titulo: "Base", largura: 2.5, alinha: "r" },
      { titulo: "Solicitado", largura: 2.9, alinha: "r" },
      { titulo: "Δ", largura: 2.5, alinha: "r" },
      { titulo: "Justificativa", largura: 11.17 },
      { titulo: "Situação", largura: 2.5 },
    ],
    linhas,
  });
  return d.formas;
}

function execSlideFirmeza(m) {
  const d = execSlideBase(m, "Quanto do número já está firme",
    `Participação de cada situação de aprovação no total solicitado · ${m.rotuloBu}`);

  const x0 = EXEC_MARGEM, largura = EXEC_LARG;
  let x = x0;
  m.firmeza.filter((f) => f.pct > 0).forEach((f) => {
    const l = (f.pct / 100) * largura;
    d.retangulo({ x, y: 5.2, l, a: 1.15, cor: f.cor });
    if (f.pct >= 8) {
      d.texto({ x, y: 5.5, l, a: 0.6, texto: `${execNum(f.pct, 0)}%`, tam: 11, negrito: true, cor: "FFFFFF", alinha: "ctr" });
    }
    x += l;
  });

  m.firmeza.forEach((f, i) => {
    const cx = x0 + i * (largura / 3);
    const cl = largura / 3 - 0.5;
    d.retangulo({ x: cx, y: 7.4, l: cl, a: 3.1, cor: "FFFFFF", borda: "E3E7EE", raio: 5000 });
    d.retangulo({ x: cx, y: 7.4, l: 0.11, a: 3.1, cor: f.cor });
    d.texto({ x: cx + 0.6, y: 7.9, l: cl - 1.1, a: 0.6, texto: f.rotulo, tam: 10.5, negrito: true, cor: f.cor });
    d.texto({ x: cx + 0.6, y: 8.7, l: cl - 1.1, a: 1.1, texto: execMi(f.valor), tam: 20, negrito: true, cor: "12213F" });
    d.texto({ x: cx + 0.6, y: 9.9, l: cl - 1.1, a: 0.6,
      texto: `${f.linhas} linha(s) · ${execNum(f.pct, 0)}% do total`, tam: 9.5, cor: "6B7280" });
  });

  d.retangulo({ x: EXEC_MARGEM, y: 11.6, l: EXEC_LARG, a: 1.8, cor: "F4F6F9", raio: 6000 });
  d.texto({ x: EXEC_MARGEM + 0.5, y: 11.95, l: EXEC_LARG - 1, a: 1.4, texto: execLeituraFirmeza(m), tam: 11, cor: "1B2436" });
  return d.formas;
}

function execSlideCiclo(m) {
  const c = m.ciclo;
  const d = execSlideBase(m, "Onde o ciclo está", `Versão vigente ${m.versao} · ${m.ciclos.rotulo}`);

  [
    { rot: "Entregas por lançar", val: String(c.faltando),
      nota: c.atrasadas ? `${c.atrasadas} já passaram do prazo` : "nenhuma atrasada",
      cor: c.atrasadas ? "D64545" : "B8860B" },
    { rot: "Aguardando decisão do aprovador", val: String(c.aguardandoDecisao),
      nota: "submissões sem parecer", cor: "B8860B" },
    { rot: "Aguardando aceite do líder", val: String(c.aguardandoAceite),
      nota: "aprovadas, sem aceite final", cor: "1F4FD6" },
  ].forEach((k, i) => {
    const x = EXEC_MARGEM + i * (EXEC_LARG / 3);
    const l = EXEC_LARG / 3 - 0.5;
    d.retangulo({ x, y: 4.4, l, a: 3.3, cor: "FFFFFF", borda: "E3E7EE", raio: 5000 });
    d.retangulo({ x, y: 4.4, l: 0.11, a: 3.3, cor: k.cor });
    d.texto({ x: x + 0.6, y: 4.95, l: l - 1.1, a: 0.7, texto: k.rot, tam: 10, cor: "6B7280" });
    d.texto({ x: x + 0.6, y: 5.85, l: l - 1.1, a: 1.3, texto: k.val, tam: 26, negrito: true, cor: "12213F" });
    d.texto({ x: x + 0.6, y: 7.2, l: l - 1.1, a: 0.6, texto: k.nota, tam: 9.5, cor: "9AA1AD" });
  });

  d.texto({ x: EXEC_MARGEM, y: 8.6, l: EXEC_LARG, a: 0.8, texto: "Marcos que ainda vêm", tam: 13, negrito: true, cor: "12213F" });

  const marcos = [];
  if (c.proximo) marcos.push([c.proximo.nome, dataBR(c.proximo.data), `em ${c.diasProximo} dia(s)`, c.proximo.detalhe || ""]);
  if (c.fim && c.fim !== c.proximo) marcos.push([c.fim.nome, dataBR(c.fim.data), `em ${c.diasFim} dia(s)`, c.fim.detalhe || ""]);

  d.tabela({
    x: EXEC_MARGEM, y: 9.5, alturaLinha: 0.85, tamFonte: 10.5,
    colunas: [
      { titulo: "Marco", largura: 7.5 },
      { titulo: "Data", largura: 3.5 },
      { titulo: "Prazo", largura: 3.5 },
      { titulo: "O que trava", largura: 16.17 },
    ],
    linhas: marcos.length ? marcos : [["Ciclo sem marco futuro", "—", "—", "—"]],
  });
  return d.formas;
}

/* ---------- Init ---------- */

let execModelo = null;   // o que a tela desenhou; o PowerPoint sai daqui

function initDashboardExecutivo() {
  if (!document.querySelector("[data-exec-kpis]")) return;

  const filtros = { bu: "", base: "tudo" };
  let dados = null;

  const desenhar = () => {
    execModelo = execCalcular(dados, filtros);
    execRenderKpis(execModelo);
    execRenderPonte(execModelo);
    execRenderFirmeza(execModelo);
    execRenderMovimento(execModelo);
    execRenderTop(execModelo);
    document.querySelector("[data-exec-subtitulo]").textContent =
      `${execModelo.ciclos.rotulo} · versão ${execModelo.versao} · base de comparação: ${execModelo.ciclos.base}`;
  };

  document.querySelectorAll("[data-exec-filtro]").forEach((sel) => {
    sel.addEventListener("change", () => {
      filtros[sel.getAttribute("data-exec-filtro")] = sel.value;
      desenhar();
    });
  });

  document.querySelector("[data-exec-pptx]")?.addEventListener("click", () => {
    if (!execModelo) return showToast("Os números ainda estão carregando.", "warning");
    const slides = [
      execSlideCapa(execModelo), execSlidePonte(execModelo), execSlideMovimento(execModelo),
      execSlideTop(execModelo), execSlideFirmeza(execModelo), execSlideCiclo(execModelo),
    ];
    const nome = `dashboard-executivo-${execModelo.ciclos.ciclo}-${new Date().toISOString().slice(0, 10)}.pptx`;
    downloadBlobFile(nome, pptxGerar(slides));
    showToast(`Apresentação gerada: ${nome} · ${slides.length} slides`, "success");
  });

  Promise.all([
    carregarRef("inputs.json"),
    carregarRef("cronograma.json"),
    carregarRef("entregas.json").catch(() => null),
    carregarRef("aprovacoes.json").catch(() => null),
  ])
    .then(([inputs, crono, entregas, aprov]) => {
      dados = { inputs, crono, entregas, aprov };

      const sel = document.querySelector('[data-exec-filtro="bu"]');
      [...new Set(inputs.inputs.map((i) => i.bu))].sort().forEach((bu) => {
        const o = document.createElement("option");
        o.value = bu;
        o.textContent = bu;
        sel.appendChild(o);
      });

      desenhar();
    })
    .catch(() => {
      document.querySelector("[data-exec-kpis]").innerHTML =
        '<div class="empty-hint">Não foi possível carregar os números do ciclo.</div>';
    });
}

document.addEventListener("DOMContentLoaded", () => {
  markActiveNav();
  initModals();
  initSimulatedActions();
  initAddRow();
  initTabs();
  initSidebarToggle();
  initDrillRows();
  initExcelPaste();
  initMonthGroup();
  initHierarchyCollapse();
  initDashboardExport();
  initPdfExport();
  initEntregas();
  initPacotes();
  initAprovacoes();
  initAtivacao();
  initReajuste();
  initCronograma();
  initPremissas();
  initFormLancamento();
  initNotificacoes();
  initAuditoria();
  initImportacao();
  initCorrecoes();
  initCapex();
  initVersaoBarra();
  initStatusCiclo();
  initDashboardExecutivo();
  renderResumoLancamentos();
  initReferenceAutocomplete();
});
