#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Instala Node.js desde https://nodejs.org y vuelve a abrir este archivo."
  read -r -p "Pulsa Enter para cerrar..."
  exit 1
fi
npm install
npm start
