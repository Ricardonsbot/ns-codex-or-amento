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

function initReferenceAutocomplete() {
  const contasDatalist = document.getElementById("contas-datalist");
  const centrosDatalist = document.getElementById("centros-datalist");
  if (!contasDatalist && !centrosDatalist) return;

  Promise.all([
    carregarRef("contas.json").catch(() => []),
    carregarRef("organizacional.json").catch(() => []),
  ]).then(([contas, organizacional]) => {
    window.__contasRef = contas;

    if (contasDatalist) {
      contas.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.nome;
        contasDatalist.appendChild(opt);
      });
    }

    if (centrosDatalist) {
      const unidades = new Set(["Comercial", "Operações", "TI", "G&A", "S&M", "R&D"]);
      organizacional.forEach((o) => {
        if (o.torre && o.torre !== "-") unidades.add(o.torre);
      });
      unidades.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u;
        centrosDatalist.appendChild(opt);
      });
    }

    document.querySelectorAll(".conta-nome-input").forEach(bindContaLookup);
  });
}

function bindContaLookup(input) {
  input.addEventListener("change", () => {
    const match = (window.__contasRef || []).find((c) => c.nome === input.value);
    if (!match) return;
    const row = input.closest("tr");
    const codigoInput = row?.querySelector(".conta-codigo-input");
    const linhaInput = row?.querySelector(".conta-linha-input");
    const categoriaInput = row?.querySelector(".conta-categoria-input");
    if (codigoInput) codigoInput.value = match.conta;
    if (linhaInput) linhaInput.value = match.linhaPL;
    if (categoriaInput) categoriaInput.value = match.categoria;
    showToast(`Conta "${match.nome}" reconhecida — código e classificação preenchidos`, "success");
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
      const text = row.children[i]?.textContent.trim() || "";
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
      push(field.querySelector("label")?.textContent, field.querySelector("select")?.value);
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

  const filtros = { bu: "", categoria: "", status: "pendente", situacao: "", aceite: "" };
  let dados = null;
  let regrasPorCodigo = {};
  let selecionado = null;

  function visiveis() {
    return dados.submissoes.filter((sub) => {
      if (filtros.bu && sub.bu !== filtros.bu) return false;
      if (filtros.categoria && sub.categoria !== filtros.categoria) return false;
      if (filtros.status && sub.statusOficial !== filtros.status) return false;

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

    const aprovadasLista = todas.filter((s) => s.statusOficial === "aprovado");
    const aprovadas = aprovadasLista.length;
    const reprovadas = todas.filter((s) => s.statusOficial === "reprovado").length;
    conta("decididas", aprovadas + reprovadas);
    conta("decididas-detalhe", `${aprovadas} aprovadas · ${reprovadas} reprovadas`);

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

    const travado = bloqueios.length > 0;
    const motivoTrava = travado
      ? `<div class="aprov-trava">Aprovação bloqueada: ${bloqueios.map((b) => escaparTexto(regrasPorCodigo[b.regra].nome)).join(", ")}. Corrija na tela de lançamento ou devolva para ajuste.</div>`
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

  detalhe.addEventListener("click", (e) => {
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

  document.querySelectorAll("[data-aprov-filtro]").forEach((select) => {
    select.addEventListener("change", () => {
      filtros[select.getAttribute("data-aprov-filtro")] = select.value;
      redesenhar();
    });
  });

  carregarRef("aprovacoes.json")
    .then((json) => {
      dados = json;
      json.regras.forEach((regra) => { regrasPorCodigo[regra.codigo] = regra; });

      const selectBu = document.querySelector('[data-aprov-filtro="bu"]');
      if (selectBu) {
        Array.from(new Set(json.submissoes.map((s) => s.bu))).forEach((bu) => {
          const opt = document.createElement("option");
          opt.value = bu;
          opt.textContent = bu;
          selectBu.appendChild(opt);
        });
      }

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

function initStatusCiclo() {
  const alvo = document.querySelector("[data-status-ciclo]");
  if (!alvo) return;

  Promise.all([
    carregarRef("cronograma.json"),
    carregarRef("entregas.json").catch(() => null),
    carregarRef("aprovacoes.json").catch(() => null),
  ])
    .then(([crono, entregasDoc, aprov]) => {
      const hoje = hojeISO();

      // ---- 1. versão vigente
      const versao = `<a class="status-card" href="budget-settings.html">
          <span class="status-rot">Versão vigente</span>
          <strong class="status-valor">${escaparTexto(crono.versaoAtiva)}</strong>
          <span class="status-linha">Ciclo ${escaparTexto(crono.ciclo)} · ${escaparTexto(crono.versaoTipo || "—")}</span>
          <span class="status-nota">em edição desde ${dataBR(crono.versaoDesde)}</span>
        </a>`;

      // ---- 2. pendências
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

      const temPendencia = faltando + aguardandoDecisao + aguardandoAceite > 0;
      const grau = atrasadas ? "ruim" : temPendencia ? "atencao" : "bom";

      const pendencias = `<div class="status-card ${grau}">
          <span class="status-rot">Ainda tem pendência?</span>
          <strong class="status-valor">${temPendencia ? "Sim" : "Não"}</strong>
          <span class="status-linhas">
            <a href="entregas.html">${faltando} entrega(s) por lançar${atrasadas ? ` · <strong>${atrasadas} atrasada(s)</strong>` : ""}</a>
            <a href="aprovacoes.html">${aguardandoDecisao} aguardando decisão do aprovador</a>
            <a href="aprovacoes.html">${aguardandoAceite} aguardando aceite do líder</a>
          </span>
        </div>`;

      // ---- 3. encerramento
      const marcos = crono.marcos.slice().sort((a, b) => (a.data < b.data ? -1 : 1));
      const fim = marcos[marcos.length - 1];
      const proximo = marcos.find((m) => diasEntre(hoje, m.data) >= 0);
      const diasFim = diasEntre(hoje, fim.data);

      const encerramento = `<a class="status-card ${diasFim <= 15 ? "atencao" : ""}" href="budget-settings.html">
          <span class="status-rot">Quando encerra</span>
          <strong class="status-valor">${dataBR(fim.data)}</strong>
          <span class="status-linha">${escaparTexto(fim.nome)} · faltam <strong>${diasFim} dia(s)</strong></span>
          <span class="status-nota">${proximo && proximo !== fim
            ? `Próximo corte: ${escaparTexto(proximo.nome)}, em ${diasEntre(hoje, proximo.data)} dia(s)`
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

    MESES_CURTOS.forEach((mes, i) => {
      const label = document.createElement("label");
      label.className = "reajuste-mes";
      label.innerHTML = `<input type="checkbox" data-mes="${i}" /><span>${mes}</span>`;
      caixaMeses.appendChild(label);

      const campo = document.createElement("label");
      campo.className = "mes-variavel";
      campo.innerHTML = `<span>${mes}</span><input type="number" data-mes-valor="${i}" value="0" min="0" />`;
      caixaVariavel.appendChild(campo);

      selectMes.appendChild(new Option(mes, String(i)));
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

    form.querySelector("[data-form-limpar]").addEventListener("click", () => {
      form.reset();
      trocarPhasing(false);
      caixaMeses.querySelectorAll("input").forEach((c) => { c.checked = false; });
      caixaVariavel.querySelectorAll("input").forEach((i) => { i.value = 0; });
      form.querySelectorAll(".cartao-pacote").forEach((c) => c.classList.remove("escolhido"));
      pacoteEscolhido = "";
      erro.hidden = true;
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

/* ---------- Init ---------- */

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
  initStatusCiclo();
  renderResumoLancamentos();
  initReferenceAutocomplete();
});
