# Checklist final para el abogado y para Javier

Fecha: 3-nov-2026. Sustituye a la lista de verificación previa del 31-oct (copia privada fuera del repo). Textos finales en `docs/legal/aviso-de-privacidad.{es,en}.md` y `terminos.{es,en}.md` (exportados de `apps/web/src/content/sitio/paginas/legal.ts`). Evidencia en `INVENTARIO-PROVEEDORES.md` y `CONSERVACION-Y-ELIMINACION.md`. Nada de esto es asesoría legal.

## A. Los tres datos externos (único bloqueo técnico de publicación)

| Dato | Variable de Vercel | Quién lo da |
|---|---|---|
| Razón social del responsable | `VEXA_LEGAL_ENTIDAD` | Javier, el socio técnico y el cliente piloto: denominación exacta de la sociedad que contrata |
| Domicilio | `VEXA_LEGAL_DOMICILIO` | Igual; domicilio fiscal o el que el abogado indique |
| Correo de privacidad y ARCO | `VEXA_LEGAL_CORREO` | La persona responsable del aviso en el cliente piloto; buzón de la empresa, no personal. Hay que crearlo. El socio técnico queda como contacto de emergencia y seguridad |

Mientras falte una, ninguna de las dos páginas se sirve, se enlaza ni entra al sitemap. Fijarlas es el interruptor: solo después del visto bueno de la sección B.

## B. Decisiones del abogado, con la propuesta ya redactada en el texto

| # | Decisión | Propuesta en el texto |
|---|---|---|
| 1 | Papeles responsable y encargado, y si falta un contrato de encargo con cada empresa cliente | Responsable de usuarios del portal; encargado de datos que la empresa carga o conecta. Falta redactar el contrato de encargo |
| 2 | Ley y autoridad | Ley Federal de Protección de Datos Personales en Posesión de los Particulares, autoridad nombrada solo como competente. Confirmar la denominación vigente de la autoridad y los plazos de respuesta ARCO |
| 3 | Transferencias y remisiones a proveedores en el extranjero | El aviso las informa como remisiones a encargados, sin consentimiento. Confirmar que basta |
| 4 | Plazos de conservación | Exporte 30 días y eliminación a los 60 días al terminar; cuenta 90 días tras la baja; seguridad 180 días; respaldo 8 días |
| 5 | Datos sensibles y de menores | El producto no está diseñado para ellos; si aparecen, es responsabilidad de la empresa |
| 6 | Finalidades secundarias | Ninguna |
| 7 | Términos: ley aplicable y tribunales | Leyes federales mexicanas; tribunales del domicilio de Rovaq |
| 8 | Tope de responsabilidad | Lo pagado en los 12 meses previos; excluye dolo y negligencia grave |
| 9 | Aviso de vulneración | Sin demora injustificada y máximo 72 horas tras confirmarla |
| 10 | Suspensión, terminación, cambios | 10 días para subsanar; 30 días de aviso; 30 días de antelación para cambios sustanciales |
| 11 | Confidencialidad | Durante la relación y 3 años después |
| 12 | Idioma | El español prevalece sobre el inglés |
| 13 | Acceso del personal | Sesión de soporte de solo lectura, motivo, 60 minutos, registro; más tareas operativas de carga solicitadas por la empresa |

## C. Confirmaciones técnicas de Javier antes de publicar

1. Supabase: región del proyecto, plan, que el respaldo diario conserve 8 días y el contrato de encargo con el proveedor.
2. Resend: si está activo, región, y qué SMTP envía los correos de acceso e invitaciones.
3. IA: cuentas de OpenRouter y de Anthropic, modelos y proveedores efectivos por organización, políticas de retención y de entrenamiento, región efectiva. El aviso afirma solo lo que el código garantiza.
4. Google: si el inicio de sesión está activo en producción.
5. Sesiones de soporte: si las migraciones `20261126000000` y siguientes están aplicadas. El texto dice que existen con esos límites; si no están aplicadas, es una capacidad descrita, no una práctica.
6. Cron de retención de registros de seguridad: activo o no. Si no, quitar la cifra de 180 días.
7. Rutina de baja de organización: documentarla y ensayarla una vez en local, o ajustar el texto de 60 días.
8. Cookies: revisar en el navegador las que fija Supabase Auth.
9. Dónde se guardan los respaldos lógicos por tenant y quién los tiene.
10. Verificación en dos pasos y política de contenido: el aviso no las afirma; revisar `a7` con la matización de que «Ver como» existe y TOTP existe antes de publicar ese artículo.

## D. Lo que el aviso no dice a propósito

Nombres de clientes finales o de terceros sin autorización expresa; certificaciones; cumplimiento del GDPR; anonimización; residencia de datos concreta; restauración probada; recuperación a un punto exacto; cobertura de adjuntos en los respaldos.

## E. Pasos de publicación (un solo despliegue, un build)

Ver `COMO-PUBLICAR.md`.
