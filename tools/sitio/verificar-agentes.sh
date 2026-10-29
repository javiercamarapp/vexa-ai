#!/usr/bin/env bash
# Verificación de la preparación para agentes de IA contra un servidor local (next start), con el encabezado Host de cada sitio.
# Derivada de seo/agentic/codigo/verificar.sh (posterior al despliegue). Aquí cada comprobación se clasifica:
#   OK     aplica en local y pasó
#   FALLA  aplica en local y falló: el script sale con 1
#   INFO   depende de algo que hace otra tarea o solo existe en producción (cabeceras de T3, negociación Accept de T3/T14, HSTS, Firewall de Vercel). No cuenta como falla
# Uso:  bash tools/sitio/verificar-agentes.sh http://127.0.0.1:4417
B="${1:-http://127.0.0.1:3000}"; HS="${HOST_SITIO:-rovaq.ai}"; HA="${HOST_APP:-app.rovaq.ai}"
ok=0; fallas=0; info=0
OK(){ printf 'OK    %s\n' "$1"; ok=$((ok+1)); }
MAL(){ printf 'FALLA %s\n' "$1"; fallas=$((fallas+1)); }
INFO(){ printf 'INFO  %s\n' "$1"; info=$((info+1)); }
S(){ curl -s -m 30 -H "Host: $HS" "$@"; }                 # cuerpo
CAB(){ curl -sI -m 30 -H "Host: $HS" "$@"; }              # cabeceras
estado(){ CAB "$@" | head -1 | awk '{print $2}'; }
tipo(){ CAB "$@" | awk 'tolower($1)=="content-type:"{print tolower($2)}' | tr -d '\r;'; }

echo "== 1. Archivos para agentes: 200, sin redirigir a la app, tipo correcto"
for r in /llms.txt /llms-full.txt /en/llms.txt /en/llms-full.txt /index.md /en/index.md /robots.txt /sitemap.xml /sitio.webmanifest /blog/rss.xml /en/blog/rss.xml /og/es.png /og/en.png; do
  e=$(estado "$B$r"); [ "$e" = 200 ] && OK "$r 200" || MAL "$r devolvió $e (se esperaba 200; 308 = host-routing lo manda a la app)"
done
MIRRORS=$( (S "$B/llms.txt" | grep -o 'https://rovaq.ai/s/md/[^)]*' | head -3; S "$B/en/llms.txt" | grep -o 'https://rovaq.ai/s/md/[^)]*' | head -1) )
[ -n "$MIRRORS" ] && OK "llms.txt enlaza a espejos Markdown" || MAL "llms.txt no enlaza a ningún espejo"
for u in $MIRRORS; do r="${u#https://rovaq.ai}"; e=$(estado "$B$r"); [ "$e" = 200 ] && OK "espejo $r 200" || MAL "espejo $r devolvió $e"; done
for r in /llms.txt /llms-full.txt /en/llms.txt /en/llms-full.txt /robots.txt; do t=$(tipo "$B$r"); case "$t" in text/plain*) OK "$r $t";; *) MAL "$r content-type $t";; esac; done
for r in /index.md /en/index.md; do t=$(tipo "$B$r"); case "$t" in text/markdown*) OK "$r $t";; *) INFO "$r content-type $t (T3 fija text/markdown con una regla de cabeceras)";; esac; done
for u in $MIRRORS; do r="${u#https://rovaq.ai}"; t=$(tipo "$B$r"); case "$t" in text/markdown*) OK "espejo $r $t";; *) INFO "espejo $r content-type $t (T3 fija text/markdown con reglasCabecerasEspejos)";; esac; done
t=$(tipo "$B/sitemap.xml"); case "$t" in application/xml*|text/xml*) OK "sitemap.xml $t";; *) MAL "sitemap.xml content-type $t";; esac
t=$(tipo "$B/blog/rss.xml"); case "$t" in application/rss+xml*) OK "rss.xml $t";; *) MAL "rss.xml content-type $t";; esac
t=$(tipo "$B/og/es.png"); case "$t" in image/png*) OK "og/es.png $t";; *) MAL "og/es.png content-type $t";; esac
for r in /llms.txt /index.md; do CAB "$B$r" | grep -qi '^x-robots-tag:.*noindex' && OK "$r lleva X-Robots-Tag noindex" || INFO "$r sin X-Robots-Tag noindex (cabecera de T3, reglasCabecerasEspejos)"; done

echo "== 2. Negociación de contenido"
for r in / /en; do
  t=$(tipo -H 'Accept: text/html,application/xhtml+xml,*/*;q=0.8' "$B$r"); case "$t" in text/html*) OK "$r con Accept de navegador -> html";; *) MAL "$r con Accept de navegador devolvió $t";; esac
  t=$(tipo -H 'Accept: text/markdown' "$B$r"); case "$t" in text/markdown*) OK "$r con Accept text/markdown -> $t";; *) INFO "$r con Accept text/markdown devolvió $t (la negociación son reglas de T3 o del middleware de T14; ver reglasNegociacionMarkdown)";; esac
  CAB "$B$r" | grep -qi '^vary:.*accept' && OK "$r Vary: Accept" || INFO "$r sin Vary: Accept (acompaña a la negociación, T3)"
  CAB "$B$r" | grep -qi 'rel="alternate"; type="text/markdown"' && OK "$r anuncia su espejo con Link" || INFO "$r sin cabecera Link alternate (el espejo se anuncia en el head con link rel=alternate)"
done

echo "== 3. Alcanzable por los agentes: 200 con cada User-Agent"
for ua in "Googlebot/2.1" "GPTBot/1.1" "OAI-SearchBot/1.0" "ChatGPT-User/1.0" "ClaudeBot/1.0" "Claude-User/1.0" "Claude-SearchBot/1.0" "PerplexityBot/1.0" "Perplexity-User/1.0" "Google-Extended" "Applebot/0.1" "CCBot/2.0"; do
  e=$(S -o /dev/null -w '%{http_code}' -A "$ua" "$B/"); [ "$e" = 200 ] && OK "$ua 200" || MAL "$ua recibió $e"
done
e=$(S -o /dev/null -w '%{http_code}' -A "Bytespider" "$B/"); INFO "Bytespider recibió $e (la regla de Firewall que lo corta es de Vercel, la hace el dueño)"

echo "== 4. robots.txt"
R=$(S "$B/robots.txt")
for b in GPTBot ClaudeBot Claude-User OAI-SearchBot PerplexityBot Google-Extended CCBot Applebot-Extended Bytespider; do echo "$R" | grep -qi "User-Agent: $b" && OK "robots menciona $b" || MAL "robots no menciona $b"; done
echo "$R" | grep -qi '^Sitemap: https://rovaq.ai/sitemap.xml' && OK "Sitemap declarado" || MAL "falta Sitemap"
echo "$R" | grep -qi '^Disallow: /api/' && OK "Disallow /api/" || MAL "falta Disallow /api/"
echo "$R" | grep -qi '^Disallow: /sitio/' && OK "Disallow /sitio/" || MAL "falta Disallow /sitio/"
echo "$R" | grep -qi '^Disallow: /_next/data/' && OK "Disallow /_next/data/" || MAL "falta Disallow /_next/data/"
echo "$R" | grep -qiE '^Disallow: (/s/|/landing/)' && MAL "robots bloquea /s/ o /landing/: Google no podría cargar scripts e imágenes" || OK "robots no bloquea /s/ ni /landing/"
curl -s -m 30 -H "Host: $HA" "$B/robots.txt" | grep -qi '^Disallow: /$' && OK "app.rovaq.ai cierra todo (Disallow: /)" || MAL "app.rovaq.ai/robots.txt sin Disallow: /"
curl -s -m 30 -H "Host: $HA" "$B/robots.txt" | grep -qi '^Sitemap:' && MAL "app.rovaq.ai/robots.txt anuncia un sitemap" || OK "app.rovaq.ai sin sitemap"

echo "== 5. Sitemap con fechas reales (dos lecturas con 2 s de diferencia deben coincidir)"
a=$(S "$B/sitemap.xml" | grep -o '<lastmod>[^<]*' | sort | tr '\n' ' '); sleep 2; b=$(S "$B/sitemap.xml" | grep -o '<lastmod>[^<]*' | sort | tr '\n' ' ')
[ -n "$a" ] && [ "$a" = "$b" ] && OK "lastmod estable: $a" || MAL "lastmod cambia entre lecturas o no existe: '$a' vs '$b'"
echo "$a" | grep -qE '<lastmod>[0-9]{4}-[0-9]{2}-[0-9]{2}( |$)' && OK "lastmod con fecha, sin hora de la petición" || MAL "lastmod con formato inesperado"
S "$B/sitemap.xml" | grep -q 'hreflang="es-MX"' && OK "sitemap con hreflang es-MX" || MAL "sitemap sin hreflang es-MX"
S "$B/sitemap.xml" | grep -q 'hreflang="en"' && OK "sitemap con hreflang en" || MAL "sitemap sin hreflang en"
S "$B/sitemap.xml" | grep -q 'hreflang="x-default"' && OK "sitemap con x-default" || MAL "sitemap sin x-default"
S "$B/sitemap.xml" | grep -q '<loc>https://rovaq.ai/</loc>' && OK "sitemap lista la portada" || MAL "sitemap sin la portada"
S "$B/sitemap.xml" | grep -q '<loc>https://rovaq.ai/producto/hoy</loc>' && OK "sitemap lista una página publicable" || MAL "sitemap sin /producto/hoy"
S "$B/sitemap.xml" | grep -q '<loc>https://rovaq.ai/producto</loc>' && MAL "sitemap lista una página pendiente de revisión (/producto)" || OK "sitemap sin páginas pendientes"
S "$B/sitemap.xml" | grep -qiE 'changefreq|priority' && MAL "sitemap con changefreq o priority" || OK "sitemap sin changefreq ni priority"

echo "== 6. Datos estructurados y head"
H=$(S "$B/")
for t in Organization WebSite WebPage SoftwareApplication FAQPage; do echo "$H" | grep -q "\"@type\":\"$t\"" && OK "JSON-LD $t" || MAL "JSON-LD sin $t"; done
echo "$H" | grep -qiE '"offers"|aggregateRating|vexa|@gmail|"price"' && MAL "JSON-LD contiene offers, rating, precio, nombre anterior o correo personal" || OK "JSON-LD sin offers, rating, precio, nombre anterior ni correo personal"
echo "$H" | grep -q 'rel="canonical" href="https://rovaq.ai/"' && OK "canonical limpio" || MAL "canonical inesperado"
echo "$H" | grep -q 'type="text/markdown"' && OK "link rel=alternate type=text/markdown en el head" || MAL "falta el link alternate Markdown en el head"
echo "$H" | grep -qi 'hreflang="en"' && OK "hreflang en" || MAL "sin hreflang en"
echo "$H" | grep -qi 'hreflang="es-MX"' && OK "hreflang es-MX" || MAL "sin hreflang es-MX"
echo "$H" | grep -qi 'hreflang="x-default"' && OK "hreflang x-default" || MAL "sin hreflang x-default"
echo "$H" | grep -q 'property="og:image" content="https://rovaq.ai/og/es.png"' && OK "og:image es" || MAL "og:image inesperada"
echo "$H" | grep -q 'name="twitter:card" content="summary_large_image"' && OK "twitter:card" || MAL "sin twitter:card"
echo "$H" | grep -q 'name="theme-color"' && OK "theme-color" || MAL "sin theme-color"
echo "$H" | grep -q 'prefers-color-scheme: dark' && OK "theme-color oscuro" || MAL "sin theme-color oscuro"
echo "$H" | grep -qE '<meta name="robots" content="index, follow' && OK "robots index, follow" || MAL "robots meta inesperado"
HE=$(S "$B/en")
echo "$HE" | grep -q 'rel="canonical" href="https://rovaq.ai/en"' && OK "canonical /en" || MAL "canonical de /en inesperado"
echo "$HE" | grep -q 'property="og:image" content="https://rovaq.ai/og/en.png"' && OK "og:image en" || MAL "og:image en inesperada"
HI=$(S "$B/producto/hoy")
echo "$HI" | grep -q 'rel="canonical" href="https://rovaq.ai/producto/hoy"' && OK "canonical de una página interna" || MAL "canonical interno inesperado"
echo "$HI" | grep -q '"@type":"BreadcrumbList"' && OK "migas en una página interna" || MAL "sin BreadcrumbList en una página interna"

echo "== 7. Contenido veraz: ninguna afirmación prohibida fuera de una negación"
for f in /llms.txt /llms-full.txt /index.md /en/llms-full.txt /en/index.md; do
  S "$B$f" | grep -niE 'soc ?2|iso ?27001|gdpr|tiempo real|real.time|anonimiz|anonymiz|zendesk|vexa' | grep -viE '\bno\b|\bnot\b|nunca|never|sin |without|hoja de ruta|roadmap|ni |question|pregunta|\?' && MAL "$f tiene una afirmación sospechosa (líneas arriba)" || OK "$f limpio"
done
for f in /llms.txt /llms-full.txt /en/llms.txt /en/llms-full.txt /index.md /en/index.md; do S "$B$f" | grep -qE '\[(CORREO|FECHA|REVIEW|CONTACT|SECURITY|RAZON|LEGAL)[A-Z_]*\]' && MAL "$f aún tiene un marcador sin resolver" || OK "$f sin marcadores"; done
for f in /llms.txt /llms-full.txt /en/llms.txt /en/llms-full.txt /index.md /en/index.md /sitio.webmanifest /humans.txt; do S "$B$f" | grep -qE '[A-Za-z0-9._+-]+@[A-Za-z0-9-]+\.[A-Za-z.]+' && MAL "$f repite una dirección de correo" || OK "$f sin correo"; done

echo "== 8. Seguridad y límites"
e=$(estado "$B/.well-known/security.txt"); [ "$e" = 404 ] && OK "security.txt no se publica sin buzón y fecha (404)" || MAL "security.txt devolvió $e; no debe publicarse con marcadores"
CAB "$B/" | grep -qi '^strict-transport-security' && OK "HSTS" || INFO "sin HSTS (lo agrega Vercel en producción o T3)"
e=$(estado "$B/api/briefs/x/export"); case "$e" in 308|401|403|404) OK "ruta privada /api/... no se sirve en rovaq.ai ($e)";; *) MAL "/api/briefs... devolvió $e";; esac
e=$(estado "$B/esta-pagina-no-existe-$$"); [ "$e" = 404 ] && OK "ruta inexistente: 404 real, no 200 blando" || MAL "ruta inexistente devolvió $e"
e=$(estado "$B/producto"); [ "$e" = 404 ] && OK "página pendiente de revisión (/producto): 404, sin revelarla" || MAL "/producto devolvió $e"
e=$(estado "$B/login"); [ "$e" = 308 ] && OK "/login en rovaq.ai redirige a la app (308)" || MAL "/login devolvió $e"
curl -sI -m 30 -H "Host: $HA" "$B/overview" | grep -qi 'x-robots-tag:.*noindex' && OK "app.rovaq.ai/overview con noindex" || INFO "app.rovaq.ai/overview sin noindex en esta respuesta (sin Supabase el servidor local responde 503)"
e=$(curl -s -o /dev/null -m 30 -w '%{http_code}' -H "Host: $HA" "$B/login"); [ "$e" != 000 ] && OK "app.rovaq.ai/login responde ($e)" || MAL "app.rovaq.ai/login sin respuesta"

echo "== 9. Caché del HTML (informativo)"
CAB "$B/" | grep -iE '^(cache-control|x-vercel-cache|age):' | sed 's/^/INFO  /'
echo
echo "Resumen: $ok OK, $fallas FALLA, $info INFO (no aplican en local o son de otra tarea)"
[ "$fallas" -eq 0 ] && echo "TODO EN ORDEN" || { echo "$fallas fallas"; exit 1; }
