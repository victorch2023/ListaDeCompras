import { clearAllMarks, configured, setMark, suggestProduct, watchCatalog } from "./db.js";

"use strict";

const state = {
  boot: "",
  rev: -1,
  fresh: false,
  sections: [],
  products: [],
  items: {},
  presence: 1,
  connected: false,
  filter: "all",
  query: "",
};

const override = new Map();

const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const clearSearchEl = document.getElementById("clear-search");
const filterAllEl = document.getElementById("filter-all");
const filterMarkedEl = document.getElementById("filter-marked");
const markedCountEl = document.getElementById("marked-count");
const summaryEl = document.getElementById("summary");
const clearMarksEl = document.getElementById("clear-marks");
const dialogEl = document.getElementById("confirm-clear");
const stickyEl = document.querySelector(".sticky-top");

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sectionById(id) {
  return (
    state.sections.find((section) => section.id === id) || {
      id,
      name: "Sin sección",
      color: "#1c1917",
    }
  );
}

function viewItem(id) {
  const local = override.get(id);
  if (local) return { marked: local.marked, qty: local.qty, bought: local.bought };
  const stored = state.items[id];
  if (!stored) return { marked: false, qty: 1, bought: false };
  return { marked: Boolean(stored.marked), qty: stored.qty || 1, bought: Boolean(stored.bought) };
}

function markedStats() {
  let products = 0;
  let units = 0;
  let bought = 0;
  for (const product of state.products) {
    const item = viewItem(product.id);
    if (!item.marked) continue;
    products += 1;
    units += item.qty;
    if (item.bought) bought += 1;
  }
  return { products, units, bought, pending: products - bought };
}

function summaryText(stats) {
  if (stats.products === 0) return "Nada marcado todavía. Al marcar un producto, la cantidad es 1.";
  const productLabel = stats.products === 1 ? "1 producto" : `${stats.products} productos`;
  const unitLabel = stats.units === 1 ? "1 unidad" : `${stats.units} unidades`;
  if (stats.bought === 0) return `${productLabel} · ${unitLabel}`;
  if (stats.pending === 0) return `${productLabel} · ${unitLabel} · todo comprado`;
  const boughtLabel = stats.bought === 1 ? "1 comprado" : `${stats.bought} comprados`;
  return `${productLabel} · ${unitLabel} · ${boughtLabel}`;
}

function renderPresence() {
  const root = document.getElementById("presence");
  const text = document.getElementById("presence-text");
  root.classList.toggle("is-off", !state.connected);
  text.textContent = state.connected ? "En vivo" : "Reconectando…";
}

function visibleProducts() {
  const query = norm(state.query.trim());
  return state.products.filter((product) => {
    const item = viewItem(product.id);
    if (state.filter === "marked" && (!item.marked || item.bought)) return false;
    if (query && !norm(product.name).includes(query)) return false;
    return true;
  });
}

function checkIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M5 12.5 9.2 17 19 7");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2.6");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

function renderList() {
  const products = visibleProducts();
  const fragment = document.createDocumentFragment();
  if (products.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    const title = document.createElement("strong");
    const detail = document.createElement("p");
    const anyMarked = state.products.some((product) => viewItem(product.id).marked);
    if (state.query.trim()) {
      title.textContent = "No hay productos con ese nombre.";
      detail.textContent = "Prueba con otra palabra.";
    } else if (state.filter === "marked" && anyMarked) {
      title.textContent = "Ya está todo comprado.";
      detail.textContent = "Lo comprado sigue visible en Todos, tachado.";
    } else {
      title.textContent = "Nada marcado todavía.";
      detail.textContent = "Toca el recuadro de un producto para agregarlo a la compra.";
    }
    empty.append(title, detail);
    fragment.append(empty);
  }

  let lastSection = null;
  let head = null;
  let shown = 0;
  let shownMarked = 0;

  const closeGroup = () => {
    if (!head) return;
    head.querySelector("span").textContent =
      shownMarked > 0 ? `${shownMarked} de ${shown}` : String(shown);
  };

  for (const product of products) {
    const groupId = product.pending ? "inbox" : product.sectionId;
    if (groupId !== lastSection) {
      closeGroup();
      lastSection = groupId;
      shown = 0;
      shownMarked = 0;
      const section = product.pending
        ? { id: "inbox", name: "Agregados", color: "#9a3412" }
        : sectionById(product.sectionId);
      head = document.createElement("div");
      head.className = "section-head";
      head.style.setProperty("--accent", section.color);
      const name = document.createElement("strong");
      name.textContent = section.name;
      const meta = document.createElement("span");
      head.append(name, meta);
      fragment.append(head);
    }

    const item = viewItem(product.id);
    shown += 1;
    if (item.marked) shownMarked += 1;
    const section = product.pending
      ? { id: "inbox", name: "Agregados", color: "#9a3412" }
      : sectionById(product.sectionId);
    const row = document.createElement("article");
    row.className = "row";
    if (item.marked) row.classList.add("is-marked");
    if (item.bought) row.classList.add("is-bought");
    row.dataset.id = product.id;
    row.style.setProperty("--accent", section.color);

    const check = document.createElement("button");
    check.type = "button";
    check.className = "check";
    check.dataset.action = "toggle";
    check.setAttribute("aria-pressed", item.marked ? "true" : "false");
    check.setAttribute("aria-label", item.marked ? `Quitar ${product.name}` : `Marcar ${product.name}`);
    check.append(checkIcon());

    const name = document.createElement("button");
    name.type = "button";
    name.className = "name-btn";
    name.dataset.action = "toggle";
    name.textContent = product.name;

    const qtyCell = document.createElement("div");
    qtyCell.className = "qty-cell";
    if (item.marked) {
      const stepper = document.createElement("div");
      stepper.className = "stepper";
      const minus = document.createElement("button");
      minus.type = "button";
      minus.dataset.action = "minus";
      minus.textContent = "−";
      minus.disabled = item.qty <= 1;
      minus.setAttribute("aria-label", `Bajar cantidad de ${product.name}`);
      const input = document.createElement("input");
      input.className = "qty-input";
      input.dataset.id = product.id;
      input.type = "number";
      input.inputMode = "numeric";
      input.min = "1";
      input.max = "999";
      input.value = String(item.qty);
      input.setAttribute("aria-label", `Cantidad de ${product.name}`);
      const plus = document.createElement("button");
      plus.type = "button";
      plus.dataset.action = "plus";
      plus.textContent = "+";
      plus.disabled = item.qty >= 999;
      plus.setAttribute("aria-label", `Subir cantidad de ${product.name}`);
      stepper.append(minus, input, plus);
      qtyCell.append(stepper);
    }

    const boughtCell = document.createElement("div");
    boughtCell.className = "bought-cell";
    const bought = document.createElement("button");
    bought.type = "button";
    bought.className = "bought";
    bought.dataset.action = "bought";
    bought.disabled = !item.marked;
    bought.setAttribute("aria-pressed", item.bought ? "true" : "false");
    bought.setAttribute(
      "aria-label",
      item.bought ? `Quitar comprado de ${product.name}` : `Marcar ${product.name} como comprado`
    );
    bought.append(checkIcon());
    boughtCell.append(bought);

    row.append(check, name, qtyCell, boughtCell);
    fragment.append(row);
  }
  closeGroup();
  listEl.replaceChildren(fragment);
}

function paint() {
  const active = document.activeElement;
  const editing =
    active && active.classList && active.classList.contains("qty-input")
      ? {
          id: active.dataset.id,
          value: active.value,
          start: active.selectionStart,
          end: active.selectionEnd,
        }
      : null;

  const stats = markedStats();
  markedCountEl.textContent = String(stats.pending);
  summaryEl.textContent = summaryText(stats);
  clearMarksEl.disabled = stats.products === 0;
  document.title = stats.pending ? `(${stats.pending}) Compras` : "Compras";
  filterAllEl.classList.toggle("is-active", state.filter === "all");
  filterMarkedEl.classList.toggle("is-active", state.filter === "marked");
  filterAllEl.setAttribute("aria-selected", state.filter === "all" ? "true" : "false");
  filterMarkedEl.setAttribute("aria-selected", state.filter === "marked" ? "true" : "false");
  renderList();
  renderPresence();

  if (!editing) return;
  const next = listEl.querySelector(`.qty-input[data-id="${CSS.escape(editing.id)}"]`);
  if (!next) return;
  next.value = editing.value;
  next.focus();
  if (editing.start != null && next.setSelectionRange) {
    next.setSelectionRange(editing.start, editing.end);
  }
}

let renderFrame = 0;
function render() {
  if (renderFrame) return;
  renderFrame = 1;
  const run = () => {
    if (!renderFrame) return;
    renderFrame = 0;
    paint();
  };
  requestAnimationFrame(run);
  setTimeout(run, 48);
}

function applySnapshot(payload) {
  if (!payload || !Array.isArray(payload.products)) return;
  if (state.fresh) {
    state.rev = -1;
    state.fresh = false;
  }
  if (typeof payload.rev === "number") {
    if (payload.rev < state.rev) return;
    if (payload.rev === state.rev) return;
    state.rev = payload.rev;
  }
  state.boot = payload.boot || state.boot;
  state.sections = payload.sections.slice().sort((a, b) => a.order - b.order);
  state.products = payload.products.slice().sort((a, b) => {
    if (Boolean(a.pending) !== Boolean(b.pending)) return a.pending ? 1 : -1;
    return a.order - b.order;
  });
  state.items = payload.items || {};
  if (typeof payload.presence === "number") state.presence = payload.presence;
  render();
}

let bannerTimer;
function showBanner(text) {
  const banner = document.getElementById("banner");
  banner.hidden = false;
  banner.textContent = text;
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => {
    banner.hidden = true;
  }, 4200);
}

async function commit(id, marked, qty, bought) {
  const safeQty = Math.min(999, Math.max(1, qty));
  const previous = viewItem(id);
  const nextBought = Boolean(marked) && (bought == null ? previous.bought : bought);
  const current = override.get(id);
  override.set(id, {
    marked,
    qty: safeQty,
    bought: nextBought,
    pending: (current?.pending || 0) + 1,
  });
  render();
  try {
    const data = await setMark(id, marked, safeQty, nextBought);
    const entry = override.get(id);
    if (entry) {
      entry.pending -= 1;
      if (entry.pending <= 0) override.delete(id);
    }
    applySnapshot(data);
    render();
  } catch (error) {
    const entry = override.get(id);
    if (entry) {
      entry.pending -= 1;
      if (entry.pending <= 0) override.delete(id);
    }
    showBanner(error.message || "No se pudo guardar");
    render();
  }
}

async function clearMarks() {
  override.clear();
  state.items = {};
  render();
  try {
    applySnapshot(await clearAllMarks());
  } catch (error) {
    showBanner(error.message || "No se pudo vaciar la lista");
  }
}

function connect() {
  watchCatalog((payload) => {
    state.connected = !payload.error;
    if (payload.error) showBanner(payload.error);
    applySnapshot(payload);
    renderPresence();
  });
}

listEl.addEventListener("click", (event) => {
  const row = event.target.closest(".row");
  if (!row) return;
  const id = row.dataset.id;
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  event.preventDefault();
  const item = viewItem(id);
  if (action === "toggle") commit(id, !item.marked, item.qty, false);
  if (action === "plus") commit(id, true, Math.min(999, item.qty + 1));
  if (action === "minus" && item.qty > 1) commit(id, true, item.qty - 1);
  if (action === "bought" && item.marked) commit(id, true, item.qty, !item.bought);
});

let qtyTimer;
listEl.addEventListener("input", (event) => {
  const input = event.target;
  if (!input.classList.contains("qty-input")) return;
  window.clearTimeout(qtyTimer);
  qtyTimer = window.setTimeout(() => {
    const parsed = Number.parseInt(input.value, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) return;
    const item = viewItem(input.dataset.id);
    if (item.marked && item.qty === parsed) return;
    commit(input.dataset.id, true, parsed);
  }, 280);
});

listEl.addEventListener("focusout", (event) => {
  const input = event.target;
  if (!input.classList.contains("qty-input")) return;
  const parsed = Number.parseInt(input.value, 10);
  const item = viewItem(input.dataset.id);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) {
    input.value = String(item.qty);
  }
});

listEl.addEventListener("wheel", (event) => {
  if (event.target.classList.contains("qty-input")) event.target.blur();
}, { passive: true });

searchEl.addEventListener("input", () => {
  state.query = searchEl.value;
  clearSearchEl.hidden = state.query.length === 0;
  render();
});

clearSearchEl.addEventListener("click", () => {
  searchEl.value = "";
  state.query = "";
  clearSearchEl.hidden = true;
  searchEl.focus();
  render();
});

filterAllEl.addEventListener("click", () => {
  state.filter = "all";
  render();
});

filterMarkedEl.addEventListener("click", () => {
  state.filter = "marked";
  render();
});

clearMarksEl.addEventListener("click", () => {
  if (typeof dialogEl.showModal === "function") dialogEl.showModal();
  else if (window.confirm("¿Quitar todas las marcas? Los productos siguen en la lista.")) clearMarks();
});

dialogEl.addEventListener("close", () => {
  if (dialogEl.returnValue === "ok") clearMarks();
});

const suggestForm = document.getElementById("suggest-form");
const suggestName = document.getElementById("suggest-name");
const suggestNote = document.getElementById("suggest-note");

suggestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = suggestName.value.trim();
  if (!name) return;
  const button = suggestForm.querySelector("button");
  button.disabled = true;
  suggestNote.textContent = "";
  try {
    const data = await suggestProduct(name);
    suggestName.value = "";
    state.filter = "all";
    state.query = "";
    searchEl.value = "";
    clearSearchEl.hidden = true;
    applySnapshot(data);
    suggestNote.textContent = data.created
      ? "Quedó al final, marcado con cantidad 1. El dueño lo acomoda después en su lugar."
      : "Ese producto ya estaba en la lista y quedó marcado.";
    window.setTimeout(() => {
      const row = listEl.querySelector(`.row[data-id="${CSS.escape(data.focusId || "")}"]`);
      if (row) row.scrollIntoView({ block: "center" });
    }, 80);
  } catch (error) {
    suggestNote.textContent = error.message || "No se pudo agregar";
  } finally {
    button.disabled = false;
    suggestName.focus();
  }
});

if (window.ResizeObserver && stickyEl) {
  const observer = new ResizeObserver(() => {
    document.documentElement.style.setProperty("--sticky-h", `${stickyEl.offsetHeight}px`);
  });
  observer.observe(stickyEl);
}

if (!configured()) {
  document.querySelector(".sheet").hidden = true;
  document.getElementById("setup").hidden = false;
} else {
  connect();
}
