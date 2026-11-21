import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  writeBatch,
  deleteDoc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { firebaseConfig, ownerEmail } from "./firebase-config.js";

export function configured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      ownerEmail &&
      ownerEmail.includes("@")
  );
}

export { ownerEmail };

const memory = { sections: [], products: [], items: {} };
const subscribers = new Set();
let rev = 0;
let app;
let db;
let auth;
let listening = false;
let seen = { sections: false, products: false, marks: false };
const failed = {};

function explain(error) {
  const code = error?.code || "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-email") {
    return "Contraseña incorrecta";
  }
  if (code === "auth/too-many-requests") return "Demasiados intentos. Espera un momento.";
  if (code === "auth/requires-recent-login") return "Vuelve a entrar al panel y cambia la contraseña otra vez.";
  if (code === "permission-denied") {
    return "Firebase rechazó el cambio. Publica las reglas y confirma que el correo del dueño sea el mismo en los dos archivos.";
  }
  if (code === "unavailable" || code === "auth/network-request-failed") return "No hay conexión con Firebase.";
  return error?.message || "No se pudo guardar";
}

async function guard(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error?.code) throw new Error(explain(error));
    throw error;
  }
}

function ensure() {
  if (!configured()) {
    const error = new Error("Falta pegar la configuración de Firebase.");
    error.code = "config";
    throw error;
  }
  if (app) return;
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  auth.languageCode = "es";
}

function sortProducts(list) {
  return list.slice().sort((a, b) => {
    if (Boolean(a.pending) !== Boolean(b.pending)) return a.pending ? 1 : -1;
    return a.order - b.order;
  });
}

function emit() {
  rev += 1;
  const payload = {
    rev,
    live: true,
    sections: memory.sections.slice().sort((a, b) => a.order - b.order),
    products: sortProducts(memory.products),
    items: { ...memory.items },
    error: Object.keys(failed).length
      ? "Firebase no dejó leer la lista. Publica las reglas de Firestore."
      : "",
  };
  memory.sections = payload.sections;
  memory.products = payload.products;
  for (const fn of subscribers) fn(payload);
  return payload;
}

function requireReady() {
  if (!seen.sections || !seen.products || !seen.marks) {
    throw new Error("La lista todavía se está cargando");
  }
}

function note(key, error) {
  if (error) failed[key] = true;
  else delete failed[key];
  seen[key] = true;
  if (seen.sections && seen.products && seen.marks) emit();
}

function startListening() {
  if (listening) return;
  listening = true;
  ensure();
  onSnapshot(query(collection(db, "sections"), orderBy("order")), (snap) => {
    memory.sections = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    note("sections");
  }, () => note("sections", true));
  onSnapshot(query(collection(db, "products"), orderBy("order")), (snap) => {
    memory.products = snap.docs.map((item) => ({
      id: item.id,
      pending: false,
      sectionId: "",
      ...item.data(),
    }));
    note("products");
  }, () => note("products", true));
  onSnapshot(collection(db, "marks"), (snap) => {
    const items = {};
    snap.forEach((item) => {
      const data = item.data();
      items[item.id] = {
        marked: Boolean(data.marked),
        qty: Number(data.qty) || 1,
        bought: Boolean(data.bought) && Boolean(data.marked),
      };
    });
    memory.items = items;
    note("marks");
  }, () => note("marks", true));
}

export function watchCatalog(fn) {
  ensure();
  startListening();
  subscribers.add(fn);
  if (seen.sections && seen.products && seen.marks) {
    fn({
      rev,
      live: true,
      sections: memory.sections,
      products: memory.products,
      items: { ...memory.items },
      error: Object.keys(failed).length
        ? "Firebase no dejó leer la lista. Publica las reglas de Firestore."
        : "",
    });
  }
  return () => subscribers.delete(fn);
}

export function watchAuth(fn) {
  ensure();
  return onAuthStateChanged(auth, fn);
}

export function signIn(password) {
  return guard(async () => {
    ensure();
    await signInWithEmailAndPassword(auth, ownerEmail, password);
  });
}

export function logOut() {
  return guard(async () => {
    ensure();
    await signOut(auth);
  });
}

export function changePassword(password) {
  return guard(async () => {
    ensure();
    const next = String(password || "");
    if (next.length < 6) throw new Error("Firebase pide al menos 6 caracteres");
    if (next.length > 80) throw new Error("La contraseña es demasiado larga");
    if (!auth.currentUser) throw new Error("Necesitas entrar de nuevo");
    await updatePassword(auth.currentUser, next);
  });
}

function cleanName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Escribe un nombre");
  if (name.length > 80) throw new Error("El nombre es demasiado largo");
  return name;
}

function normName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  const base = normName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base || "item";
}

function uniqueId(name, taken) {
  const base = slug(name);
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

function cleanColor(value) {
  const color = String(value || "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("El color no es válido");
  return color.toLowerCase();
}

async function writeProducts(list) {
  const batch = writeBatch(db);
  const next = list.map((product, order) => ({
    id: product.id,
    name: product.name,
    sectionId: product.sectionId || "",
    order,
    pending: Boolean(product.pending),
  }));
  for (const product of next) {
    batch.set(doc(db, "products", product.id), {
      name: product.name,
      sectionId: product.sectionId,
      order: product.order,
      pending: product.pending,
    });
  }
  if (next.length) await batch.commit();
  memory.products = next;
  return emit();
}

function indexForEmptySection(placed, sectionId) {
  const sectionOrder = memory.sections.findIndex((section) => section.id === sectionId);
  let insertAt = placed.length;
  for (let index = 0; index < placed.length; index += 1) {
    const order = memory.sections.findIndex((section) => section.id === placed[index].sectionId);
    if (order > sectionOrder) {
      insertAt = index;
      break;
    }
  }
  return insertAt;
}

function inserted(product, sectionId) {
  const others = memory.products.filter((item) => item.id !== product.id && !item.pending);
  const pending = memory.products.filter((item) => item.pending && item.id !== product.id);
  const copy = { ...product, sectionId, pending: false };
  const start = others.findIndex((item) => item.sectionId === sectionId);
  let insertAt;
  if (start === -1) insertAt = indexForEmptySection(others, sectionId);
  else {
    let end = start;
    while (end < others.length && others[end].sectionId === sectionId) end += 1;
    insertAt = end;
  }
  others.splice(insertAt, 0, copy);
  return others.concat(pending);
}

export function setMark(id, marked, qty, bought) {
  return guard(async () => {
    ensure();
    requireReady();
    const safeQty = Math.min(999, Math.max(1, qty));
    const ref = doc(db, "marks", id);
    if (!marked && safeQty === 1) {
      await deleteDoc(ref);
      delete memory.items[id];
    } else {
      const value = { marked: Boolean(marked), qty: safeQty, bought: Boolean(bought) && Boolean(marked) };
      await setDoc(ref, value);
      memory.items[id] = value;
    }
    return emit();
  });
}

export function clearAllMarks() {
  return guard(async () => {
    ensure();
    requireReady();
    const snap = await getDocs(collection(db, "marks"));
    const marks = new Map(snap.docs.map((item) => [item.id, item.data()]));
    const bought = [];
    for (const product of memory.products) {
      const data = marks.get(product.id);
      if (!data || !data.marked || !data.bought) continue;
      bought.push({
        id: product.id,
        name: product.name,
        qty: Math.min(999, Math.max(1, Number(data.qty) || 1)),
      });
      marks.delete(product.id);
    }
    for (const [id, data] of marks) {
      if (!data.marked || !data.bought) continue;
      bought.push({
        id,
        name: id,
        qty: Math.min(999, Math.max(1, Number(data.qty) || 1)),
      });
    }
    if (bought.length) {
      await addDoc(collection(db, "purchases"), {
        at: serverTimestamp(),
        items: bought,
      });
    }
    const ids = snap.docs.map((item) => item.id);
    for (let offset = 0; offset < ids.length; offset += 400) {
      const batch = writeBatch(db);
      for (const id of ids.slice(offset, offset + 400)) batch.delete(doc(db, "marks", id));
      await batch.commit();
    }
    memory.items = {};
    return emit();
  });
}

function purchaseItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: String(item?.id || "").slice(0, 80),
      name: String(item?.name || "").trim().slice(0, 80),
      qty: Math.min(999, Math.max(1, Math.round(Number(item?.qty) || 1))),
    }))
    .filter((item) => item.name);
}

export function savePurchaseItems(id, items) {
  return guard(async () => {
    ensure();
    const next = purchaseItems(items);
    if (!next.length) throw new Error("Esa fecha ya no tiene productos.");
    await updateDoc(doc(db, "purchases", id), { items: next });
  });
}

export function deletePurchase(id) {
  return guard(async () => {
    ensure();
    await deleteDoc(doc(db, "purchases", id));
  });
}

export function restorePurchase(id, at, items) {
  return guard(async () => {
    ensure();
    const when = at instanceof Date ? at : new Date(at);
    if (Number.isNaN(when.getTime())) throw new Error("No se pudo recuperar la fecha.");
    const next = purchaseItems(items);
    if (!next.length) throw new Error("No hay productos para recuperar.");
    await setDoc(doc(db, "purchases", id), {
      at: Timestamp.fromDate(when),
      items: next,
    });
  });
}

export function watchPurchases(fn) {
  ensure();
  const purchases = query(collection(db, "purchases"), orderBy("at", "desc"));
  return onSnapshot(purchases, (snap) => {
    fn(snap.docs.map((item) => {
      const data = item.data();
      const at = data.at && typeof data.at.toDate === "function" ? data.at.toDate() : null;
      return {
        id: item.id,
        at,
        items: Array.isArray(data.items) ? data.items : [],
      };
    }));
  });
}

export function suggestProduct(name) {
  return guard(async () => {
    ensure();
    requireReady();
    const clean = cleanName(name);
    const key = normName(clean);
    const existing = memory.products.find((product) => normName(product.name) === key);
    if (existing) {
      const prev = memory.items[existing.id] || { marked: false, qty: 1, bought: false };
      if (!prev.marked) {
        const value = { marked: true, qty: Math.min(999, Math.max(1, prev.qty || 1)), bought: false };
        await setDoc(doc(db, "marks", existing.id), value);
        memory.items[existing.id] = value;
      }
      return { ...emit(), focusId: existing.id, created: false };
    }
    if (memory.products.filter((product) => product.pending).length >= 40) {
      throw new Error("Hay muchos productos por ubicar. Espera a que el dueño los ordene.");
    }
    const id = uniqueId(clean, new Set(memory.products.map((product) => product.id)));
    const product = {
      id,
      name: clean,
      sectionId: "",
      pending: true,
      order: memory.products.length,
    };
    await setDoc(doc(db, "products", id), {
      name: product.name,
      sectionId: "",
      order: product.order,
      pending: true,
    });
    const mark = { marked: true, qty: 1, bought: false };
    await setDoc(doc(db, "marks", id), mark);
    memory.products.push(product);
    memory.items[id] = mark;
    return { ...emit(), focusId: id, created: true };
  });
}

export function addProduct(name, sectionId) {
  return guard(async () => {
    ensure();
    requireReady();
    if (!memory.sections.some((section) => section.id === sectionId)) throw new Error("Elige una sección");
    const clean = cleanName(name);
    const id = uniqueId(clean, new Set(memory.products.map((product) => product.id)));
    const list = inserted({ id, name: clean, sectionId, pending: false }, sectionId);
    return writeProducts(list);
  });
}

export function updateProduct(id, body) {
  return guard(async () => {
    ensure();
    requireReady();
    const product = memory.products.find((item) => item.id === id);
    if (!product) throw new Error("Ese producto ya no está en la lista");
    if (body.name != null) product.name = cleanName(body.name);
    if (body.sectionId != null && body.sectionId !== product.sectionId) {
      if (product.pending) throw new Error("Ubícalo desde Por ubicar");
      return writeProducts(inserted(product, String(body.sectionId)));
    }
    return writeProducts(memory.products.map((item) => (item.id === id ? product : item)));
  });
}

export function deleteProduct(id) {
  return guard(async () => {
    ensure();
    requireReady();
    if (!memory.products.some((product) => product.id === id)) throw new Error("Ese producto ya no está");
    await deleteDoc(doc(db, "products", id));
    if (memory.items[id]) await deleteDoc(doc(db, "marks", id)).catch(() => {});
    delete memory.items[id];
    return writeProducts(memory.products.filter((product) => product.id !== id));
  });
}

export function reorderProducts(ids) {
  return guard(async () => {
    ensure();
    requireReady();
    const pending = memory.products.filter((product) => product.pending);
    const placed = memory.products.filter((product) => !product.pending);
    if (!Array.isArray(ids) || ids.length !== placed.length) throw new Error("El orden está incompleto");
    const map = new Map(placed.map((product) => [product.id, product]));
    const next = [];
    for (const id of ids) {
      const product = map.get(String(id));
      if (!product) throw new Error("Hay un producto desconocido en el orden");
      next.push(product);
    }
    return writeProducts(next.concat(pending));
  });
}

export function placeProduct(id, body) {
  return guard(async () => {
    ensure();
    requireReady();
    const product = memory.products.find((item) => item.id === id);
    if (!product) throw new Error("Ese producto ya no está en la lista");
    if (!product.pending) throw new Error("Ese producto ya está ubicado");
    const sectionId = String(body?.sectionId || "");
    if (!memory.sections.some((section) => section.id === sectionId)) throw new Error("Elige una sección");
    const raw = body?.position;
    let position = null;
    if (raw != null && raw !== "") {
      position = Number(raw);
      if (!Number.isInteger(position) || position < 1 || position > 9999) {
        throw new Error("El lugar tiene que ser un número desde 1");
      }
    }
    const pending = memory.products.filter((item) => item.pending && item.id !== id);
    const placed = memory.products.filter((item) => !item.pending);
    const copy = { ...product, pending: false, sectionId };
    const start = placed.findIndex((item) => item.sectionId === sectionId);
    let insertAt;
    if (start === -1) insertAt = indexForEmptySection(placed, sectionId);
    else {
      let end = start;
      while (end < placed.length && placed[end].sectionId === sectionId) end += 1;
      const count = end - start;
      insertAt = position == null || position > count ? end : start + position - 1;
    }
    placed.splice(insertAt, 0, copy);
    return writeProducts(placed.concat(pending));
  });
}

export function addSection(name, color) {
  return guard(async () => {
    ensure();
    requireReady();
    const clean = cleanName(name);
    const id = uniqueId(clean, new Set(memory.sections.map((section) => section.id)));
    const section = { id, name: clean, color: cleanColor(color || "#1c1917"), order: memory.sections.length };
    await setDoc(doc(db, "sections", id), { name: section.name, color: section.color, order: section.order });
    memory.sections.push(section);
    return emit();
  });
}

export function updateSection(id, body) {
  return guard(async () => {
    ensure();
    requireReady();
    const section = memory.sections.find((item) => item.id === id);
    if (!section) throw new Error("Esa sección ya no está");
    if (body.name != null) section.name = cleanName(body.name);
    if (body.color != null) section.color = cleanColor(body.color);
    await setDoc(doc(db, "sections", id), { name: section.name, color: section.color, order: section.order });
    return emit();
  });
}

export function deleteSection(id) {
  return guard(async () => {
    ensure();
    requireReady();
    if (!memory.sections.some((section) => section.id === id)) throw new Error("Esa sección ya no está");
    if (memory.products.some((product) => product.sectionId === id)) {
      throw new Error("Pasa sus productos a otra sección antes de borrarla");
    }
    if (memory.sections.length <= 1) throw new Error("Tiene que quedar al menos una sección");
    await deleteDoc(doc(db, "sections", id));
    memory.sections = memory.sections.filter((section) => section.id !== id);
    return emit();
  });
}

export function loadSeed() {
  return guard(async () => {
    ensure();
    requireReady();
    if (memory.products.length || memory.sections.length) {
      throw new Error("La lista ya tiene productos. No la volví a cargar.");
    }
    const res = await fetch(new URL("./seed.json", import.meta.url));
    if (!res.ok) throw new Error("No se encontró la lista inicial");
    const seed = await res.json();
    const batch = writeBatch(db);
    seed.sections.forEach((section, order) => {
      batch.set(doc(db, "sections", section.id), {
        name: section.name,
        color: section.color,
        order,
      });
    });
    seed.products.forEach((product, order) => {
      batch.set(doc(db, "products", product.id), {
        name: product.name,
        sectionId: product.sectionId,
        order,
        pending: false,
      });
    });
    await batch.commit();
    memory.sections = seed.sections.map((section, order) => ({ ...section, order }));
    memory.products = seed.products.map((product, order) => ({ ...product, order, pending: false }));
    return emit();
  });
}
