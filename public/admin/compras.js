import {
  configured,
  deletePurchase,
  logOut,
  ownerEmail,
  restorePurchase,
  savePurchaseItems,
  signIn,
  watchAuth,
  watchPurchases,
} from "../db.js";

"use strict";

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

function showLogin() {
  appView.hidden = true;
  loginView.hidden = false;
}

function showReport() {
  loginView.hidden = true;
  appView.hidden = false;
}

function showSetup() {
  loginView.hidden = true;
  appView.hidden = true;
  document.getElementById("setup").hidden = false;
}

function formatWhen(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Guardando la hora…";
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const UNDO_KEY = "lista-compras-undo";
let currentRows = [];
let busy = false;

function readUndo() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(UNDO_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUndo(stack) {
  sessionStorage.setItem(UNDO_KEY, JSON.stringify(stack.slice(-15)));
  paintUndo();
}

function paintUndo() {
  const button = document.getElementById("undo-purchase");
  const note = document.getElementById("undo-note");
  const stack = readUndo();
  const last = stack[stack.length - 1];
  button.disabled = !last || busy;
  note.textContent = last
    ? `Deshacer: ${last.label}`
    : "Si borras algo por error, Deshacer lo devuelve.";
}

function showHistoryError(message) {
  const error = document.getElementById("history-error");
  error.hidden = !message;
  error.textContent = message || "";
}

function renderPurchases(rows) {
  currentRows = rows;
  const root = document.getElementById("purchases");
  const count = document.getElementById("purchase-count");
  count.textContent = rows.length === 1 ? "1 registro" : `${rows.length} registros`;
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "Todavía no hay compras registradas.";
    root.replaceChildren(empty);
    paintUndo();
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const article = document.createElement("article");
    article.className = "purchase";
    const head = document.createElement("div");
    head.className = "purchase-head";
    const when = document.createElement("time");
    if (row.at instanceof Date && !Number.isNaN(row.at.getTime())) when.dateTime = row.at.toISOString();
    when.textContent = formatWhen(row.at);
    const removeDate = document.createElement("button");
    removeDate.type = "button";
    removeDate.className = "text-btn";
    removeDate.dataset.action = "date";
    removeDate.dataset.id = row.id;
    removeDate.textContent = "Borrar fecha";
    head.append(when, removeDate);
    const list = document.createElement("ul");
    row.items.forEach((item, index) => {
      const line = document.createElement("li");
      const label = document.createElement("span");
      const units = item.qty === 1 ? "1 unidad" : `${item.qty} unidades`;
      label.textContent = `${item.name} · ${units}`;
      const removeItem = document.createElement("button");
      removeItem.type = "button";
      removeItem.className = "mini-remove";
      removeItem.dataset.action = "item";
      removeItem.dataset.id = row.id;
      removeItem.dataset.index = String(index);
      removeItem.textContent = "Quitar";
      line.append(label, removeItem);
      list.append(line);
    });
    article.append(head, list);
    fragment.append(article);
  }
  root.replaceChildren(fragment);
  paintUndo();
}

function remember(entry) {
  const stack = readUndo();
  stack.push(entry);
  writeUndo(stack);
}

async function removeItem(id, index) {
  const row = currentRows.find((item) => item.id === id);
  if (!row || !row.items[index]) return;
  const previous = row.items.map((item) => ({ ...item }));
  const removed = previous[index];
  const next = previous.filter((_, itemIndex) => itemIndex !== index);
  if (next.length) await savePurchaseItems(id, next);
  else await deletePurchase(id);
  remember({
    id,
    at: row.at instanceof Date ? row.at.toISOString() : null,
    items: previous,
    label: `devolver ${removed.name}`,
  });
}

async function removeDate(id) {
  const row = currentRows.find((item) => item.id === id);
  if (!row) return;
  const when = formatWhen(row.at);
  if (!window.confirm(`¿Borrar la fecha ${when} y sus ${row.items.length} productos? Puedes deshacerlo después.`)) return;
  await deletePurchase(id);
  remember({
    id,
    at: row.at instanceof Date ? row.at.toISOString() : null,
    items: row.items.map((item) => ({ ...item })),
    label: `recuperar ${when}`,
  });
}

async function undoLast() {
  const stack = readUndo();
  const last = stack[stack.length - 1];
  if (!last) return;
  const exists = currentRows.some((row) => row.id === last.id);
  if (exists) await savePurchaseItems(last.id, last.items);
  else await restorePurchase(last.id, last.at, last.items);
  stack.pop();
  writeUndo(stack);
}

async function runHistory(fn) {
  if (busy) return;
  busy = true;
  paintUndo();
  showHistoryError("");
  try {
    await fn();
  } catch (error) {
    showHistoryError(error.message || "No se pudo guardar el cambio");
  } finally {
    busy = false;
    paintUndo();
  }
}

let purchaseWatch = null;
function connect() {
  if (purchaseWatch) return;
  purchaseWatch = watchPurchases(renderPurchases);
}

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

document.getElementById("logout").addEventListener("click", async () => {
  await logOut();
});

document.getElementById("purchases").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || busy) return;
  const id = button.dataset.id;
  if (button.dataset.action === "item") {
    runHistory(() => removeItem(id, Number(button.dataset.index)));
    return;
  }
  if (button.dataset.action === "date") runHistory(() => removeDate(id));
});

document.getElementById("undo-purchase").addEventListener("click", () => {
  runHistory(undoLast);
});

paintUndo();

if (!configured()) {
  showSetup();
} else {
  document.getElementById("owner-email").textContent = ownerEmail;
  watchAuth((user) => {
    if (user && user.email === ownerEmail) {
      showReport();
      connect();
      return;
    }
    if (purchaseWatch) {
      purchaseWatch();
      purchaseWatch = null;
    }
    showLogin();
  });
}
