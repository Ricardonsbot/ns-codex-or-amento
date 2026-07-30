/*
 * app.js — comportamento de PROTÓTIPO.
 * Nenhuma chamada de rede/backend acontece aqui: os botões apenas simulam
 * o que a ação faria (toast de feedback, mudança de badge, linha de tabela
 * adicionada/removida na tela) para dar a sensação do fluxo real.
 *
 * Única exceção: a exportação do Dashboard em PDF, que imprime a própria
 * página — sem backend e sem biblioteca, só o @media print do style.css.
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

/* ---------- Exportar o Dashboard em PDF ----------
 * PDF = impressão do próprio HTML. Sem biblioteca: o papel usa o @media print
 * do style.css, então sai igual à tela. O usuário escolhe "Salvar como PDF".
 */

function initPdfExport() {
  document.querySelectorAll("[data-export-pdf]").forEach((el) => {
    el.addEventListener("click", () => {
      showToast('Abrindo a impressão — escolha "Salvar como PDF" no destino', "info");
      setTimeout(() => window.print(), 200);
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
  initPdfExport();
  initEntregas();
  initReferenceAutocomplete();
});
