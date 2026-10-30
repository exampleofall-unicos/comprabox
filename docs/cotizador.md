# Comprabox: operación del cotizador

El tema tiene `quote_mode_enabled: true` en su configuración local. No se publicó en Shopify. `/cart` muestra la confirmación paralela de cotización. La plantilla opcional `page.cotizacion` permite crear otra página con el mismo flujo; no hace falta crearla para usar `/cart`.

## Qué cambia

La nueva sección `quote-product` se agrega a las dos plantillas de producto existentes. El contenido nativo se conserva detrás de condiciones Liquid. En modo cotizador se suprimen compra rápida, pago dinámico, drawer, notificación del carrito, compra como invitado y logos de pago. La calculadora anterior y el formulario de contacto conservan su código/configuración pero el flujo de solicitud usa la nueva selección de productos. No se modifican productos, inventario, pasarelas ni checkout.

El carrito independiente guarda IDs y cantidades en `localStorage`, por tienda. Tiene límites técnicos de 100 variantes y 1.000.000 unidades por variante, independientes del stock. Selecciona variantes mediante `option_values` y Section Rendering, sin cargar el array completo de variantes ni deshabilitar las agotadas. La cantidad enviada nunca usa el carrito nativo.

Los enlaces de compra conocidos del tema se suprimen en Liquid. Un guard adicional intercepta enlaces antiguos de checkout y formularios de compra en la página. **El tema no puede bloquear URLs de checkout escritas directamente, checkout en otro dominio ni compras iniciadas por aplicaciones externas.** Antes de publicar revisar menús, bloques de aplicaciones, canales de venta, enlaces externos y automatizaciones del Admin. No se altera el checkout de Shopify.

## Backend y despliegue

Servicio de una tienda, Node 24 o superior. Utiliza SQLite persistente y cifrado AES-256-GCM para los datos de contacto; no requiere dependencias de producción. Esta primera versión usa un único proceso con volumen persistente en lugar de PostgreSQL. No desplegar múltiples réplicas ni en filesystem efímero. Para escalar se necesita migrar almacenamiento/bloqueos a PostgreSQL y workers distribuidos.

1. Crear una aplicación en la organización de Comprabox e instalarla en la tienda. Configurar los scopes y App Proxy de `apps/quote-service/shopify.app.toml.example`. `write_app_proxy` permite configurar el proxy. Confirmar permisos de datos de cliente requeridos por Shopify para email/teléfono en Draft Orders.
2. Desplegar el Dockerfile con HTTPS delante, volumen persistente en `/app/data`, una réplica y límite de cuerpo de 64 KiB en el reverse proxy. Limitar conexiones y tráfico en el borde. El proceso no configura HTTPS por sí mismo.
3. Configurar las variables de `.env.example` en el gestor de secretos del hosting. Nunca pegarlas en Liquid, JavaScript, Git o settings del tema.
4. Para app/tienda de la misma organización, `SHOPIFY_CLIENT_ID` y `SHOPIFY_API_SECRET` habilitan client credentials con renovación automática del token. Alternativa: suministrar un token offline ya provisionado y gestionar su vigencia fuera del servicio. La app no incluye onboarding OAuth público ni panel integrado; la gestión comercial se realiza en Draft Orders del Admin.
5. Obtener el ID de la publicación Online Store y configurar `SHOPIFY_PUBLICATION_ID`; el servidor exige producto ACTIVE y publicado allí. No solicita inventario como condición de aceptación.
6. Crear Turnstile para el dominio público. Configurar secreto y hostname exacto en el servidor, y la clave **pública** en Ajustes del tema → Comprabox · Cotizador. El servidor verifica éxito, dominio y acción `quote`.
7. Configurar Resend, un dominio remitente verificado y el destinatario interno. Sin configuración, los emails quedan pendientes; las solicitudes igualmente se registran. El flujo de revisión manual usa email/WhatsApp guardados en el borrador. No se envían mensajes automáticos por WhatsApp.
8. Configurar ruta del proxy en el tema, por defecto `/apps/comprabox-quotes`, y `QUOTE_ENABLED=true` en el servidor.
9. Ejecutar las pruebas y completar la prueba real en un tema de desarrollo antes de publicar.

El endpoint `/health` verifica el proceso, no acredita la conexión con Shopify. Ninguna configuración de ejemplo contiene credenciales válidas. Sin clave pública, el formulario queda deshabilitado y explica que el envío no está habilitado. El editor de temas nunca permite enviar solicitudes.

## Contrato y garantías

`POST /apps/comprabox-quotes/requests`: `{requestId, lines:[{id,quantity}], contact:{name,email,whatsapp,company,province,notes,website}, challenge}`. `requestId` es UUID v4 generado por el navegador. `website` es un honeypot y debe estar vacío. WhatsApp exige prefijo internacional con `+`. No se aceptan precios del navegador. Se usan precios de catálogo como base interna del borrador, sujetos a revisión comercial.

`POST /apps/comprabox-quotes/status`: `{requestId}`. Devuelve solamente `status`, referencia al confirmar y mensaje saneado al fallar. No devuelve contacto, IDs administrativos ni `invoiceUrl`. La referencia pública es distinta del UUID privado de consulta.

Cada operación pasa por la firma de App Proxy, tienda y timestamp, validación, límites persistentes y Turnstile. La firma del proxy no reemplaza la verificación del visitante. La clave de idempotencia se persiste antes de llamar a servicios externos. Una segunda solicitud con idéntico contenido normalizado dentro de 10 minutos se vincula a la primera, incluso desde otra pestaña. Mismo UUID con contenido diferente devuelve conflicto.

Estados internos: `verifying → pending → creating → confirmed`, `failed` o `uncertain`. Los borradores llevan una etiqueta única de solicitud para conciliación. Si se pierde una respuesta de Shopify o se reinicia el servicio durante una mutación, no se repite la creación: el worker busca el borrador por la referencia. Si no puede determinar el resultado, permanece pendiente y requiere revisión operativa. Nunca se convierte silenciosamente una respuesta ambigua en una nueva creación.

El servidor omite `reserveInventoryUntil`. No llama a `draftOrderComplete`, `draftOrderInvoiceSend` ni operaciones de inventario/pago. Revisar automatizaciones de otras aplicaciones: podrían reaccionar a los borradores fuera de este servicio.

Las notificaciones se reintentan con espera creciente y claves de idempotencia en Resend. Su garantía de deduplicación tiene la duración que ofrece el proveedor; un resultado de entrega ambiguo fuera de esa ventana requiere revisar el proveedor. Los fallos de email no recrean Draft Orders.

## Operación y recuperación

Conservar backups consistentes de SQLite (incluido el WAL o usando la API de backup) y de la clave de cifrado por separado. Restringir acceso al volumen. No registrar cuerpos, tokens ni datos personales en logs. Definir retención de datos con el responsable de Comprabox; esta versión no borra automáticamente solicitudes históricas.

Revisar solicitudes `uncertain`, notificaciones pendientes y errores del proceso. Una solicitud ambigua no debe liberarse para recreación sin comprobar en Shopify la referencia, el catálogo y los logs de infraestructura. No borrar la base para reintentar.

Para suspender nuevos envíos: `QUOTE_ENABLED=false` y reiniciar el servicio. Las consultas de estado y trabajos ya aceptados continúan. Para restaurar compra nativa: desactivar **Activar modo cotizador** en el tema. Las configuraciones originales y los borradores permanecen. Si se retira también el backend, hacerlo después de resolver los trabajos pendientes. Antes del primer push, duplicar el tema remoto y descargar su configuración actual para evitar sobrescribir cambios hechos en Admin desde esta copia local.

## Verificación

Desde `apps/quote-service`: `npm ci` y `npm test`. Desde la raíz: `shopify theme check`. JavaScript del tema y del servicio también se verifica con `node --check`.

Prueba real obligatoria antes de publicar: variantes con stock 0 y política deny, cantidad superior al disponible, múltiples productos, variantes eliminadas/no publicadas, recuperación después de timeout, reload/segunda pestaña, ausencia de reserva/pago en Shopify, email, móvil/teclado y ambas plantillas de producto. Verificar selector de más de 250 variantes y secciones del editor en la tienda. Comparar inventario antes/después. Desactivar el modo y comprobar compra rápida/carrito/checkout nativos en un tema de prueba.

Referencias: [Draft Orders](https://shopify.dev/docs/api/admin-graphql/latest/mutations/draftOrderCreate), [App Proxy](https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies), [client credentials](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant), [variantes](https://shopify.dev/docs/storefronts/themes/product-merchandising/variants/support-high-variant-products), [Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Resend](https://resend.com/docs/api-reference/emails/send-email).
