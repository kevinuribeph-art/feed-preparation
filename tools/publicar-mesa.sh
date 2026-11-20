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
cp movil.html movil.webmanifest "$D/"                # la Mesa del iPhone y su manifiesto (D-269)
for f in ./*.js; do cp "$f" "$D/"; done          # todos los .js de la raíz son de la Mesa
cp -R kits "$D/kits"                              # el motor, los kits de marca y sus fuentes
cp portal/supa.js "$D/portal/"                    # del portal, solo su cliente de Supabase
# y de su marca, lo que pide la Mesa: el logo de la entrada (D-262) y el monograma de «Vista cliente» (D-264)
MARCA="portal/marca/logo-ink.svg portal/marca/logo-paper.svg portal/marca/monograma.svg"
mkdir -p "$D/portal/marca"; for m in $MARCA; do cp "$m" "$D/portal/marca/"; done
# los iconos de la pestaña y del iPhone (D-265): lo que piden los <link rel="icon"> y <link rel="apple-touch-icon"> de index.html
# y de movil.html, y los del manifiesto del iPhone (D-269)
MAN=$(grep -oE '<link rel="manifest" href="[^"?]*' movil.html | sed 's/.*href="//')
[ -n "$MAN" ] && [ -f "$MAN" ] || { echo "publicar-mesa: movil.html sin su manifiesto" >&2; exit 1; }
ICONOS=$( { cat index.html movil.html | grep -oE '<link rel="(icon|apple-touch-icon)"[^>]*' | grep -oE 'href="[^"?]*' | sed 's/^href="//'; grep -oE '"src": *"[^"]*"' "$MAN" | sed 's/.*"src": *"//; s/"$//'; } | sort -u)
for i in $ICONOS; do if [ -f "$i" ]; then mkdir -p "$D/$(dirname "$i")"; cp "$i" "$D/$i"; fi; done
# las cabeceras: la CSP es la del <meta> de index.html (D-252), la misma, más «frame-ancestors 'none'», que un <meta> no admite
CSP=$(grep -o 'Content-Security-Policy" content="[^"]*' index.html | sed 's/^Content-Security-Policy" content="//')
[ -n "$CSP" ] || { echo "publicar-mesa: index.html sin su CSP" >&2; exit 1; }
# la del iPhone, la misma (las cabeceras valen para las dos páginas, D-269)
CSPM=$(grep -o 'Content-Security-Policy" content="[^"]*' movil.html | sed 's/^Content-Security-Policy" content="//')
[ "$CSPM" = "$CSP" ] || { echo "publicar-mesa: la CSP de movil.html no es la de index.html" >&2; exit 1; }
sed "s|{CSP}|$CSP|" tools/mesa.headers > "$D/_headers"
# cada script que piden las dos páginas, el manifiesto del iPhone, el worker de las fotos (no está en la página: lo crea nube.js), la marca y los iconos
for s in $(cat index.html movil.html | grep -o 'src="[^"?]*' | sed 's/^src="//' | sort -u) nube-fotos.js "$MAN" $MARCA $ICONOS; do
  [ -f "$D/$s" ] || { echo "publicar-mesa: falta $s" >&2; exit 1; }
done
# nada que no sea de la Mesa
for x in tools tests servidor .env .claude .git CLAUDE.md CLAUDE.local.md DECISIONES.md README.md; do
  [ ! -e "$D/$x" ] || { echo "publicar-mesa: no debería estar $x" >&2; exit 1; }
done
if find "$D" -name '*.md' | grep -q .; then echo "publicar-mesa: hay notas .md" >&2; exit 1; fi
echo "publicar-mesa: $(find "$D" -type f | wc -l | tr -d ' ') archivos en $D"
