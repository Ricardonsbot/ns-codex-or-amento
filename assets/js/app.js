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

  fetch("Referencias/entregas.json")
    .then((r) => r.json())
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

  fetch("Referencias/pacotes.json")
    .then((r) => r.json())
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

  fetch("Referencias/aprovacoes.json")
    .then((r) => r.json())
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

  fetch("Referencias/ativacao.json")
    .then((r) => r.json())
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
  initDashboardExport();
  initPdfExport();
  initEntregas();
  initPacotes();
  initAprovacoes();
  initAtivacao();
  initReferenceAutocomplete();
});
