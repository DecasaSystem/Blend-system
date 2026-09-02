# BLEND — Plan de proyecto

**Casa de batidos, matcha y açaí.** Tienda online + panel operativo para el equipo.

---

## 1. Dirección de diseño

### Concepto: *Sobreimpresión* (overprint)

La marca se llama **Blend**. El sistema visual entero es, literalmente, color mezclándose:
círculos translúcidos de naranja, morado y verde que se superponen con `mix-blend-mode`
y generan colores nuevos donde se cruzan — igual que una fruta cayendo en la licuadora.
Estética de impresión risográfica: tinta plana, grano fino, sobreimpresión, etiquetas
tipo sticker. Nada de degradados genéricos ni tarjetas grises con sombra suave.

**Elemento firma:** *el lente Blend* — un cluster de manchas de tinta que reacciona al
scroll y al cursor. En las tarjetas de producto, dos círculos de ingrediente se
superponen al hacer hover y producen el color exacto del batido.

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#1B0B2E` | Berenjena casi negro. Texto y fondos densos. |
| `--ube` | `#7B3FF2` | Morado eléctrico. Color primario de marca. |
| `--mango` | `#FF6A1A` | Naranja mango. Acciones, precios, CTA. |
| `--matcha` | `#8FD14F` | Verde matcha. Estados positivos, frescura. |
| `--paper` | `#F7F1FF` | Papel con tinte lila. Fondo claro. |
| `--pulp` | `#FFD166` | Cúrcuma. Acento pequeño, badges. |

Regla: los tres primarios nunca compiten en el mismo bloque. Cada sección tiene un
color dominante y los otros dos aparecen solo en la sobreimpresión.

### Tipografía

- **Display — Fraunces** (variable, ejes `wonk` y `soft` al máximo). Serif orgánica,
  ligeramente torcida. Solo titulares grandes.
- **Cuerpo — Archivo** (variable). Grotesca limpia, con carácter, sin ser Inter.
- **Utilidad — Martian Mono**. Precios, etiquetas, números de pedido, dashboard.

### Movimiento

Una sola secuencia orquestada al cargar el hero + revelados sutiles al scroll +
micro-interacciones en hover. Todo respeta `prefers-reduced-motion`.

---

## 2. Arquitectura

```
Next.js 15 (App Router) · TypeScript · Tailwind v4 · Framer Motion
├── Vista pública        →  /
├── Checkout             →  /checkout
└── Vista equipo         →  /equipo  (pedidos + editor de la página)
```

**Datos:** todo vive en `localStorage` hasta la fase 7.

- `src/lib/content.ts` — valores de fábrica del sitio.
- `src/lib/site.ts` — lo que el equipo publica desde el editor. Gana sobre los
  valores de fábrica y se guarda entero, no como parches.
- `src/lib/cart.ts` — carrito y precios. Un solo sitio calcula un precio.
- `src/lib/orders.ts` — pedidos, con aviso entre pestañas.

En la fase 7 se migra a base de datos (Neon/Supabase vía Vercel Marketplace) sin
cambiar la forma de los objetos ni la UI.

**Pagos: Wompi.** Todo lo que sabe la app de la pasarela está en
`src/lib/payments.ts`. Sin claves, la tienda funciona igual y sólo se cobra al
recibir o al recoger.

Un pedido con tarjeta nace en estado `pago` y **no aparece en el tablero**: la
barra no debe preparar nada que no se haya cobrado.

Lo libera el webhook, y ahí hay dos comprobaciones, no una:

1. Se recalcula el checksum del aviso con el secreto de eventos.
2. **Se le vuelve a preguntar a Wompi por la transacción.** Hace falta porque la
   firma sólo cubre los campos que el propio aviso lista en
   `signature.properties`, y `reference` no está entre ellos. Con la firma a
   secas, alguien podría tomar el aviso legítimo de su propio pago, cambiarle la
   referencia por la de otro pedido —el checksum seguiría cuadrando— y sacar ese
   pedido a la barra sin pagarlo. La referencia y el monto se leen de la
   respuesta de Wompi, nunca del cuerpo recibido.

Además se comprueba que lo cobrado sea lo que costaba el pedido.

**Mapa:** MapLibre GL con teselas de OpenFreeMap (libres, sin clave ni cuota).
Se carga sólo al entrar en pantalla; si falla, queda el mapa ilustrado.

El worker de MapLibre se copia a `public/maplibre/` antes de `dev` y `build`
(`scripts/setup-maplibre.mjs`): MapLibre lo busca en `import.meta.url`, que tras
el bundler apunta a la propia página, y el mapa se queda cargando para siempre
sin dar ningún error.

---

## 3. Secciones de la vista pública

1. **Barra superior** — marquee con el batido del día, horario y tiempo de entrega.
2. **Hero / carrusel** — video a pantalla completa, 3–4 slides, titular sobreimpreso,
   indicadores verticales. Editable desde el panel.
3. **Batidos del día** — 3 fichas rotativas con precio especial y contador.
4. **Menú** — categorías (Batidos · Matcha · Açaí bowls · Cold brew · Extras),
   filtros, rieles horizontales en móvil, ficha de producto con personalización
   (tamaño, base, toppings, sin azúcar).
5. **Constructor "Arma tu blend"** *(extra creativo)* — eliges 3 ingredientes y la
   mancha de color se mezcla en vivo mostrando el color final y las kcal.
6. **Carrito** — drawer lateral, persistente, con upsell de toppings.
7. **Tiendas** — mapa interactivo, tarjetas de sucursal, horarios, "cómo llegar".
8. **Contacto** — formulario + WhatsApp + redes.
9. **Extras propuestos** — programa de sellos digital, suscripción semanal,
   reseñas en tickets de papel, footer con receta del mes.

## 4. Vista equipo (`/equipo`)

- **Pedidos en vivo:** tablero kanban (Nuevo → Preparando → Listo → Entregado) con
  dirección, notas, alergias, método de pago y temporizador por pedido.
- **Sonido y notificación** al entrar un pedido nuevo.
- **Editor de la página:** cambiar videos del carrusel, imágenes de productos y de
  secciones, textos, precios, disponibilidad, y el batido del día.
- **Catálogo:** alta/baja de productos y toppings.
- **Sucursales:** editar direcciones, horarios y coordenadas del mapa.
- **Métricas:** ventas del día, top productos, ticket promedio.
- Acceso protegido con contraseña (simple ahora, auth real después).

---

## 5. Fases

| Fase | Entregable | Estado |
|---|---|---|
| **1** | **Apartado visual completo de la vista pública** (con datos de ejemplo) | **listo — en revisión** |
| **1.5** | **Pasada de responsive y UX móvil** (360 / 390 / 820 / 1440) | **listo — en revisión** |
| **2** | **Carrito funcional + personalización de producto** | **listo — en revisión** |
| **3** | **Vista `/equipo`: tablero de pedidos** | **listo — en revisión** |
| **4** | **Vista `/equipo`: editor de contenido** | **listo — en revisión** |
| **5** | **Mapa interactivo real** | **listo — en revisión** |
| **6** | **Pago con tarjeta** | **listo — falta probarlo contra Stripe real** |
| **7a** | **Base de datos, login del equipo y sesiones** | **listo — en revisión** |
| **7b** | **Cuentas de clientes** | **listo — en revisión** |
| 7c | Deploy en Vercel | pendiente |

**Fase 1 se revisa antes de continuar.** Cualquier ajuste de color, tipografía o
composición se corrige ahí, porque todo lo demás hereda ese sistema.

---

## 6. Cómo verlo

```bash
npm run dev                           # http://localhost:3000
node scripts/shots.mjs                # capturas a 360 / 390 / 820 / 1440 px
node scripts/shots-cart.mjs           # capturas del flujo de pedido
node scripts/shots-board.mjs          # capturas del tablero de la barra
node scripts/shots-editor.mjs         # capturas del editor de contenido
node scripts/cart-flow.mjs            # prueba el carrito de punta a punta
node scripts/board-flow.mjs           # prueba tienda → barra → estados
node scripts/editor-flow.mjs          # prueba editar → publicar → tienda
node scripts/shots-map.mjs            # capturas del mapa
node scripts/map-flow.mjs             # prueba el mapa, con y sin red
```

Las que tocan la base necesitan las credenciales:

```bash
npm run db:push                       # aplica el esquema
npm run db:check                      # comprueba la conexión
node --env-file=.env.local scripts/create-user.mjs correo "Nombre" admin
node --env-file=.env.local scripts/auth-flow.mjs    # acceso y sesión
node --env-file=.env.local scripts/board-flow.mjs   # tienda → Postgres → barra
node --env-file=.env.local scripts/editor-flow.mjs  # publicar → servidor
node --env-file=.env.local scripts/account-flow.mjs # cuentas de clientes
node --env-file=.env.local scripts/google-flow.mjs  # entrar con Google
node --env-file=.env.local scripts/payment-flow.mjs # capa de pagos
node --env-file=.env.local scripts/shots-account.mjs # capturas de la cuenta
node --env-file=.env.local scripts/personalizar-flow.mjs # foto del hero, precios y adicionales
node --env-file=.env.local scripts/media-flow.mjs   # subida a Cloudinary (sube y borra)
node --env-file=.env.local scripts/stats-flow.mjs   # métricas (siembra pedidos y los borra)
node --env-file=.env.local scripts/team-flow.mjs    # cuentas del equipo y CSV
```

El webhook se prueba aparte, con claves ficticias y un servidor que hace de API
de Wompi, porque hay que arrancar el servidor apuntando a él:

```bash
$env:WOMPI_PUBLIC_KEY='pub_test_ficticia'
$env:WOMPI_INTEGRITY_SECRET='test_integrity_ficticio'
$env:WOMPI_EVENTS_SECRET='test_events_ficticio'
$env:WOMPI_API_BASE='http://localhost:4010/v1'
npm run dev
node --env-file=.env.local scripts/webhook-flow.mjs
node scripts/overflow.mjs <url> <sel> # busca desbordamiento horizontal
```

`shots.mjs` usa el Chrome ya instalado (no descarga navegadores) y además reporta
desbordamiento horizontal y objetivos táctiles menores a 40 px.

Rutas: `/` (tienda) · `/equipo` y `/checkout` (marcadores de las fases siguientes).

## 7. Decisiones tomadas por defecto — dime si cambian

- **Nombre:** BLEND.
- **Ciudad:** Bogotá, con cuatro sedes de ejemplo (Chapinero, Usaquén, Parque 93,
  La Candelaria). Se cambian en `src/lib/content.ts`.
- **Moneda:** peso colombiano, sin decimales (`es-CO`).
- **Ciudad:** Armenia, Quindío, con dos sedes reales (Cra. 14 #25 Norte-2 y
  Cra. 6 #3-423) y sus coordenadas.
- **Entrar con Google:** flujo de token de identidad, así que no se guarda
  ningún secreto de cliente — sólo `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, que es
  público por diseño. Sin él, la tienda funciona igual y sólo desaparece el
  botón. Si alguien que ya tenía cuenta con contraseña entra con Google usando
  el mismo correo, se vincula en vez de duplicarse; es seguro porque sólo se
  aceptan correos que Google marca como verificados.
- **Cuentas de clientes:** tabla `customers` y cookie propias, separadas de las
  del equipo a propósito. Así un descuido en una comprobación de rol no puede
  darle a un cliente el tablero de pedidos. Comprar sin cuenta sigue siendo
  posible: `orders.customer_id` admite nulo.
- **Acceso a la barra:** usuarios en la tabla `users`, contraseñas con scrypt.
  Sesión en cookie `httpOnly` y token guardado como hash en `sessions`. La
  comprobación vive en el servidor: sin sesión, el panel ni se renderiza.
  Se crean usuarios con `scripts/create-user.mjs`.
- **Imágenes y videos:** no hay fotos de stock. Cada bebida se dibuja con su
  recipiente real y los ingredientes sobreimpresos dentro. Cuando el equipo suba
  una foto o un video, el campo `media` la reemplaza sin tocar el código.
