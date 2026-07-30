/*
 * app.js — comportamento de PROTÓTIPO.
 * Nenhuma chamada de rede/backend acontece aqui: os botões apenas simulam
 * o que a ação faria (toast de feedback, mudança de badge, linha de tabela
 * adicionada/removida na tela) para dar a sensação do fluxo real.
 */

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
      rebindRow(clone);
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
    fetch("Referencias/contas.json").then((r) => r.json()).catch(() => []),
    fetch("Referencias/organizacional.json").then((r) => r.json()).catch(() => []),
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

/* ---------- Sidebar: marca item ativo pela página atual ---------- */

function markActiveNav() {
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    if (item.getAttribute("data-page") === current) {
      item.classList.add("active");
    }
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
  initReferenceAutocomplete();
});
