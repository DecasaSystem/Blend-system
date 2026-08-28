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

**Pagos:** Stripe Checkout. En la fase visual va simulado; se conecta al final.

**Mapa:** MapLibre GL + tiles gratuitos, con pines y estilo propio (sin logo de Google).

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
| 5 | Mapa interactivo real | pendiente |
| 6 | Checkout + Stripe | pendiente |
| 7 | Base de datos, tiempo real y deploy | pendiente |

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
- **Clave de la barra:** `blend2026`, en `src/lib/team.ts`. Es un pestillo, no una
  cerradura: viaja en el bundle del navegador. Se reemplaza por autenticación real
  en la fase 7, y hasta entonces la vista de equipo no muestra nada que no pueda
  ser público.
- **Imágenes y videos:** no hay fotos de stock. Cada bebida se dibuja con su
  recipiente real y los ingredientes sobreimpresos dentro. Cuando el equipo suba
  una foto o un video, el campo `media` la reemplaza sin tocar el código.
