import {
  addProduct,
  addSection,
  changePassword,
  clearAllMarks,
  configured,
  deleteProduct,
  deleteSection,
  loadSeed,
  logOut,
  ownerEmail,
  placeProduct,
  reorderProducts,
  signIn,
  updateProduct,
  updateSection,
  watchAuth,
  watchCatalog,
} from "./db.js";

"use strict";

const state = { rev: -1, ready: false, sections: [], products: [], items: {} };

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const productsEl = document.getElementById("products");
const inboxEl = document.getElementById("inbox");
const inboxBlock = document.getElementById("inbox-block");
const inboxCount = document.getElementById("inbox-count");
const sectionsEl = document.getElementById("sections");
const addSectionSelect = document.getElementById("add-section");
const sectionFilter = document.getElementById("section-filter");
const adminSearch = document.getElementById("admin-search");
const productCount = document.getElementById("product-count");

let dragId = null;

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function showLogin() {
  appView.hidden = true;
  loginView.hidden = false;
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
}

let toastTimer;
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 2400);
}

function sectionLabel(section) {
  const duplicates = state.sections.filter((item) => item.name === section.name).length > 1;
  if (!duplicates) return section.name;
  const first = state.products.find((product) => product.sectionId === section.id);
  return first ? `${section.name} · desde ${first.name}` : section.name;
}

function placedProducts() {
  return state.products.filter((product) => !product.pending);
}

function pendingProducts() {
  const query = norm(adminSearch.value.trim());
  return state.products.filter((product) => {
    if (!product.pending) return false;
    if (query && !norm(product.name).includes(query)) return false;
    return true;
  });
}

function visibleProducts() {
  const query = norm(adminSearch.value.trim());
  const sectionId = sectionFilter.value;
  return placedProducts().filter((product) => {
    if (sectionId && product.sectionId !== sectionId) return false;
    if (query && !norm(product.name).includes(query)) return false;
    return true;
  });
}

function requestLabel(id) {
  const item = state.items[id];
  if (!item || !item.marked) return "Sin pedido todavía";
  const units = item.qty === 1 ? "1 unidad pedida" : `${item.qty} unidades pedidas`;
  return item.bought ? `${units} · ya comprado` : units;
}

function fillSelects() {
  const selectedAdd = addSectionSelect.value;
  const selectedFilter = sectionFilter.value;
  addSectionSelect.replaceChildren();
  sectionFilter.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "Todas las secciones";
  sectionFilter.append(all);
  for (const section of state.sections) {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = sectionLabel(section);
    addSectionSelect.append(option);
    sectionFilter.append(option.cloneNode(true));
  }
  if ([...addSectionSelect.options].some((option) => option.value === selectedAdd)) {
    addSectionSelect.value = selectedAdd;
  }
  if ([...sectionFilter.options].some((option) => option.value === selectedFilter)) {
    sectionFilter.value = selectedFilter;
  }
}

function renderProducts() {
  const visible = visibleProducts();
  const visibleIds = visible.map((product) => product.id);
  const fragment = document.createDocumentFragment();
  const head = document.createElement("div");
  head.className = "prow head";
  for (const label of ["", "Nº", "Producto", "Sección", ""]) {
    const span = document.createElement("span");
    span.textContent = label;
    head.append(span);
  }
  fragment.append(head);

  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No hay productos para mostrar.";
    fragment.append(empty);
  }

  const placed = placedProducts();
  visible.forEach((product) => {
    const globalIndex = placed.findIndex((item) => item.id === product.id);
    const row = document.createElement("div");
    row.className = "prow";
    row.dataset.id = product.id;

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "handle";
    handle.draggable = true;
    handle.textContent = "⋮⋮";
    handle.setAttribute("aria-label", `Arrastrar ${product.name}`);

    const pos = document.createElement("input");
    pos.className = "pos-input";
    pos.type = "number";
    pos.min = "1";
    pos.max = String(placed.length);
    pos.value = String(globalIndex + 1);
    pos.setAttribute("aria-label", `Posición de ${product.name}`);

    const name = document.createElement("input");
    name.className = "name-input";
    name.type = "text";
    name.maxLength = 80;
    name.value = product.name;
    name.autocomplete = "off";
    name.setAttribute("aria-label", `Nombre de ${product.name}`);

    const select = document.createElement("select");
    select.setAttribute("aria-label", `Sección de ${product.name}`);
    for (const section of state.sections) {
      const option = document.createElement("option");
      option.value = section.id;
      option.textContent = sectionLabel(section);
      option.selected = section.id === product.sectionId;
      select.append(option);
    }

    const actions = document.createElement("div");
    actions.className = "row-actions";
    const visibleIndex = visibleIds.indexOf(product.id);
    actions.append(
      iconButton("up", "↑", `Subir ${product.name}`, visibleIndex <= 0),
      iconButton("down", "↓", `Bajar ${product.name}`, visibleIndex === visibleIds.length - 1),
      iconButton("delete", "✕", `Eliminar ${product.name}`, false, true)
    );

    row.append(handle, pos, name, select, actions);
    fragment.append(row);
  });

  productsEl.replaceChildren(fragment);
  const pendingCount = state.products.filter((product) => product.pending).length;
  productCount.textContent = pendingCount
    ? `${placed.length} en la lista · ${pendingCount} por ubicar`
    : `${placed.length} productos`;
}

function renderInbox() {
  const pending = pendingProducts();
  const total = state.products.filter((product) => product.pending).length;
  inboxBlock.hidden = total === 0;
  inboxCount.textContent = total === 1 ? "1 producto" : `${total} productos`;
  const fragment = document.createDocumentFragment();
  if (total > 0 && pending.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "Ninguno coincide con la búsqueda.";
    fragment.append(empty);
  }
  for (const product of pending) {
    const row = document.createElement("form");
    row.className = "inbox-row";
    row.dataset.id = product.id;

    const name = document.createElement("div");
    const title = document.createElement("div");
    title.className = "inbox-name";
    title.textContent = product.name;
    const meta = document.createElement("div");
    meta.className = "inbox-meta";
    meta.textContent = requestLabel(product.id);
    name.append(title, meta);

    const select = document.createElement("select");
    select.name = "section";
    select.setAttribute("aria-label", `Sección para ${product.name}`);
    for (const section of state.sections) {
      const option = document.createElement("option");
      option.value = section.id;
      option.textContent = sectionLabel(section);
      select.append(option);
    }

    const position = document.createElement("input");
    position.name = "position";
    position.className = "pos-input";
    position.type = "number";
    position.min = "1";
    position.inputMode = "numeric";
    position.placeholder = "Al final";
    position.setAttribute("aria-label", `Lugar de ${product.name} en la sección`);

    const place = document.createElement("button");
    place.className = "btn primary";
    place.type = "submit";
    place.textContent = "Colocar";

    const remove = document.createElement("button");
    remove.className = "btn ghost";
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.textContent = "Quitar";

    row.append(name, select, position, place, remove);
    fragment.append(row);
  }
  inboxEl.replaceChildren(fragment);
}

function iconButton(action, text, label, disabled, danger) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = danger ? "icon-btn danger" : "icon-btn";
  button.dataset.action = action;
  button.textContent = text;
  button.disabled = disabled;
  button.setAttribute("aria-label", label);
  return button;
}

function renderSections() {
  const fragment = document.createDocumentFragment();
  for (const section of state.sections) {
    const count = state.products.filter((product) => product.sectionId === section.id).length;
    const row = document.createElement("div");
    row.className = "srow";
    row.dataset.id = section.id;

    const color = document.createElement("input");
    color.type = "color";
    color.value = section.color;
    color.setAttribute("aria-label", `Color de ${section.name}`);

    const name = document.createElement("input");
    name.className = "section-name";
    name.type = "text";
    name.maxLength = 80;
    name.value = section.name;
    name.setAttribute("aria-label", `Nombre de la sección ${section.name}`);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-btn danger";
    button.dataset.action = "delete-section";
    button.textContent = "✕";
    button.setAttribute("aria-label", `Eliminar sección ${section.name}`);
    button.title = count ? `${count} productos` : "Eliminar sección";

    row.append(color, name, button);
    fragment.append(row);
  }
  sectionsEl.replaceChildren(fragment);
}

function render() {
  fillSelects();
  renderInbox();
  renderProducts();
  renderSections();
  const seedButton = document.getElementById("load-seed");
  if (seedButton) seedButton.hidden = state.products.length > 0 || state.sections.length > 0;
}

function applySnapshot(payload) {
  if (!payload || !Array.isArray(payload.products)) return;
  if (typeof payload.rev === "number") {
    if (payload.rev < state.rev) return;
    if (payload.rev === state.rev && state.ready) return;
    state.rev = payload.rev;
  }
  state.ready = true;
  state.sections = payload.sections.slice().sort((a, b) => a.order - b.order);
  state.products = payload.products.slice().sort((a, b) => {
    if (Boolean(a.pending) !== Boolean(b.pending)) return a.pending ? 1 : -1;
    return a.order - b.order;
  });
  state.items = payload.items || {};
  render();
}

async function reorder(ids) {
  applySnapshot(await reorderProducts(ids));
  toast("Orden guardado");
}

function idsSwapping(id, delta) {
  const visible = visibleProducts();
  const index = visible.findIndex((product) => product.id === id);
  const neighbor = visible[index + delta];
  if (!neighbor) return null;
  const ids = placedProducts().map((product) => product.id);
  const from = ids.indexOf(id);
  const to = ids.indexOf(neighbor.id);
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

function idsMovedTo(id, position) {
  const ids = placedProducts().map((product) => product.id);
  const from = ids.indexOf(id);
  const to = Math.max(0, Math.min(ids.length - 1, position - 1));
  if (from === to) return null;
  ids.splice(from, 1);
  ids.splice(to, 0, id);
  return ids;
}

function idsFromVisible(nextVisible) {
  const queue = [...nextVisible];
  const visible = new Set(queue);
  return placedProducts().map((product) => (visible.has(product.id) ? queue.shift() : product.id));
}

adminSearch.addEventListener("input", () => {
  renderInbox();
  renderProducts();
});
sectionFilter.addEventListener("change", renderProducts);

inboxEl.addEventListener("submit", async (event) => {
  const row = event.target.closest(".inbox-row");
  if (!row) return;
  event.preventDefault();
  const id = row.dataset.id;
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  const sectionId = row.elements.section.value;
  const raw = row.elements.position.value.trim();
  const body = { sectionId };
  if (raw) body.position = Number.parseInt(raw, 10);
  try {
    applySnapshot(await placeProduct(id, body));
    const section = state.sections.find((item) => item.id === sectionId);
    toast(section ? `${product.name} quedó en ${section.name}` : "Producto ubicado");
  } catch (error) {
    toast(error.message);
  }
});

inboxEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action='delete']");
  if (!button) return;
  const row = button.closest(".inbox-row");
  const product = state.products.find((item) => item.id === row?.dataset.id);
  if (!product) return;
  if (!window.confirm(`¿Quitar «${product.name}» de la lista?`)) return;
  try {
    applySnapshot(await deleteProduct(product.id));
    toast("Producto quitado");
  } catch (error) {
    toast(error.message);
  }
});

productsEl.addEventListener("click", async (event) => {
  const row = event.target.closest(".prow");
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!row || !action) return;
  const id = row.dataset.id;
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  try {
    if (action === "delete") {
      if (!window.confirm(`¿Eliminar «${product.name}» de la lista?`)) return;
      applySnapshot(await deleteProduct(id));
      toast("Producto eliminado");
      return;
    }
    const ids = action === "up" ? idsSwapping(id, -1) : action === "down" ? idsSwapping(id, 1) : null;
    if (ids) await reorder(ids);
  } catch (error) {
    toast(error.message);
  }
});

productsEl.addEventListener("change", async (event) => {
  const row = event.target.closest(".prow");
  if (!row) return;
  const id = row.dataset.id;
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  try {
    if (event.target.classList.contains("name-input")) {
      const name = event.target.value;
      if (name.trim() === product.name) return;
      applySnapshot(await updateProduct(id, { name }));
      toast("Nombre guardado");
    } else if (event.target.tagName === "SELECT") {
      applySnapshot(await updateProduct(id, { sectionId: event.target.value }));
      toast("Sección actualizada");
    } else if (event.target.classList.contains("pos-input")) {
      const position = Number.parseInt(event.target.value, 10);
      if (!Number.isInteger(position)) return;
      const ids = idsMovedTo(id, position);
      if (ids) await reorder(ids);
    }
  } catch (error) {
    toast(error.message);
    render();
  }
});

productsEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.classList.contains("name-input")) {
    event.preventDefault();
    event.target.blur();
  }
});

productsEl.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".prow");
  if (!row || !event.target.classList.contains("handle")) return;
  dragId = row.dataset.id;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", dragId);
  row.classList.add("is-dragging");
});

productsEl.addEventListener("dragover", (event) => {
  const row = event.target.closest(".prow");
  if (!row || !dragId || row.dataset.id === dragId || row.classList.contains("head")) return;
  event.preventDefault();
  const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
  productsEl.querySelectorAll(".prow").forEach((item) => item.classList.remove("drop-before", "drop-after"));
  row.classList.add(before ? "drop-before" : "drop-after");
});

productsEl.addEventListener("drop", async (event) => {
  const row = event.target.closest(".prow");
  if (!row || !dragId) return;
  event.preventDefault();
  const before = row.classList.contains("drop-before");
  const next = visibleProducts()
    .map((product) => product.id)
    .filter((id) => id !== dragId);
  let index = next.indexOf(row.dataset.id);
  if (index < 0) index = next.length;
  if (!before) index += 1;
  next.splice(index, 0, dragId);
  dragId = null;
  try {
    await reorder(idsFromVisible(next));
  } catch (error) {
    toast(error.message);
  }
});

productsEl.addEventListener("dragend", () => {
  dragId = null;
  productsEl.querySelectorAll(".prow").forEach((row) => {
    row.classList.remove("is-dragging", "drop-before", "drop-after");
  });
});

sectionsEl.addEventListener("change", async (event) => {
  const row = event.target.closest(".srow");
  if (!row) return;
  const id = row.dataset.id;
  const body = event.target.type === "color" ? { color: event.target.value } : { name: event.target.value };
  try {
    applySnapshot(await updateSection(id, body));
    toast("Sección guardada");
  } catch (error) {
    toast(error.message);
    render();
  }
});

sectionsEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action='delete-section']");
  if (!button) return;
  const row = button.closest(".srow");
  const section = state.sections.find((item) => item.id === row.dataset.id);
  if (!section) return;
  if (!window.confirm(`¿Eliminar la sección «${section.name}»?`)) return;
  try {
    applySnapshot(await deleteSection(section.id));
    toast("Sección eliminada");
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("add-product").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = new FormData(form).get("name");
  try {
    applySnapshot(await addProduct(name, addSectionSelect.value));
    form.elements.name.value = "";
    form.elements.name.focus();
    toast("Producto agregado");
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("add-section-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    applySnapshot(await addSection(data.get("name"), data.get("color")));
    form.elements.name.value = "";
    toast("Sección agregada");
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("clear-marks").addEventListener("click", async () => {
  if (!window.confirm("¿Quitar todas las marcas de la compra? El catálogo no se borra.")) return;
  try {
    applySnapshot(await clearAllMarks());
    toast("Marcas vaciadas");
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await changePassword(new FormData(form).get("password"));
    form.reset();
    toast("Contraseña actualizada");
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("logout").addEventListener("click", async () => {
  try {
    await logOut();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("load-seed").addEventListener("click", async () => {
  try {
    applySnapshot(await loadSeed());
    toast("Lista inicial cargada");
  } catch (error) {
    toast(error.message);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  try {
    await signIn(document.getElementById("password").value);
    document.getElementById("password").value = "";
  } catch (error) {
    loginError.hidden = false;
    loginError.textContent = error.message;
  }
});

let catalogWatch = null;
function connect() {
  if (catalogWatch) return;
  catalogWatch = watchCatalog((payload) => {
    const active = document.activeElement;
    if (active && active.closest && active.closest("#products, #sections, #inbox, .composer, #password-form")) return;
    applySnapshot(payload);
  });
}

function showSetup() {
  document.getElementById("login-view").hidden = true;
  document.getElementById("app-view").hidden = true;
  document.getElementById("setup").hidden = false;
}

if (!configured()) {
  showSetup();
} else {
  const emailNote = document.getElementById("owner-email");
  if (emailNote) emailNote.textContent = ownerEmail;
  watchAuth((user) => {
    if (user && user.email === ownerEmail) {
      showApp();
      connect();
      return;
    }
    if (catalogWatch) {
      catalogWatch();
      catalogWatch = null;
    }
    showLogin();
  });
}
