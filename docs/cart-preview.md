# Carrito con cantidades solicitadas

El carrito principal conserva las líneas de Shopify y permite indicar cantidades
enteras positivas sin consultar el stock. Las cantidades solicitadas se guardan
en `localStorage`, por tienda y clave de línea. No cambian las reservas ni el
inventario de Shopify. Al quitar artículos, se descartan sus cantidades guardadas.

`main-cart-footer.liquid` abre `/cart?view=preview-co`. La plantilla
`cart.preview-co.json` carga `cart-preview-co.liquid`; no requiere crear una página
en el administrador. El enlace conserva los parámetros de vista previa del tema.

La nueva sección y `contact-form.liquid` reutilizan
`snippets/contact-quote-content.liquid`. Se mantienen todos los IDs de ajustes del
formulario original. La plantilla nueva parte de los ajustes de contacto actuales
y se puede personalizar desde el editor del tema de manera independiente.

En la revisión, producto y cantidad se completan desde el carrito. El formulario
de contacto de Shopify recibe las variantes, SKU, propiedades visibles, planes de
venta, cantidades, notas y precios de referencia en `contact[Detalle del pedido]`.
No crea una orden ni cobra al cliente. Los descuentos y los precios finales deben
confirmarse al cotizar; los importes mostrados usan el precio unitario original.

## Verificación

Desde la raíz del tema, con las dependencias locales de `apps/quote-service`
instaladas:

```powershell
node --test tests/cart-request.test.cjs
shopify theme check
```

Para comprobarlo en una vista previa real del tema:

1. Agregar un producto al carrito y abrir `/cart`.
2. Introducir una cantidad superior al stock, usar los botones +/− y recargar.
3. Presionar **Revisar pedido** inmediatamente después de editar la cantidad.
4. Comprobar cantidades, variantes e importes en la revisión.
5. Volver al carrito, quitar una línea y revisar nuevamente.
6. Completar el formulario y comprobar la recepción del detalle por el canal de
   contacto configurado en Shopify.

El navegador debe permitir JavaScript y almacenamiento local. La carga inicial de
productos y el carrito lateral conservan las reglas de inventario de Shopify;
este cambio aplica a las cantidades solicitadas en el carrito principal y a su
revisión. No se ha publicado el tema ni enviado formularios reales desde estas
pruebas locales.
