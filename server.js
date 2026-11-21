"use strict";

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");

const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
const app = express();

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get(["/admin", "/admin/"], (req, res) => {
  res.sendFile(path.join(publicDir, "admin", "index.html"));
});

app.get(["/admin/compras", "/admin/compras/"], (req, res) => {
  res.sendFile(path.join(publicDir, "admin", "compras", "index.html"));
});

app.use(express.static(publicDir, { etag: false, maxAge: 0, index: "index.html" }));

const server = http.createServer(app);

function lanAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`El puerto ${PORT} ya está en uso.`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("Vista local de la lista");
  console.log(`  En esta computadora: http://localhost:${PORT}`);
  for (const address of lanAddresses()) {
    console.log(`  En la red: http://${address}:${PORT}`);
  }
  console.log("");
});
