#!/bin/bash
# Cierra el registro público de Supabase Auth del proyecto Rovaq (disable_signup=true) SIN afectar invitaciones ni enlaces de acceso.
# LO CORRE EL DUEÑO con `!`. Este script cambia configuración externa: no lo ejecutan los agentes.
# Uso:   bash ops/security/cerrar-registro.sh            (muestra el estado y pide confirmar)
#        bash ops/security/cerrar-registro.sh --verificar (solo lee el estado público, no cambia nada)
#        bash ops/security/cerrar-registro.sh --reabrir   (revierte: disable_signup=false)
# Token: variable SUPABASE_ACCESS_TOKEN; si falta, se pide en un diálogo oculto (nunca en el chat ni en el historial).
set -euo pipefail
REF="${VEXA_SUPABASE_REF:-proyecto-ejemplo}"
API="https://api.supabase.com/v1/projects/$REF/config/auth"
PUB="https://$REF.supabase.co/auth/v1/settings"
modo="${1:-cerrar}"
estado_publico() {
  # /auth/v1/settings es público: no necesita llave de servicio, solo la anon key pública si el gateway la pide.
  curl -fsS "$PUB" -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print("disable_signup=%s mailer_autoconfirm=%s external_email_enabled=%s"%(d.get("disable_signup"),d.get("mailer_autoconfirm"),d.get("external",{}).get("email")))' || echo "(no se pudo leer /auth/v1/settings; exporta NEXT_PUBLIC_SUPABASE_ANON_KEY o revisa el panel Auth > Sign In / Providers)"
}
echo "Estado público actual: $(estado_publico)"
[ "$modo" = "--verificar" ] && exit 0
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  SUPABASE_ACCESS_TOKEN="$(osascript -e 'text returned of (display dialog "Token personal de Supabase (sbp_...)" default answer "" with hidden answer)')"
fi
[ -n "$SUPABASE_ACCESS_TOKEN" ] || { echo "Sin token"; exit 1; }
valor=true; [ "$modo" = "--reabrir" ] && valor=false
echo "Antes (Management API):"
curl -fsS "$API" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | python3 -c 'import sys,json; d=json.load(sys.stdin); print({k:d.get(k) for k in ("disable_signup","mailer_autoconfirm","external_google_enabled","site_url")})'
read -r -p "Poner disable_signup=$valor en $REF? (escribe SI) " r; [ "$r" = "SI" ] || { echo "Cancelado"; exit 1; }
curl -fsS -X PATCH "$API" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d "{\"disable_signup\": $valor}" >/dev/null
echo "Después (Management API):"
curl -fsS "$API" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | python3 -c 'import sys,json; d=json.load(sys.stdin); print({k:d.get(k) for k in ("disable_signup","mailer_autoconfirm")})'
echo "Estado público: $(estado_publico)"
cat <<'T'
Prueba manual que SÍ hay que hacer ahora (con un correo desechable tuyo, no el de un cliente):
  1. Plataforma > Organizaciones > invitar un propietario con ese correo: debe llegar el correo de invitación y el enlace debe crear la cuenta y entrar.
  2. Con un usuario ya existente: pedir enlace en /login: debe llegar el correo.
  3. (Esperado) Un correo que nunca fue invitado ya no puede crear cuenta; pedir enlace sigue respondiendo el mismo aviso genérico y no envía nada.
  Si 1 falla: reabrir con --reabrir y avisar.
T
