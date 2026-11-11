# Auditoría tipográfica de Comprabox

Inventario previo a la unificación. Cubre las 24 plantillas JSON, la plantilla Liquid de tarjeta de regalo y los grupos compartidos de encabezado y pie del repositorio. Los ejemplos representan roles de texto. Los nombres de productos, colecciones, enlaces de menú, valores de metacampos y contenidos editoriales pueden cambiar desde Shopify.

La implementación toma como referencia los tamaños aprobados de `image-banner.liquid`, `image-categories.liquid`, `main-product-co.liquid`, `beneficiosicon.liquid` y `contact-form.liquid`. Por eso, los botones de caja del catálogo siguen la medida de la ficha (16 / 15 px), las tarjetas estándar toman como referencia los 14 px del catálogo, y los encabezados comerciales de segundo nivel usan 30 / 26 px como los bloques de pasos. Los tamaños de las columnas «Hoy» y «Propuesta» documentan la revisión anterior a esos ajustes.

Los tamaños son **escritorio / móvil**, en px con las escalas actuales del tema al 100 %. Un solo valor aplica a ambos. Los valores actuales se deducen de las reglas CSS y la configuración local. Queda pendiente comprobar el renderizado y los datos de Shopify en una vista previa, especialmente los textos administrados fuera del repositorio y las superficies de apps.

- **Títulos (T)** corresponde a la fuente de encabezados elegida en Shopify, hoy **Archivo 600**.
- **Cuerpo (C)** corresponde a la fuente de cuerpo elegida en Shopify, hoy **Roboto 400**. Cuando el inventario indica negrita o seminegrita, se refiere al peso solicitado por CSS o por el marcado. El peso que se dibuja depende de las variantes disponibles de la fuente.
- **Botones (B)** corresponde a la fuente de cuerpo con el ajuste global **Botones → Tamaño del texto**, hoy **15 px** por defecto. Dawn también define **1 px de espaciado entre letras** para sus botones estándar.

Fuentes de la configuración: [config/settings_data.json](../config/settings_data.json), [config/settings_schema.json](../config/settings_schema.json), [layout/theme.liquid](../layout/theme.liquid), [assets/base.css](../assets/base.css) y [assets/theme-button-icons.css](../assets/theme-button-icons.css).

## Catálogo, ficha de producto y cotización

| Dónde aparece | Texto de ejemplo | Hoy | Propuesta para revisar |
| --- | --- | --- | --- |
| Catálogo, cabecera de la grilla | Catálogo Comprabox | T 24, ajuste de sección en px | T 24 / 22 |
| Catálogo, contador junto al título | (10 productos) | T 13, heredado del encabezado | C 13 |
| Catálogo, tarjeta | Termo Media Manija 1000ML Negro | T 14, ajuste de sección en px | T 16 / 15 |
| Catálogo, datos de tarjeta | SKU: TER-MM-1000-NGR · 1000 ML · Agotado | C 12 para SKU y estado, C 13 para capacidad | C 12 para SKU y estado, C 13 para capacidad |
| Catálogo, importe principal de tarjeta | $ 9.765,00 | C 26 regular | C 26 regular |
| Catálogo, precio de venta opcional | Precio de venta: … | C 13 | C 13 |
| Catálogo, botón debajo de cada producto | Agregar al carrito | C 12, espaciado heredado de 0,6 px, interlineado 1,25 | B 15, espaciado e interlineado de Dawn |
| Catálogo, botón de caja | X 35 | C 12 | C 14, mismo estilo de texto que los selectores de bulto de la ficha |
| Catálogo, encabezado de la columna | Filtros · Limpiar filtros | T 18 / C 12, respectivamente | T 18 y C 14, respectivamente |
| Catálogo, grupos de filtros | Disponibilidad · Categoría · Capacidad · Precio | C 16 / 15, peso 600 | C 15 seminegrita |
| Catálogo, controles y filtros activos | En existencia (9) · 1000 ML · De (USD) · Más relevantes | C 12–13 según el control | C 14 para opciones y etiquetas, C 16 para valores en campos editables, C 12 para contadores |
| Catálogo, botones de filtros y orden | Aplicar filtros · Ordenar | B 15 | B 15 |
| Catálogo, sin resultados | No encontramos productos con estos filtros. | T 18 / 17 | T 18 / 17 |
| Catálogo, ventana de cantidad | Elegir cantidad | T 16 | T 18 |
| Catálogo, ventana de cantidad, precio | Desde $ 9.765,00 | C 19 seminegrita | C 18 regular, como en la ficha |
| Catálogo, ventana de cantidad, controles | Cantidad solicitada · 35 · Ver carrito | C 13 para etiqueta y enlace, C 16 para cantidad | C 14 para etiqueta y enlace, C 16 para cantidad |
| Ficha de producto, encabezado | Termo Media Manija 1000ML Negro | T 40 / 30 | T 40 / 30 |
| Ficha alternativa, marca y acción de compartir | COMPRABOX · Share | C 10 para marca en mayúsculas, C 14 para compartir | C 12 para marca, C 14 para compartir |
| Ficha, botones superiores | X 3 · X 18 · X 35 | C 16 / 15, por herencia | C 14, igual al botón de caja del catálogo |
| Ficha, bloque de precio | Desde $ 11.760,00 · $ 35.280,00 | C 18 y C 26, ambos regulares | C 18 y C 26, ambos regulares |
| Ficha, variantes y cantidad | Color · Negro · Cantidad solicitada · 3 | C 13 para etiquetas, C 14 para opciones tipo botón, C 12 en selector desplegable, C 16 para cantidad | C 14 para etiquetas y opciones tipo botón, C 16 para cantidad y valores en campos |
| Ficha, notas de precio y cantidad | Impuestos incluidos. · ¡Sumando 32 unidades accedés al precio por caja! | C 12 / 10, clase de nota de Dawn | C 12 |
| Ficha, botones de compra | Agregar al carrito · Revisar pedido | B 15, espaciado de 1 px, interlineado 1,2 al 100 % | B 15 |
| Ficha, descripción, avisos y recomendados | Descripción del termo · Divulgaciones · You may also like | C 16 / 15 en descripción, T 24 / 20 en títulos configurados como `.h2` | C 16 / 15 y T 24 / 20 |
| Ficha estándar, calculadora | Calculadora de pedidos · Especificaciones técnicas · Ahorrá más por cantidad | T 20–27, peso 700 para títulos, C 14,5 para subtítulo y especificaciones | T 24 / 22, C 15 para subtítulo y C 14 para datos |
| Ficha estándar, tabla y resumen de la calculadora | Cantidad · Precio unitario USD · Dólar blue · Total | C 10,5–17 según el dato, con pesos locales | C 12 para encabezados, C 14 para celdas y C 18 para importes destacados |
| Carrito, encabezado y estado vacío | Tu carrito · Tu carrito está vacío · Seguir comprando | T 40 / 30 para títulos, B 15 cuando la acción se muestra como botón | T 40 / 30 y B 15 |
| Carrito, tabla de artículos | Producto · Cantidad · Total · Termo Media Manija | C 10 para encabezados en mayúsculas, T 15 para nombre, C 14 para SKU y precio unitario, C 16 para subtotal y cantidad | C 12 para encabezados, T 16 para nombre, C 14 para datos y C 16 para importe y cantidad |
| Carrito, resumen y acción | Total de referencia · Disponibilidad, precios y envío a confirmar al cotizar. · Revisar pedido | T 16 para etiqueta del total, C 18 para importe, C 13 para nota, B 15 para botón | T 16, C 18, C 13 y B 15, respectivamente |
| Notificación de carrito, si se activa | Ver carrito · Seguir comprando · Nombre del producto | B 15, C 15 para el enlace con estilo de botón, T 15 para nombre del producto | B 15, C 14 y T 16, respectivamente |
| Vista previa del carrito | Revisá tu pedido y completá tus datos · Artículos solicitados | T 52 / 40 y T 24 / 20, respectivamente | T 40 / 30 y T 24 / 20, respectivamente |
| Vista previa, tabla | Producto · SKU · Cantidad · Total | C 12 para encabezado de escritorio, C 11 para etiquetas móviles, C 16 / 15 para datos y C 13 para variante | C 12 para encabezados y etiquetas, C 16 / 15 para datos y C 13 para variante |

La diferencia de «Agregar al carrito» nace en el código. El catálogo usa `.cg2-card-button`, que fija **12 px**. La ficha usa `.button`, que entra en el estilo global de **15 px** y tiene su propio espaciado. En ambas vistas la familia viene del cuerpo del tema. Para igualar su apariencia tipográfica, la decisión es compartir **familia, peso, tamaño, espaciado e interlineado**. La altura, el borde y el relleno son decisiones de diseño distintas. En la tarjeta móvil hay que revisar cómo entra el texto junto a «X 35» con la grilla de dos columnas.

Referencias: [tarjeta de catálogo](../snippets/collection-grid2-card.liquid), [CSS del catálogo](../assets/section-collection-grid2.css), [botones de ficha](../snippets/product-request-buttons.liquid), [CSS de ficha](../assets/section-quote-product.css), [calculadora](../assets/order-calculator.css), [carrito](../assets/component-cart-items.css) y [vista previa](../assets/section-contact-form.css).

## Inicio, banners, mayoristas, personalización y contacto

| Dónde aparece | Texto de ejemplo | Hoy | Propuesta para revisar |
| --- | --- | --- | --- |
| Inicio, catálogo, mayoristas, personalización y contacto, antetítulo del banner | CATÁLOGO MAYORISTA | C 12 / 10, px configurados por bloque | C 12 |
| Mismos banners, encabezado principal | Termo, botellas y más para tu negocio · Hablemos de tu próximo pedido | T 52 / 40, clase `.h0` | T 52 / 40 |
| Mismos banners, texto introductorio | Descripción bajo el encabezado | C 20 / 16, px configurados por bloque | C 20 / 16 |
| Mismos banners, botones | Ver productos · Soy mayorista · Solicitar cotización · Ver catálogo | B 15 | B 15 |
| Inicio y catálogo, navegación con íconos | Termos · Mates · Botellas Deportivas · Sets y Combos | **Archivo Medium 500** 12 / 11, fuente local activa en ambas plantillas | C 13, rol de navegación |
| Navegación con íconos, leyenda opcional | Texto secundario bajo una categoría, si está configurado | Familia local de la sección, 10 px | C 12 |
| Inicio, colección destacada | Colección destacada | T 40 / 30 | T 32 / 26 |
| Inicio, destacados, búsqueda y recomendaciones, tarjeta Dawn | Nombre de producto · Precio · Agotado | T 13 / 12 en la tarjeta estándar con `.h5`, C 16 en precio y C 12 en distintivos | T 16 / 15 para título, C 16 para precio y C 12 para distintivos |
| Inicio, bloque mayorista | PARA MAYORISTAS · Abastecé tu negocio con los mejores productos | C 13 / 12 y T 52 / 40, respectivamente, tamaños del bloque | C 12 y T 40 / 30, respectivamente |
| Inicio, descripción, beneficios y botón mayorista | Texto de presentación · Beneficio comercial · Quiero ser mayorista | C 16 para descripción, C 15 para beneficio y B 15 efectivo en el botón | C 16 / 15, C 15 y B 15, respectivamente |
| Inicio, bloque de grabado | Convertí un producto en algo único · Quiero personalizar | T 36 / 30, C 12 / 11 para antetítulo, C 16 para descripción, C 15 para beneficio, B 15 efectivo para botón | T 32 / 26, C 12, C 16 / 15, C 15 y B 15, respectivamente |
| Personalización, sección de productos | PRODUCTOS PERSONALIZABLES · Una amplia variedad de productos | C 12 negrita para antetítulo, T 40 / 30 para título, C 14 para descripción | C 12, T 32 / 26 y C 16 / 15, respectivamente |
| Personalización, tarjetas y botón del catálogo | Termos · Botellas · Ver catálogo completo | C 12 negrita para categorías, B 15 para el botón | C 13 para categorías y B 15 para el botón |
| Mayoristas y personalización, pasos | ¿Cómo comprar? · ¿Cómo funciona? · Elegí tus productos · Consultanos | T 30 / 26 para título de sección, T 16 para títulos de pasos, C 16 para subtítulo, C 14 para descripción y numeración | T 32 / 26, T 16, C 16 / 15 y C 14, respectivamente |
| Beneficios y suscripción, varias páginas | Más que un proveedor, somos tu aliado · ¿Por qué contactarnos? | T 28 / 24 en Inicio, T 40 / 30 en Contacto | T 32 / 26 |
| Beneficios y suscripción, tarjetas | Stock permanente · Precios por volumen · Envíos a todo el país | C 14 negrita para título y C 13 para descripción | C 14 seminegrita y C 13 |
| Beneficios y suscripción, formulario | Suscribite y recibí novedades · Tu correo electrónico · Suscribirme | T 18, C 14 en el campo, B 15 en el botón, C 13 para descripción | T 18, C 16 en el campo, B 15 y C 13, respectivamente |
| Contacto y vista previa, antetítulo del formulario | SOLICITÁ TU COTIZACIÓN | C 12 negrita | C 12 seminegrita |
| Contacto, título del formulario | Completá el formulario | T 52 / 40 | T 40 / 30 |
| Contacto y vista previa, campos | Nombre · Correo electrónico · Provincia · Mensaje | C 13 seminegrita para etiquetas, C 14 / 16 para valores y marcadores | C 14 seminegrita para etiquetas, C 16 para valores y marcadores |
| Contacto y vista previa, texto auxiliar y botón | Campos obligatorios · Aviso de privacidad · Enviar solicitud de cotización | C 12 para notas, C 14 para descripción y B 15 para botón | C 12 para notas, C 15 para descripción y B 15 para botón |
| Contacto, panel lateral | Hablá directamente por WhatsApp · Otros medios de contacto · Horarios de atención | T 18 / 17 para WhatsApp, T 24 / 20 para contacto, T 14 para cada detalle, C 15 seminegrita para el valor | T 18 / 17, T 24 / 20, T 14 y C 15, respectivamente |
| Contacto, preguntas frecuentes | Preguntas frecuentes · ¿Cuál es la compra mínima? | T 40 / 30 para la sección, T 15 para la pregunta, C 16 / 15 para la respuesta | T 32 / 26 para la sección, T 16 para la pregunta y C 16 / 15 para la respuesta |

El título de los banners usa `.h0` porque su ajuste de tamaño personalizado está desactivado. Los valores de 48 / 32 px guardados en esos bloques quedan inactivos. Los antetítulos y subtítulos sí tienen tamaño personalizado activo. En los bloques de beneficios, suscripción, promoción mayorista y personalización, las fuentes locales guardadas están desactivadas en las instancias revisadas.

Referencias: [banner](../sections/image-banner.liquid), [categorías](../sections/image-categories.liquid), [Inicio](../templates/index.json), [Mayoristas](../templates/page.mayoristas.json), [Personalización](../templates/page.customlaser.json), [Contacto](../templates/page.contact.json) y [suscripción](../sections/newsletter.liquid).

## Navegación, búsqueda y pantallas adicionales

| Dónde aparece | Texto de ejemplo | Hoy | Propuesta para revisar |
| --- | --- | --- | --- |
| Franja superior | Te damos la bienvenida a nuestra tienda | T 13 / 12, clase `.h5` | C 13 |
| Encabezado, menú principal y desplegable | Nombres del menú `main-menu` de Shopify | C 14 en el menú de escritorio, C 18 en el menú móvil | C 14 / 16 |
| Encabezado y pie, idioma y país | Español · Argentina | C 13–14 según el control y la superficie | C 14 |
| Pie, bloque de enlaces si se añade desde el editor | Título de columna · Nombre de enlace | T 18 / 16 para títulos, C 14 en enlaces de escritorio | T 18 / 16 y C 14 |
| Pie, línea legal | © Comprabox · Política de privacidad | C 11 | C 12 |
| Buscador de encabezado y página de búsqueda | Buscar · Búsqueda | C 16 para entrada, C 16 para etiqueta inicial de campo y C 10 cuando flota | C 16 para entrada, C 16 para etiqueta inicial y C 12 cuando flota |
| Búsqueda predictiva | Productos · Nombre del producto · Buscar «termo» | C 10 en encabezados de grupos, T 13 / 12 en títulos de sugerencias con `.h5`, C 12 en precio cuando se muestra | C 12 para grupos, T 15 para nombres y C 14 para precio |
| Búsqueda, página de resultados | Resultados de búsqueda · Ordenar por · Disponibilidad | T 24 / 20 en título, C 13–14 en filtros y orden | T 24 / 22, C 14 en filtros y orden |
| Búsqueda, catálogo y blog, paginación | 1 · 2 · 3 | C 14 para enlaces con clase `.link`, C 16 / 15 para el número activo si solo hereda | C 14 |
| Índice de colecciones | Collections · Nombre de colección | T 40 / 30 para el título de página y T 18 / 17 en títulos estándar de tarjeta | T 40 / 30 y T 16 / 15, respectivamente |
| Blog y artículo | Nombre del blog · Título de artículo · Fecha · Autor | T 40 / 30 en títulos principales, T 24 / 20 en tarjeta con extracto, C 10 en fecha y autor de artículo | T 40 / 30, T 24 / 20 y C 12, respectivamente |
| Artículo, contenido y comentarios cuando están activos | Texto del artículo · Nombre · Correo electrónico · Publicar comentario | C 16 / 15 en texto general, C 16 en campos, B 15 para envío | C 16 / 15, C 16 y B 15, respectivamente |
| Cuenta, acceso y registro | Inicio de sesión · Crear cuenta · Activar cuenta · Restablecer tu contraseña | T 40 / 30 en encabezados principales, C 13 en varios campos de cuenta, B 15 en botones | T 40 / 30, C 16 en entradas, B 15 en botones |
| Cuenta, direcciones e historial | Cuenta · Direcciones · Historial de pedidos · Pedido … | T 40 / 30 en título de página, C 12 en encabezados de tabla y C 16 en datos de escritorio | T 40 / 30, C 12 para encabezados y C 16 para datos |
| Página 404 | 404 · Página no encontrada · Seguir comprando | C 16 / 15 para código, T 40 / 30 para título, B 15 para el botón | C 14, T 40 / 30 y B 15 |
| Página de tienda protegida | Próximamente · Entrar con contraseña | T 40 / 30 para `Próximamente`, C 14–18 para mensajes y enlaces según el componente | T 40 / 30, C 14 para enlaces y C 16 para mensajes |
| Tarjeta de regalo, plantilla independiente | Saldo · Código · Copiar código | T 40 / 30 para título principal, C 18 en código, C 15 en botones de la plantilla | T 40 / 30, C 18 y C 15, respectivamente |
| Páginas de políticas y contenido del administrador | Política de privacidad · Términos del servicio | El texto y el marcado pueden venir del administrador. El cuerpo del tema parte de C 16 / 15 | Revisar en Shopify y asignar T a encabezados y C al contenido |

El pie local tiene desactivado su formulario nativo de suscripción. La suscripción visible en las plantillas auditadas viene de las secciones de newsletter. El carrito está configurado como notificación para el flujo nativo. El carrito lateral y otras variantes de sección están disponibles en código y pueden activarse en el editor.

Referencias: [grupo del encabezado](../sections/header-group.json), [grupo del pie](../sections/footer-group.json), [búsqueda](../sections/main-search.liquid), [cuentas](../assets/customer.css), [contraseña](../layout/password.liquid) y [tarjeta de regalo](../templates/gift_card.liquid).

## Decisiones para aprobar antes de cambiar el tema

| Decisión | Propuesta inicial | Alternativa para revisar |
| --- | --- | --- |
| Familia de texto | Encabezados con la fuente de títulos del tema. Cuerpo, precios, navegación, campos y botones con la fuente de cuerpo. Cambiar cualquiera de las dos en Shopify debe actualizar esos roles. | Usar también la fuente de títulos en los nombres de categorías con íconos, siempre desde el ajuste global de títulos. |
| Botones de acción | Mantener **15 px** como valor global inicial y hacer que catálogo y ficha tomen el mismo ajuste. | Elegir otro tamaño global desde el tema. |
| Botones de cantidad | Usar **14 px** para `X 3`, `X 18` y `X 35` en ambas superficies. | Usar **15 px** si se prefiere la misma medida que en botones de acción. |
| Precios de cotización | **26 px** para el importe principal, **18 px** para «Desde» y **16–18 px** en líneas y totales de carrito según su función. | Mantener 26 px en ficha y revisar un tamaño móvil menor para la tarjeta si los importes largos se parten. |
| Jerarquía de títulos | Usar **52 / 40** en banners principales, **40 / 30** en páginas y fichas, **32 / 26** en secciones comerciales y **16 / 15** en tarjetas de producto. | Mantener tamaños por sección cuando exista una razón editorial aprobada. |
| Escalas y ajustes locales | Usar las escalas globales de cuerpo y títulos para sus roles. Conservar el ajuste global de tamaño de botones. Revisar los valores locales en px que hoy quedan fuera de esas escalas y la aplicación doble de la escala de cuerpo en algunos textos del formulario y de productos personalizables. | Conservar excepciones de tamaño por sección donde el editor necesite ajustar la composición. |

Al validar la implementación, conviene cambiar temporalmente las fuentes y las escalas en una vista previa del editor. Eso permite comprobar tanto que los roles responden a la configuración como que «Agregar al carrito» coincide entre ficha y catálogo en escritorio y móvil.
