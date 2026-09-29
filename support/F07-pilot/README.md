# Controles técnicos de preparación del piloto

Estos cuatro archivos reproducen sin modificar los controles externos congelados del principal (21 de dominio +4 CLI) y del revisor400 (20 de dominio +1 CLI con cuatro rechazos). Todos los participantes y observaciones son SYN, incluso cuando el fixture ejercita el esquema declarado humano. No son investigación humana ni el gate oficial de aceptación F07-05.

Desde la raíz del repositorio, con Node22:

```sh
VEXA_CANDIDATE="$PWD" node --test support/F07-pilot/*.test.mjs
```

No requieren instalación, red, modelos ni cuentas. Los ensayos CLI crean archivos temporales propios y los eliminan al concluir. El flujo del operador está en [PILOT.md](../../packages/intelligence/evaluation/PILOT.md); el alcance revisado y las huellas constan en [el cierre técnico](../../construccion/F07-05-CIERRE-TECNICO.md).
