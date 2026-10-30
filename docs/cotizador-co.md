# Comprabox Co — implementación y operación

Estado al 29/10/2026. Rama: `codex/cotizador-co`. Base auditada: Dawn 15.5.0, commit `1941a8e80a143c28c2f4562bd6a9691c5efcd249`.

## Alcance entregado

Experiencia paralela de catálogo, producto, carrito y formulario, cargada exclusivamente en **Copia de Respaldo 29/10/2026 antes del cotizador**, tema no publicado `192174883128`, tienda `comprabox-2.myshopify.com`.

El tema publicado `192170852664` no se modifica. Los 413 archivos preexistentes están protegidos por SHA-256 en `protected-files-co.json`, incluidos cambios locales que ya existían. Ese archivo registra cada copia exacta antes de editarla. No se sustituyeron las plantillas originales ni se cambiaron asignaciones de productos en Admin.

El backend está implementado y probado con respuestas simuladas; **no está desplegado ni conectado a credenciales reales**. No se creó ningún Draft Order real durante estas pruebas. El envío queda deshabilitado por defecto.

## Vista previa y editor

- [Carrito Co](https://comprabox.com.ar/cart?view=cotizador-co&preview_theme_id=192174883128).
- [Catálogo Co](https://comprabox.com.ar/collections/all?view=catalogo-co&preview_theme_id=192174883128).
- [Inicio Co](https://comprabox.com.ar/?view=inicio-co&preview_theme_id=192174883128).
- [Editor de la copia](https://comprabox-2.myshopify.com/admin/themes/192174883128/editor).

Shopify puede solicitar la contraseña de la tienda y retirar `preview_theme_id` de la URL después de establecer su sesión de vista previa. Comprobar que la barra inferior siga mostrando el nombre de la copia y `Draft`.

Las plantillas alternativas se seleccionan mediante el selector de plantillas del editor, o mediante `view` en la vista previa. Carrito Co es una plantilla alternativa del carrito; no reemplaza automáticamente el carrito predeterminado. `page.cotizador-co.json` permite una página independiente cuando se cree y se asigne desde Admin. Esa página no se ha creado.

En las plantillas Co aparecen los nombres **Producto Co**, **Carrito Co**, **Resumen Co**, **Formulario Co** y **Configuración Co**. Se conservaron los IDs de ajustes y bloques existentes. Los nombres se ajustaron al límite de Shopify. La configuración compartida entre vistas Co vive en el nuevo grupo `sections/quote-config-group-co.json`; no requiere editar `config/settings_data.json`.

**Habilitar solicitudes Co** controla únicamente el envío del formulario. No convierte todas las rutas de la tienda en Co. En el editor el envío se mantiene bloqueado aun con esa casilla activa. Los subtotales de referencia se habilitan desde Resumen Co y permanecen desactivados por defecto.

## Carrito y navegación

`quote-store-co.js` guarda la selección por tienda en localStorage, sin datos personales. Conserva ID real de variante y producto, título, SKU, imagen, cantidad, moneda y precio de referencia. Variantes repetidas se acumulan. Límites: 100 variantes distintas y 1.000.000 de unidades por variante; enteros positivos, sin comparar con inventario. Las estimaciones se calculan por moneda y no fijan el presupuesto final.

No se usa `/cart/add.js`, el carrito Shopify ni un checkout para guardar o enviar la cotización. El botón de producto funciona también cuando la variante existente está agotada. Los selectores obtienen las combinaciones válidas de Shopify mediante renderizado de secciones. La calculadora comercial es informativa; su enlace lleva a revisar el Carrito Co.

`quote-navigation-co.js` conserva las vistas Co en enlaces de productos, colecciones, inicio, búsqueda y carrito; desvía enlaces de pago encontrados dentro de esas vistas al Carrito Co. Las recomendaciones conservan sus parámetros y fragmentos.

**Límite de esta entrega:** las rutas sin `view`, páginas comerciales, políticas, cuentas de cliente y otras superficies que conservan el layout original todavía pueden llevar a la experiencia nativa. Con JavaScript deshabilitado tampoco existe una protección global de navegación. Ocultar enlaces no bloquea el acceso directo al checkout gestionado por Shopify. Esta vista previa no debe publicarse como una tienda exclusivamente de cotización hasta completar la activación global autorizada y su auditoría.

## Backend propio y Draft Orders

Flujo: formulario → App Proxy propio `/apps/comprabox-quotes/requests` → backend HTTPS `/proxy/requests` → validación → `draftOrderCreate` → referencia pública `CBX-…`.

Archivos ejecutables: `apps/quote-service/server-co.mjs`, `core-co.mjs`, `shopify-co.mjs`. El proceso usa Node 24 y SQLite persistente, con un único proceso por base de datos. Los archivos anteriores sin sufijo permanecen protegidos y no son el punto de entrada Co.

El servidor verifica firma HMAC del proxy, tienda, antigüedad, formato y tamaño del cuerpo, cantidades, variantes activas y publicación en Online Store. No confía en precios del navegador. Cloudflare Turnstile, campo trampa y límites de frecuencia protegen el envío. Nombre, email, WhatsApp internacional, provincia, localidad y consentimiento son obligatorios; empresa, CUIT y observaciones son opcionales.

El Draft contiene variantes reales, cantidades y datos comerciales en atributos, más etiquetas `COTIZACION_WEB` y referencia. Se omiten reserva de inventario, términos de pago, mutación de completar pedido y envío de factura. No se modifica inventario ni la política de seguir vendiendo sin stock. Facundo puede revisar el borrador y preparar el presupuesto manualmente.

Consultar las referencias de Shopify: [DraftOrderInput](https://shopify.dev/docs/api/admin-graphql/latest/input-objects/DraftOrderInput) y [autenticación de App Proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies). La prueba real de sobrestock y ausencia de reserva es obligatoria antes de habilitar solicitudes.

## Duplicados, errores y notificaciones

- UUID por intento, registro durable y hash normalizado; la misma solicitud no vuelve a crear un borrador. Contenidos idénticos durante diez minutos se vinculan al primer registro.
- Datos comerciales cifrados con AES-256-GCM en SQLite. La clave se guarda en el entorno del servidor y se respalda por separado.
- Si Shopify pudo haber creado el borrador pero se pierde la respuesta, queda `uncertain`. Se busca por referencia; no se repite la mutación a ciegas. Los casos no reconciliados requieren revisión operativa.
- El navegador conserva selección e identificador pendiente y ofrece consultar estado. Solo vacía las líneas enviadas al recibir una confirmación real. No muestra éxito por haber pulsado el botón.
- La confirmación presenta la referencia y, si se configuraron, enlaces de WhatsApp/email. No se envían mensajes de WhatsApp automáticamente.
- Correos transaccionales opcionales mediante Resend, con cola/reintento. No se contrató ni configuró ese proveedor. Sin sus variables no se envían correos y las notificaciones quedan pendientes. No depende de una app de terceros de Shopify.

## Conexión pendiente

1. Disponer de hosting HTTPS propio con Node 24 y volumen persistente para SQLite; definir respaldos, retención de datos y monitoreo de solicitudes inciertas. No usar almacenamiento efímero ni varias réplicas con esta configuración.
2. Registrar/instalar la integración de Comprabox en la organización propietaria. Usar `shopify.app-co.toml.example` como referencia: `read_products`, `read_publications`, `write_draft_orders`, `write_app_proxy`. La concesión de permisos requiere una acción autorizada del propietario.
3. Configurar los secretos del servidor a partir de `.env-co.example`, sin subirlos al tema ni al repositorio. Definir la publicación de Online Store, clave de cifrado, autenticación Shopify y secretos Turnstile. El flujo client credentials presupone una integración de la misma organización; alternativamente admite un token administrativo ya provisionado.
4. Configurar el App Proxy hacia el hosting. Configurar Turnstile para el dominio público real, `comprabox.com.ar`, y su clave pública en Configuración Co. El hostname validado por el servidor debe coincidir.
5. Definir email/WhatsApp comercial y política de privacidad. Configurar correo transaccional solo si se desea habilitarlo.
6. Probar un envío real acordado: inventario antes/después, un único Draft abierto, ausencia de reserva/pago/factura y confirmación con referencia. Recién entonces habilitar solicitudes fuera del editor.

El contenedor se construye desde `apps/quote-service` con `Dockerfile-co`. El punto de entrada es `node server-co.mjs`; variables únicamente del entorno seguro del hosting. No hay panel embebido adicional: la revisión comercial usa los Draft Orders del Admin.

## Activación global y restauración

La activación pública completa sigue pendiente de autorización específica porque las rutas estándar requieren un punto de entrada compartido. La alternativa preferida es preparar una copia adicional de despliegue y cambiar allí las plantillas estándar `index.json`, `product*.json`, `collection*.json`, `search.json`, `cart.json`, las páginas necesarias y sus referencias de layout, preservando ajustes. Políticas, cuentas y enlaces de aplicaciones requieren revisión separada; algunas superficies no admiten simplemente una plantilla alternativa. Un cambio en `layout/theme.liquid` sería otra excepción compartida, no aplicada aquí.

Antes de esa etapa se debe presentar la lista exacta de archivos y el diff, respaldar las configuraciones remotas, resolver las salidas a superficies nativas y probar móvil/escritorio, búsqueda, filtros, galerías y variantes. No basta con publicar esta copia o marcar Habilitar solicitudes Co.

Para desactivar envíos: casilla Co desactivada y `QUOTE_ENABLED=false` en el backend. Conservar la base y el servicio de consulta para resolver solicitudes pendientes. Para volver a la experiencia nativa en esta etapa: usar las rutas originales sin `view`; no hay archivos originales que restaurar. Tras una futura activación global, restaurar las asignaciones/plantillas respaldadas o republicar el respaldo nativo previamente verificado. No borrar Draft Orders, selección local ni base de datos como mecanismo de reversión.

## Validación

Ejecutar desde la raíz del repositorio:

```powershell
node --test apps/quote-service/test/core.test-co.mjs apps/quote-service/test/theme.test-co.mjs apps/quote-service/test/validation.test-co.mjs
shopify theme check --output json
```

Resultado local: 24 pruebas aprobadas. Incluyen integridad de originales, publicación de variantes, sobrestock, conservación de cantidad al cambiar variante, edición sin perder foco, datos malformados, consentimiento, XSS, parámetros de recomendaciones, firmas, idempotencia y respuesta perdida. Los tests de Liquid/DOM y GraphQL usan simulaciones y no sustituyen la prueba de integración real. Theme Check: cero errores; quedan advertencias heredadas del tema y sus copias. La suite histórica sin sufijo apunta a una interfaz anterior ausente y no representa la implementación Co.

Prueba en Shopify: catálogo Co → producto agotado Termo System 1000ML Colores Surtidos → agregar 100 unidades → Carrito Co conserva la selección → editar a 150 actualiza el resumen inmediatamente. El carrito nativo se consultó por separado: vacío, cero artículos. Formulario presente y envío bloqueado. Sin creación de pedidos ni interacción con pagos. Evidencia: `carrito-preview-co.jpg`; se dejó la selección de prueba de 150 unidades en el navegador de vista previa. Variantes múltiples reales, galerías, búsqueda/filtros completos y validación móvil quedan como aceptación adicional antes de producción.

## Tabla completa de duplicación

Generada del manifiesto de procedencia. Los archivos nuevos de runtime, formulario, configuración, utilidades y pruebas adicionales no tienen original del que derivar.

| Archivo original | Copia Co |
| --- | --- |
| apps/quote-service/.env.example | apps/quote-service/.env-co.example |
| apps/quote-service/core.mjs | apps/quote-service/core-co.mjs |
| apps/quote-service/Dockerfile | apps/quote-service/Dockerfile-co |
| apps/quote-service/server.mjs | apps/quote-service/server-co.mjs |
| apps/quote-service/shopify.mjs | apps/quote-service/shopify-co.mjs |
| apps/quote-service/shopify.app.toml.example | apps/quote-service/shopify.app-co.toml.example |
| apps/quote-service/test/core.test.mjs | apps/quote-service/test/core.test-co.mjs |
| assets/component-cart.css | assets/component-cart-co.css |
| assets/facets.js | assets/facets-co.js |
| assets/order-calculator.css | assets/order-calculator-co.css |
| assets/order-calculator.js | assets/order-calculator-co.js |
| assets/predictive-search.js | assets/predictive-search-co.js |
| assets/product-info.js | assets/product-info-co.js |
| layout/theme.liquid | layout/theme-co.liquid |
| sections/featured-collection.liquid | sections/featured-collection-co.liquid |
| sections/featured-product.liquid | sections/featured-product-co.liquid |
| sections/footer.liquid | sections/footer-co.liquid |
| sections/footer-group.json | sections/footer-group-co.json |
| sections/header.liquid | sections/header-co.liquid |
| sections/header-group.json | sections/header-group-co.json |
| sections/main-cart-footer.liquid | sections/main-cart-footer-co.liquid |
| sections/main-cart-items.liquid | sections/main-cart-items-co.liquid |
| sections/main-collection-product-grid.liquid | sections/main-collection-product-grid-co.liquid |
| sections/main-collection-product-grid2.liquid | sections/main-collection-product-grid2-co.liquid |
| sections/main-product.liquid | sections/main-product-co.liquid |
| sections/main-search.liquid | sections/main-search-co.liquid |
| sections/order-calculator.liquid | sections/order-calculator-co.liquid |
| sections/predictive-search.liquid | sections/predictive-search-co.liquid |
| sections/related-products.liquid | sections/related-products-co.liquid |
| snippets/buy-buttons.liquid | snippets/buy-buttons-co.liquid |
| snippets/card-product.liquid | snippets/card-product-co.liquid |
| snippets/collection-grid2-card.liquid | snippets/collection-grid2-card-co.liquid |
| snippets/collection-grid2-filter.liquid | snippets/collection-grid2-filter-co.liquid |
| snippets/facets.liquid | snippets/facets-co.liquid |
| snippets/header-drawer.liquid | snippets/header-drawer-co.liquid |
| snippets/header-dropdown-menu.liquid | snippets/header-dropdown-menu-co.liquid |
| snippets/header-mega-menu.liquid | snippets/header-mega-menu-co.liquid |
| snippets/header-search.liquid | snippets/header-search-co.liquid |
| snippets/pagination.liquid | snippets/pagination-co.liquid |
| snippets/product-variant-options.liquid | snippets/product-variant-options-co.liquid |
| snippets/product-variant-picker.liquid | snippets/product-variant-picker-co.liquid |
| templates/cart.json | templates/cart.cotizador-co.json |
| templates/collection.json | templates/collection.catalogo-co.json |
| templates/index.json | templates/index.inicio-co.json |
| templates/product.json | templates/product.producto-co.json |
| templates/product.ter-mm-1000-ngr.json | templates/product.ter-mm-1000-ngr-co.json |
| templates/search.json | templates/search.busqueda-co.json |
