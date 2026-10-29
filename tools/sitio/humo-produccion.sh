#!/usr/bin/env bash
# Matriz de humo de producción por curl: 30 comprobaciones para correr DESPUÉS de promover
# el despliegue (SPEC sección 9 punto 10; parte del rollback). Solo lectura: GET y HEAD públicos.
# Basada en seo/agentic/codigo/verificar.sh.
#
# Uso: bash tools/sitio/humo-produccion.sh [https://rovaq.ai]
#      APP=https://app.rovaq.ai WWW=https://www.rovaq.ai bash tools/sitio/humo-produccion.sh
#      bash tools/sitio/humo-produccion.sh --listar    (imprime las 30 sin red)
# Sale con código 1 si falla alguna.
B="${1:-https://rovaq.ai}"; APP="${APP:-https://app.rovaq.ai}"; WWW="${WWW:-https://www.rovaq.ai}"
LISTAR=0; [ "$B" = "--listar" ] && { LISTAR=1; B="https://rovaq.ai"; }
n=0; fallas=0; TOTAL=30
cab(){ curl -sI -m 20 "$@" | tr -d '\r'; }
cod(){ curl -s -o /dev/null -m 20 -w '%{http_code}' "$@"; }
cuerpo(){ curl -s -m 20 "$@"; }
# comprobar "descripción" <comando que devuelve 0 si pasa>
comprobar(){
  n=$((n+1)); local d="$1"; shift
  if [ "$LISTAR" = 1 ]; then printf '%2d. %s\n' "$n" "$d"; return; fi
  if "$@" >/dev/null 2>&1; then printf 'OK    %2d/%d %s\n' "$n" "$TOTAL" "$d"; else printf 'FALLA %2d/%d %s\n' "$n" "$TOTAL" "$d"; fallas=$((fallas+1)); fi
}
en(){ local v; v=$(cod "$@"); [ "$v" = "$EXP" ]; }
H(){ [ -z "$_H" ] && _H=$(cuerpo "$B/"); printf '%s' "$_H"; }
_H=""; [ "$LISTAR" = 0 ] && _H=$(cuerpo "$B/")
HEN=""; [ "$LISTAR" = 0 ] && HEN=$(cuerpo "$B/en")
ACTIVO=$(printf '%s' "$_H" | grep -o '/s/[^"'"'"' )]*\.\(js\|css\|woff2\|webp\|avif\|png\|svg\)' | head -1)

# --- Hosts y redirecciones
comprobar "rovaq.ai / responde 200 con HTML"              bash -c "[ \$(curl -s -o /dev/null -m 20 -w '%{http_code}' $B/) = 200 ] && curl -sI -m 20 $B/ | grep -qi '^content-type: *text/html'"
comprobar "www redirige al apex (301 o 308 a $B)"         bash -c "curl -sI -m 20 $WWW/ | tr -d '\r' | awk 'NR==1{c=\$2} tolower(\$1)==\"location:\"{l=\$2} END{exit !((c==301||c==308) && index(l,\"$B\")==1)}'"
comprobar "app.rovaq.ai / no devuelve error 5xx"          bash -c "c=\$(curl -s -o /dev/null -m 20 -w '%{http_code}' $APP/); [ \"\$c\" -lt 500 ] && [ \"\$c\" -ge 200 ]"
comprobar "app.rovaq.ai/login responde 200"               bash -c "[ \$(curl -s -o /dev/null -m 20 -w '%{http_code}' $APP/login) = 200 ]"
comprobar "/en responde 200"                              bash -c "[ \$(curl -s -o /dev/null -m 20 -w '%{http_code}' $B/en) = 200 ]"
comprobar "http redirige a https"                         bash -c "c=\$(curl -s -o /dev/null -m 20 -w '%{http_code}' ${B/https:/http:}/); [ \"\$c\" = 301 ] || [ \"\$c\" = 308 ]"
comprobar "/sitio/es no se sirve en rovaq.ai (redirige o 404, nunca 200)" bash -c "c=\$(curl -s -o /dev/null -m 20 -w '%{http_code}' $B/sitio/es); [ \"\$c\" != 200 ]"
comprobar "ruta inexistente devuelve 404 (no 200 blando)" bash -c "[ \$(curl -s -o /dev/null -m 20 -w '%{http_code}' $B/esta-pagina-no-existe-humo) = 404 ]"
# --- Activos /s/
comprobar "la portada referencia al menos un activo bajo /s/"      test -n "$ACTIVO"
comprobar "el activo /s/ responde 200"                              bash -c "test -n '$ACTIVO' && [ \$(curl -s -o /dev/null -m 20 -w '%{http_code}' $B$ACTIVO) = 200 ]"
comprobar "el activo /s/ lleva Cache-Control immutable"             bash -c "test -n '$ACTIVO' && curl -sI -m 20 $B$ACTIVO | grep -qi '^cache-control:.*immutable'"
# --- robots, sitemap, llms
comprobar "robots.txt 200 y text/plain"                             bash -c "curl -sI -m 20 $B/robots.txt | tr -d '\r' | awk 'NR==1{c=\$2} tolower(\$1)==\"content-type:\"{t=\$2} END{exit !(c==200 && t ~ /text\/plain/)}'"
comprobar "robots declara Sitemap absoluto de rovaq.ai"             bash -c "curl -s -m 20 $B/robots.txt | grep -qi '^Sitemap: https://rovaq.ai/sitemap.xml'"
comprobar "robots no bloquea /s/ y sí cierra /sitio/ y /api/"        bash -c "r=\$(curl -s -m 20 $B/robots.txt); ! echo \"\$r\" | grep -qi '^Disallow: /s/' && echo \"\$r\" | grep -qi '^Disallow: /sitio/' && echo \"\$r\" | grep -qi '^Disallow: /api/'"
comprobar "sitemap.xml 200 con tipo xml"                            bash -c "curl -sI -m 20 $B/sitemap.xml | tr -d '\r' | awk 'NR==1{c=\$2} tolower(\$1)==\"content-type:\"{t=\$2} END{exit !(c==200 && t ~ /xml/)}'"
comprobar "sitemap con alternates hreflang es y en"                 bash -c "s=\$(curl -s -m 20 $B/sitemap.xml); echo \"\$s\" | grep -q 'hreflang=\"es\"' && echo \"\$s\" | grep -q 'hreflang=\"en\"'"
comprobar "sitemap sin app.rovaq.ai ni /sitio/ ni /s/"              bash -c "! curl -s -m 20 $B/sitemap.xml | grep -q 'app.rovaq.ai\|/sitio/\|<loc>[^<]*/s/'"
comprobar "llms.txt 200"                                            bash -c "[ \$(curl -s -o /dev/null -m 20 -w '%{http_code}' $B/llms.txt) = 200 ]"
comprobar "llms-full.txt 200"                                       bash -c "[ \$(curl -s -o /dev/null -m 20 -w '%{http_code}' $B/llms-full.txt) = 200 ]"
comprobar "/en/llms.txt 200"                                        bash -c "[ \$(curl -s -o /dev/null -m 20 -w '%{http_code}' $B/en/llms.txt) = 200 ]"
# --- HTML de la portada
comprobar "canonical absoluto de la portada"                        bash -c "printf '%s' \"\$0\" | grep -q 'rel=\"canonical\" href=\"https://rovaq.ai/\"'" "$_H"
comprobar "hreflang es, en y x-default"                             bash -c "for l in es en x-default; do printf '%s' \"\$0\" | grep -q \"hreflang=\\\"\$l\\\"\" || exit 1; done" "$_H"
comprobar "/en con html lang=en y canonical /en"                    bash -c "printf '%s' \"\$0\" | grep -q '<html lang=\"en\"' && printf '%s' \"\$0\" | grep -q 'rel=\"canonical\" href=\"https://rovaq.ai/en'" "$HEN"
comprobar "un solo h1 en la portada"                                bash -c "[ \$(printf '%s' \"\$0\" | grep -o '<h1[ >]' | wc -l) -eq 1 ]" "$_H"
comprobar "portada sin atributo style ni inert"                     bash -c "! printf '%s' \"\$0\" | grep -qE ' style=\"| inert[ >=]'" "$_H"
comprobar "portada sin recursos de otro origen"                     bash -c "! printf '%s' \"\$0\" | grep -oE '<(script|link|img)[^>]+(src|href)=\"https?://[^\"]+' | grep -v 'rovaq.ai' | grep -q ." "$_H"
comprobar "JSON-LD con Organization y WebSite"                      bash -c "printf '%s' \"\$0\" | grep -q '\"@type\":\"Organization\"' && printf '%s' \"\$0\" | grep -q '\"@type\":\"WebSite\"'" "$_H"
# --- Cabeceras
comprobar "Strict-Transport-Security presente"                      bash -c "curl -sI -m 20 $B/ | grep -qi '^strict-transport-security'"
comprobar "CSP (o Report-Only candidata) y nosniff presentes"       bash -c "h=\$(curl -sI -m 20 $B/); echo \"\$h\" | grep -qi '^content-security-policy' && echo \"\$h\" | grep -qi '^x-content-type-options: *nosniff'"
comprobar "rovaq.ai sin X-Robots-Tag noindex y app.rovaq.ai con noindex" bash -c "! curl -sI -m 20 $B/ | grep -qi '^x-robots-tag:.*noindex' && curl -sI -m 20 $APP/login | grep -qi '^x-robots-tag:.*noindex'"

if [ "$LISTAR" = 1 ]; then echo "$n comprobaciones"; exit 0; fi
echo; [ "$n" = "$TOTAL" ] || { echo "ERROR: se esperaban $TOTAL comprobaciones y hubo $n"; exit 2; }
[ "$fallas" -eq 0 ] && echo "TODO EN ORDEN ($n/$TOTAL)" || { echo "$fallas fallas de $n"; exit 1; }
