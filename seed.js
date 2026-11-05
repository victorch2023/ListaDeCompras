"use strict";

// Orden fijo de la hoja original: columna izquierda, luego central, luego derecha.
// Dentro de cada columna, de arriba hacia abajo. Los espacios en blanco de la hoja
// separan secciones; no son productos.

function p(id, name, sectionId) {
  return { id, name, sectionId };
}

const sections = [
  { id: "aseo", name: "Aseo y limpieza", color: "#1d4ed8" },
  { id: "abarrotes", name: "Abarrotes", color: "#1c1917" },
  { id: "condimentos", name: "Condimentos y enlatados", color: "#1c1917" },
  { id: "harinas", name: "Harinas, galletas y lácteos", color: "#9a3412" },
  { id: "secos", name: "Pan, azúcar e infusiones", color: "#1c1917" },
  { id: "frutas", name: "Frutas", color: "#15803d" },
  { id: "verduras", name: "Verduras", color: "#1c1917" },
  { id: "frescos", name: "Panadería, lácteos y fiambres", color: "#1c1917" },
  { id: "frutas-2", name: "Frutas", color: "#15803d" },
  { id: "verduras-2", name: "Verduras", color: "#15803d" },
  { id: "carnes", name: "Carnes y huevos", color: "#dc2626" },
  { id: "otros", name: "Otros", color: "#1c1917" },
];

const products = [
  // Columna izquierda
  p("shampoo", "Shampoo", "aseo"),
  p("gel", "Gel", "aseo"),
  p("jabon-de-tocador", "Jabón de tocador", "aseo"),
  p("jabon-liquido", "Jabón Líquido", "aseo"),
  p("pasta-dental", "Pasta dental", "aseo"),
  p("detergente-bolivar", "Detergente Bolivar", "aseo"),
  p("jabon-bolivar", "Jabón Bolivar", "aseo"),
  p("suavitel", "Suavitel", "aseo"),
  p("lejia", "Lejía", "aseo"),
  p("ayudin", "Ayudín", "aseo"),
  p("sacagrasa", "Sacagrasa", "aseo"),
  p("espirales", "Espirales", "aseo"),
  p("bolsa-de-basura", "Bolsa de basura", "aseo"),
  p("papel-higienico", "Papel Higiénico", "aseo"),
  p("papel-toalla", "Papel Toalla", "aseo"),
  p("servilletas", "Servilletas", "aseo"),
  p("bicarbonato", "Bicarbonato", "aseo"),
  p("toallitas-clorox", "Toallitas Clorox", "aseo"),

  p("gaseosas", "Gaseosas", "abarrotes"),
  p("agua-con-gas", "Agua con gas", "abarrotes"),
  p("monsters", "Monsters", "abarrotes"),
  p("snacks", "Snacks", "abarrotes"),
  p("popcorn", "Popcorn", "abarrotes"),
  p("espagueti", "Espagueti", "abarrotes"),
  p("arroz", "Arroz", "abarrotes"),
  p("salsa-roja-completa", "Salsa Roja Completa", "abarrotes"),
  p("ramen-cup", "Ramen Cup", "abarrotes"),
  p("quinua", "Quinua", "abarrotes"),
  p("lenteja", "Lenteja", "abarrotes"),
  p("trigo", "Trigo", "abarrotes"),
  p("atun-en-lata", "Atún en lata", "abarrotes"),

  p("aceite", "Aceite", "condimentos"),
  p("choclito-en-lata", "Choclito en lata", "condimentos"),
  p("vinagre-blanco", "Vinagre Blanco", "condimentos"),
  p("sal-de-cocina", "Sal de cocina", "condimentos"),
  p("sillau", "Sillau", "condimentos"),
  p("ketchup", "Ketchup", "condimentos"),
  p("mayonesa", "Mayonesa", "condimentos"),
  p("aji-panquita-sobre", "Ají Panquita sobre", "condimentos"),
  p("dona-gusta-gallina", "Doña Gusta Gallina", "condimentos"),
  p("dona-gusta-carne", "Doña Gusta Carne", "condimentos"),
  p("dona-gusta-marisco", "Doña Gusta Marisco", "condimentos"),
  p("hongos-secos", "Hongos secos", "condimentos"),
  p("comino", "Comino", "condimentos"),
  p("pimienta-negra", "Pimienta negra", "condimentos"),
  p("pimienta-blanca", "Pimienta blanca", "condimentos"),
  p("clavo-de-olor", "Clavo de olor", "condimentos"),
  p("hojas-de-laurel", "Hojas de Laurel", "condimentos"),
  p("ajinomoto", "Ajinomoto", "condimentos"),
  p("oregano", "Orégano", "condimentos"),
  p("rollos-de-canela", "Rollos de Canela", "condimentos"),
  p("canela-en-polvo", "Canela en polvo", "condimentos"),

  // Columna central
  p("harina-preparada", "Harina Preparada", "harinas"),
  p("harina-sin-preparar", "Harina Sin Preparar", "harinas"),
  p("galletas", "Galletas", "harinas"),
  p("galletas-de-vanilla", "Galletas de Vanilla", "harinas"),
  p("galletas-integrales", "Galletas integrales", "harinas"),
  p("gomitas", "Gomitas", "harinas"),
  p("gelatina-de-limon", "Gelatina de Limón", "harinas"),
  p("gelatina-de-fresa", "Gelatina de Fresa", "harinas"),
  p("colapiz", "Colapiz", "harinas"),
  p("avena", "Avena", "harinas"),
  p("leche-grande", "Leche Grande", "harinas"),
  p("leche-chica", "Leche Chica", "harinas"),

  p("pan-blanco-molde", "Pan Blanco Molde", "secos"),
  p("pan-molido", "Pan Molido", "secos"),
  p("azucar-rubia", "Azúcar Rubia", "secos"),
  p("azucar-blanca", "Azúcar Blanca", "secos"),
  p("chia", "Chía", "secos"),
  p("manzanilla", "Manzanilla", "secos"),
  p("te-negro", "Té Negro", "secos"),
  p("cocoa", "Cocoa", "secos"),
  p("linaza", "Linaza", "secos"),
  p("emoliente", "Emoliente", "secos"),

  p("platano", "Plátano", "frutas"),
  p("mango", "Mango", "frutas"),
  p("uvas", "Uvas", "frutas"),
  p("palta", "Palta", "frutas"),
  p("mandarina", "Mandarina", "frutas"),

  p("cebolla-roja", "Cebolla Roja", "verduras"),
  p("cebolla-blanca", "Cebolla Blanca", "verduras"),
  p("limones", "Limones", "verduras"),
  p("zanahoria", "Zanahoria", "verduras"),
  p("vainitas", "Vainitas", "verduras"),
  p("ajo", "Ajo", "verduras"),
  p("ajies-amarillos", "Ajíes amarillos", "verduras"),
  p("choclo", "Choclo", "verduras"),
  p("papa-blanca", "Papa Blanca", "verduras"),
  p("papa-amarilla", "Papa Amarilla", "verduras"),
  p("camote", "Camote", "verduras"),
  p("tomate", "Tomate", "verduras"),

  p("pan-pita", "Pan Pita", "frescos"),
  p("pan-frances", "Pan Francés", "frescos"),
  p("alfajores", "Alfajores", "frescos"),
  p("piononos-pequenos", "Piononos pequeños", "frescos"),
  p("queso-fresco", "Queso Fresco", "frescos"),
  p("yogurt", "Yogurt", "frescos"),
  p("hotdogs", "Hotdogs", "frescos"),
  p("chorizo", "Chorizo", "frescos"),
  p("jamon", "Jamón", "frescos"),
  p("queso-philadelphia", "Queso Philadelphia", "frescos"),
  p("queso-edam", "Queso Edam", "frescos"),
  p("queso-parmesano", "Queso Parmesano", "frescos"),
  p("mantequilla", "Mantequilla", "frescos"),

  // Columna derecha
  p("manzana", "Manzana", "frutas-2"),
  p("pera", "Pera", "frutas-2"),
  p("fresas", "Fresas", "frutas-2"),
  p("arandano", "Arándano", "frutas-2"),
  p("frambuesas", "Frambuesas", "frutas-2"),
  p("rambutan", "Rambután", "frutas-2"),

  p("zapallito-italiano", "Zapallito Italiano", "verduras-2"),
  p("pepino", "Pepino", "verduras-2"),
  p("holantao", "Holantao", "verduras-2"),
  p("esparragos", "Espárragos", "verduras-2"),
  p("olluquito", "Olluquito", "verduras-2"),
  p("zapallo", "Zapallo", "verduras-2"),
  p("brocoli", "Brócoli", "verduras-2"),
  p("poro", "Poro", "verduras-2"),
  p("tomatitos", "Tomatitos", "verduras-2"),
  p("champinones", "Champiñones", "verduras-2"),
  p("culantro", "Culantro", "verduras-2"),
  p("perejil", "Perejil", "verduras-2"),
  p("albahaca", "Albahaca", "verduras-2"),
  p("espinaca", "Espinaca", "verduras-2"),
  p("lechugas", "Lechugas", "verduras-2"),

  p("pollo-pechuga-bandeja", "Pollo Pechuga bandeja", "carnes"),
  p("pollo-piernitas-bandeja", "Pollo Piernitas bandeja", "carnes"),
  p("pollo-muslo-bandeja", "Pollo Muslo bandeja", "carnes"),
  p("carne-asado", "Carne Asado", "carnes"),
  p("carne-lomo", "Carne Lomo", "carnes"),
  p("carne-ossobuco", "Carne Ossobuco", "carnes"),
  p("carne-bisteck", "Carne Bisteck", "carnes"),
  p("carne-molida", "Carne Molida", "carnes"),
  p("huevos", "Huevos", "carnes"),

  p("liquido-de-lentes", "Líquido de lentes", "otros"),
  p("lipitor", "Lipitor", "otros"),
];

function assertSeed() {
  const ids = products.map((product) => product.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Hay identificadores repetidos en la lista inicial");
  }
  const expected = [
    [0, "shampoo"],
    [51, "canela-en-polvo"],
    [52, "harina-preparada"],
    [103, "mantequilla"],
    [104, "manzana"],
    [135, "lipitor"],
  ];
  for (const [index, id] of expected) {
    if (!products[index] || products[index].id !== id) {
      throw new Error(`Orden inicial incorrecto en la posición ${index}: se esperaba ${id}`);
    }
  }
  if (products.length !== 136) {
    throw new Error(`La lista inicial debe tener 136 productos y tiene ${products.length}`);
  }
  const sectionIds = new Set(sections.map((section) => section.id));
  for (const product of products) {
    if (!sectionIds.has(product.sectionId)) {
      throw new Error(`El producto ${product.id} apunta a una sección que no existe`);
    }
  }
}

assertSeed();

module.exports = { sections, products };
