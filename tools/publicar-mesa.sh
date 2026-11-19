#!/bin/sh
# publicar-mesa.sh [carpeta]: copia solo los archivos de la Mesa a una carpeta (por omisión _mesa/) para publicarla en
# https://mesa.uribevisuals.studio (Cloudflare Pages: orden «sh tools/publicar-mesa.sh», salida «_mesa»; D-260).
# No transforma nada: los mismos archivos, tal cual, más sus cabeceras (tools/mesa.headers, con la CSP de index.html → _headers). Sin npm ni nada que
# instalar. Se para si a la página le falta algo que pide o si entra algo que no es de la Mesa (herramientas, pruebas,
# servidor, notas, .env). Excepción a «sin build» aceptada por Kevin; más adelante, la Mesa en su propia carpeta y sin esto.
set -eu
cd "$(dirname "$0")/.."
D=${1:-_mesa}
rm -rf "$D"; mkdir -p "$D/portal"
cp index.html "$D/"
for f in ./*.js; do cp "$f" "$D/"; done          # todos los .js de la raíz son de la Mesa
cp -R kits "$D/kits"                              # el motor, los kits de marca y sus fuentes
cp portal/supa.js "$D/portal/"                    # del portal, solo su cliente de Supabase
# las cabeceras: la CSP es la del <meta> de index.html (D-252), la misma, más «frame-ancestors 'none'», que un <meta> no admite
CSP=$(grep -o 'Content-Security-Policy" content="[^"]*' index.html | sed 's/^Content-Security-Policy" content="//')
[ -n "$CSP" ] || { echo "publicar-mesa: index.html sin su CSP" >&2; exit 1; }
sed "s|{CSP}|$CSP|" tools/mesa.headers > "$D/_headers"
# cada script que pide la página y el worker de las fotos (no está en la página: lo crea nube.js)
for s in $(grep -o 'src="[^"?]*' index.html | sed 's/^src="//') nube-fotos.js; do
  [ -f "$D/$s" ] || { echo "publicar-mesa: falta $s" >&2; exit 1; }
done
# nada que no sea de la Mesa
for x in tools tests servidor .env .claude .git CLAUDE.md CLAUDE.local.md DECISIONES.md README.md; do
  [ ! -e "$D/$x" ] || { echo "publicar-mesa: no debería estar $x" >&2; exit 1; }
done
if find "$D" -name '*.md' | grep -q .; then echo "publicar-mesa: hay notas .md" >&2; exit 1; fi
echo "publicar-mesa: $(find "$D" -type f | wc -l | tr -d ' ') archivos en $D"
