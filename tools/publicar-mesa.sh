#!/bin/sh
# publicar-mesa.sh [carpeta]: PUENTE TEMPORAL (D-276). La Mesa vive ya en mesa/ y Cloudflare Pages la publicará tal cual en
# https://mesa.uribevisuals.studio (salida «mesa», sin orden de build). Mientras el proyecto uribevisuals-mesa siga con la orden
# «sh tools/publicar-mesa.sh» y la salida «_mesa», esto copia mesa/ a _mesa/ sin tocar nada (también mesa/_headers).
# Lo que mesa/ debe llevar, y lo que no, lo comprueba tests/mesa-carpeta.mjs. Se quita cuando Cloudflare publique mesa/.
set -eu
cd "$(dirname "$0")/.."
D=${1:-_mesa}
[ -f mesa/index.html ] && [ -f mesa/_headers ] || { echo "publicar-mesa: falta mesa/index.html o mesa/_headers" >&2; exit 1; }
rm -rf "$D"; mkdir -p "$D"
cp -R mesa/. "$D/"
echo "publicar-mesa: $(find "$D" -type f | wc -l | tr -d ' ') archivos en $D (mesa/ tal cual)"
