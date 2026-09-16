"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { LATE_AFTER } from "@/lib/orders";

/**
 * Manual de la vista de equipo, dentro de la propia vista.
 *
 * Está escrito para quien atiende la barra, no para quien programó la tienda:
 * cada sección dice qué es, qué se hace ahí paso a paso y qué cuidado tener.
 * Lo que sólo puede hacer un administrador va marcado; a la barra se le
 * enseña igual, para que sepa a quién pedírselo.
 *
 * Los números que aparecen (minutos del cronómetro, etc.) salen del mismo
 * código que los usa, así que no se desactualizan.
 */

type Tone = "mango" | "ube" | "matcha" | "pulp";

const SECTIONS: { id: string; label: string; tone: Tone; adminOnly?: boolean }[] = [
  { id: "empezar", label: "Empezar", tone: "ube" },
  { id: "pedidos", label: "Pedidos", tone: "mango" },
  { id: "pagos", label: "Pagos en línea", tone: "matcha" },
  { id: "metricas", label: "Métricas", tone: "ube" },
  { id: "contenido", label: "Contenido", tone: "pulp" },
  { id: "quiosco", label: "Quiosco", tone: "mango" },
  { id: "reparto", label: "Reparto", tone: "matcha" },
  { id: "cuentas", label: "Cuentas", tone: "matcha", adminOnly: true },
  { id: "clientes", label: "Clientes y sellos", tone: "ube" },
  { id: "problemas", label: "Si algo falla", tone: "mango" },
];

const TONE_BG: Record<Tone, string> = {
  mango: "#FF6A1A",
  ube: "#7B3FF2",
  matcha: "#8FD14F",
  pulp: "#FFD166",
};

export default function HelpPanel({ user }: { user: SessionUser }) {
  const admin = user.role === "admin";
  const [active, setActive] = useState("empezar");

  // La sección que va pasando por pantalla se marca en el índice.
  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(`ayuda-${s.id}`)).filter(
      (n): n is HTMLElement => n !== null,
    );
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace("ayuda-", ""));
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="pb-16">
      {/* Portada */}
      <div className="relative overflow-hidden rounded-[26px] border-[1.5px] border-ink bg-white p-6 sm:p-8">
        {/* Las manchas de la marca. En celular, pequeñas y en la esquina, para no
            taparle el título a nadie. */}
        <div
          className="pointer-events-none absolute -right-6 -top-8 flex sm:-right-8 sm:-top-10"
          aria-hidden="true"
        >
          <span
            className="h-24 w-24 rounded-full bg-mango opacity-80 sm:h-40 sm:w-40"
            style={{ mixBlendMode: "multiply" }}
          />
          <span
            className="-ml-10 mt-6 h-24 w-24 rounded-full bg-ube opacity-80 sm:-ml-16 sm:mt-10 sm:h-40 sm:w-40"
            style={{ mixBlendMode: "multiply" }}
          />
          <span
            className="-ml-10 h-24 w-24 rounded-full bg-matcha opacity-80 sm:-ml-16 sm:h-40 sm:w-40"
            style={{ mixBlendMode: "multiply" }}
          />
        </div>
        <p className="u-mono text-ink/45">Manual de la barra</p>
        <h2 className="u-display mt-2 max-w-xl text-[clamp(2rem,5vw,3.2rem)] leading-[0.95]">
          Cómo se maneja <span className="u-italic text-ube">BLEND</span> desde aquí
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-ink/65">
          Todo lo que pasa en la tienda —los pedidos que entran, lo que se cobra, lo que ve el
          cliente en la página— se atiende desde estas pestañas. Esta guía va sección por sección:
          qué es, qué se hace ahí y qué cuidado tener.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Chip>
            Tu rol: <b>{admin ? "administrador" : "barra"}</b>
          </Chip>
          <Chip>
            {admin
              ? "Ves y puedes cambiar todo, incluidas las cuentas."
              : "Ves pedidos, métricas y contenido. Las cuentas las gestiona un administrador."}
          </Chip>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        {/* Índice */}
        <nav aria-label="Secciones de la ayuda" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ol className="rail -mx-4 px-4 pb-2 lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
            {SECTIONS.map((s, i) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#ayuda-${s.id}`}
                  onClick={() => setActive(s.id)}
                  className={`u-mono flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 transition-colors lg:min-h-9 ${
                    active === s.id
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/15 bg-white text-ink/60 hover:border-ink hover:text-ink"
                  }`}
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.6rem] text-ink"
                    style={{ background: TONE_BG[s.tone] }}
                  >
                    {i + 1}
                  </span>
                  {s.label}
                  {s.adminOnly ? <span className="opacity-50">admin</span> : null}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Secciones */}
        <div className="grid min-w-0 gap-10">
          {/* ------------------------------------------------ 1. Empezar */}
          <Section n={1} id="empezar" tone="ube" title="Empezar" kicker="Lo básico">
            <P>
              La tienda que ven los clientes está en la página principal. Esto que estás viendo es la{" "}
              <b>vista de equipo</b>: sólo se entra con correo y contraseña, y nada de aquí es
              visible desde fuera.
            </P>
            <Grid>
              <Card title="Las pestañas de arriba">
                <Dl>
                  <Dt>Pedidos</Dt>
                  <Dd>El tablero de la barra. Lo que hay que preparar ahora.</Dd>
                  <Dt>Métricas</Dt>
                  <Dd>Cuánto se vendió, qué y a qué hora.</Dd>
                  <Dt>Contenido</Dt>
                  <Dd>Editar lo que ve el cliente: menú, precios, fotos, textos, tiendas.</Dd>
                  <Dt>Cuentas</Dt>
                  <Dd>Quién entra aquí y con qué permisos. Sólo la ve un administrador.</Dd>
                  <Dt>Ayuda</Dt>
                  <Dd>Esta guía.</Dd>
                </Dl>
              </Card>
              <Card title="Tres roles">
                <Dl>
                  <Dt>Barra</Dt>
                  <Dd>
                    Atiende pedidos, mira métricas y puede editar el contenido de la tienda.
                  </Dd>
                  <Dt>Administrador</Dt>
                  <Dd>
                    Todo lo anterior, y además crea y borra cuentas, configura el quiosco y puede
                    borrar el historial de pedidos.
                  </Dd>
                  <Dt>Repartidor</Dt>
                  <Dd>
                    Sólo ve sus domicilios, en una pantalla aparte pensada para el celular. No
                    entra al tablero ni al editor.
                  </Dd>
                </Dl>
              </Card>
            </Grid>
            <Steps
              title="Poner una tablet o computador en la barra"
              steps={[
                <>
                  Abre <Mono>/equipo</Mono> en el navegador y entra con tu correo y contraseña.
                </>,
                <>
                  Pulsa <b>Aviso</b> arriba a la derecha hasta que quede en negro con la nota{" "}
                  <Mono>♪</Mono>. Sonará una vez de prueba y el navegador pedirá permiso para
                  avisar; acéptalo. Hay que hacerlo una vez en cada aparato.
                </>,
                <>
                  Deja la pestaña <b>Pedidos</b> abierta. Se actualiza sola cada pocos segundos; no
                  hace falta recargar.
                </>,
              ]}
            />
            <Tip>
              Para salir, el botón <b>Salir</b> de arriba a la derecha. Si el aparato es compartido,
              sal siempre al terminar el turno.
            </Tip>
          </Section>

          {/* ------------------------------------------------ 2. Pedidos */}
          <Section n={2} id="pedidos" tone="mango" title="Pedidos" kicker="El tablero de la barra">
            <P>
              Cada pedido es una tarjeta que va de izquierda a derecha por cuatro columnas. La
              tarjeta lleva todo lo que hace falta para prepararlo y entregarlo: qué pidió, con qué
              base y adicionales, tamaño, notas, a dónde va y cómo paga.
            </P>
            <Flow
              steps={[
                { label: "Nuevo", tone: "#FF6A1A", desc: "Acaba de entrar. Nadie lo ha tomado." },
                { label: "Preparando", tone: "#7B3FF2", desc: "Alguien lo está haciendo." },
                { label: "Listo", tone: "#8FD14F", desc: "Espera en la barra o al domiciliario." },
                { label: "Entregado", tone: "#8A7BA0", desc: "Cerrado. Cuenta para los sellos." },
              ]}
            />
            <Grid>
              <Card title="Mover un pedido">
                <Ul>
                  <li>
                    El botón grande de cada tarjeta lo pasa a la siguiente columna:{" "}
                    <b>Empezar → Marcar listo → Marcar entregado</b>.
                  </li>
                  <li>
                    La flecha pequeña <Mono>←</Mono> lo devuelve una columna atrás, por si se
                    pulsó de más.
                  </li>
                  <li>Los más viejos van arriba: se atiende por orden de llegada.</li>
                </Ul>
              </Card>
              <Card title="El cronómetro">
                <P small>
                  Cada tarjeta cuenta los minutos que lleva en su columna. Cuando se pasa de lo
                  razonable se pone naranja y dice <b>«Se está pasando»</b>:
                </P>
                <Dl>
                  <Dt>Nuevo</Dt>
                  <Dd>más de {LATE_AFTER.nuevo} min sin empezar</Dd>
                  <Dt>Preparando</Dt>
                  <Dd>más de {LATE_AFTER.preparando} min en la licuadora</Dd>
                  <Dt>Listo</Dt>
                  <Dd>más de {LATE_AFTER.listo} min esperando a entregarse</Dd>
                </Dl>
              </Card>
            </Grid>
            <Grid>
              <Card title="Lo que dice la tarjeta">
                <Dl>
                  <Dt>B-1043</Dt>
                  <Dd>El número de pedido. Es el que el cliente ve en su pantalla.</Dd>
                  <Dt>En línea / Mostrador</Dt>
                  <Dd>Si lo pidió desde la página o desde la tablet del quiosco.</Dd>
                  <Dt>A domicilio / Recoger</Dt>
                  <Dd>Con la dirección o la sede donde lo recoge.</Dd>
                  <Dt>Pagado en línea</Dt>
                  <Dd>Ya está cobrado por Bold. No se le cobra nada al entregar.</Dd>
                  <Dt>Sin pagar</Dt>
                  <Dd>Se cobra al recoger: efectivo o datáfono. Los domicilios siempre llegan pagados.</Dd>
                  <Dt>🛵 Repartidor</Dt>
                  <Dd>
                    En los domicilios, un desplegable para asignar quién lo lleva. Cuando el
                    repartidor toca «Salí», la tarjeta dice <b>En camino con…</b>.
                  </Dd>
                </Dl>
              </Card>
              <Card title="Avisos que no se pueden pasar por alto">
                <P small>
                  Si el cliente escribió <b>alergia</b>, <b>sin gluten</b>, <b>intolerancia</b> o
                  algo parecido en las notas, la tarjeta lo saca en un recuadro naranja con{" "}
                  <Mono>!</Mono>, aparte del resto. Léelo antes de empezar.
                </P>
                <P small>
                  Cuando entra un pedido nuevo suena una campana, sale un aviso abajo y la tarjeta
                  brilla unos segundos.
                </P>
              </Card>
            </Grid>
            <Grid>
              <Card title="Los números de arriba">
                <P small>
                  <b>Pedidos hoy</b>, <b>Sin entregar</b>, <b>Ventas del día</b> y{" "}
                  <b>Ticket promedio</b> son sólo de hoy y se ponen a cero a medianoche. Las
                  ventas cuentan lo que ya se empezó a preparar, no lo que sigue en Nuevo.
                </P>
              </Card>
              <Card title="En el celular">
                <P small>
                  En pantalla pequeña se ve una columna a la vez; cambia con las pestañas de
                  colores (Nuevo, Preparando…). El número al lado es cuántos hay en cada una.
                </P>
              </Card>
            </Grid>
            <Warn title="Dos botones con los que hay que tener cuidado">
              <Ul>
                <li>
                  <b>Pedido de prueba</b> crea un pedido inventado, marcado «Sin pagar». Sirve para
                  probar el sonido en un aparato nuevo. Cuenta en las métricas hasta que se borre el
                  historial, así que úsalo sólo cuando haga falta.
                </li>
                <li>
                  <b>Borrar historial</b> (abajo del tablero, sólo administradores) borra{" "}
                  <b>todos</b> los pedidos guardados, de todos los días, y con ellos las métricas
                  y los sellos de los clientes. No se puede deshacer.
                </li>
              </Ul>
            </Warn>
          </Section>

          {/* ------------------------------------------------ 3. Pagos */}
          <Section n={3} id="pagos" tone="matcha" title="Pagos en línea" kicker="Bold">
            <P>
              El cliente puede pagar desde la página con tarjeta, PSE, Nequi o Botón Bancolombia.
              Lo cobra <b>Bold</b>, la misma empresa del datáfono, en su propia pantalla segura.
              Aquí no se maneja ningún dato de tarjeta.
            </P>
            <Grid>
              <Card title="Qué pasa con un pedido pagado en línea">
                <Ul>
                  <li>
                    Mientras el cliente está pagando, el pedido <b>no aparece</b> en el tablero:
                    la barra no debe preparar nada que no esté cobrado.
                  </li>
                  <li>
                    En cuanto Bold confirma el pago, entra a <b>Nuevo</b> con la etiqueta{" "}
                    <b>Pagado en línea</b>. Suele ser en el mismo segundo en que el cliente vuelve
                    a la página.
                  </li>
                  <li>
                    Con PSE el banco puede tardar unos minutos: el pedido entra cuando el banco
                    confirme, aunque el cliente ya haya cerrado la página.
                  </li>
                  <li>
                    Si el banco rechaza el pago, el pedido no llega nunca al tablero y el cliente
                    puede volver a intentarlo o elegir pagar al recibir.
                  </li>
                </Ul>
              </Card>
              <Card title="Si un cliente dice que pagó y no lo ves">
                <Steps
                  compact
                  steps={[
                    <>Espera un minuto: con PSE el banco tarda.</>,
                    <>
                      Pídele el <b>número de pedido</b> (B-…) o el <b>ID de transacción</b> de
                      Bold (T_…) que sale en su comprobante.
                    </>,
                    <>
                      Búscalo en el panel de Bold (bold.co → Ventas). Si allí está aprobado, el
                      pedido entra solo en cuanto llegue el aviso; si dice rechazado, no se cobró.
                    </>,
                    <>Si sigue sin aparecer pasados unos minutos, avisa a quien administra la página.</>,
                  ]}
                />
              </Card>
            </Grid>
            <Tip>
              <b>Devoluciones y anulaciones</b> se hacen desde el panel de Bold, no desde aquí. El
              pedido en el tablero no cambia solo al anularlo: márcalo como entregado o déjalo
              constar en las notas del turno.
            </Tip>
          </Section>

          {/* ------------------------------------------------ 4. Métricas */}
          <Section n={4} id="metricas" tone="ube" title="Métricas" kicker="Lo que se vendió">
            <P>
              Elige arriba el periodo: <b>7, 30 o 90 días</b>. Todo lo demás se recalcula solo.
              Sólo cuentan los pedidos confirmados (los que llegaron al tablero); los que se
              quedaron esperando un pago en línea no.
            </P>
            <Grid>
              <Card title="Las tarjetas grandes">
                <Dl>
                  <Dt>Ventas</Dt>
                  <Dd>Lo facturado en el periodo, y cuánto cambió frente al periodo anterior.</Dd>
                  <Dt>Pedidos</Dt>
                  <Dd>Cuántos entraron.</Dd>
                  <Dt>Ticket promedio</Dt>
                  <Dd>Ventas divididas entre pedidos.</Dd>
                  <Dt>Bebidas servidas</Dt>
                  <Dd>Unidades, sumando cantidades.</Dd>
                </Dl>
              </Card>
              <Card title="Las gráficas">
                <Dl>
                  <Dt>Ventas por día</Dt>
                  <Dd>Pasa el cursor para ver el día exacto. Un día sin ventas sale en cero.</Dd>
                  <Dt>Lo que más se vende</Dt>
                  <Dd>Unidades y plata por producto. Sirve para decidir el batido del día.</Dd>
                  <Dt>A qué hora piden</Dt>
                  <Dd>Pedidos por hora, en hora de Colombia. Para cuadrar turnos.</Dd>
                  <Dt>Cómo pagan · Cómo lo reciben · Por tienda</Dt>
                  <Dd>Repartos de pagos, domicilio frente a recoger, y por sede.</Dd>
                </Dl>
              </Card>
            </Grid>
            <Tip>
              <b>Descargar CSV</b> baja una hoja de cálculo con los datos del periodo, para abrirla
              en Excel o Google Sheets y hacer la contabilidad.
            </Tip>
          </Section>

          {/* ------------------------------------------------ 5. Contenido */}
          <Section
            n={5}
            id="contenido"
            tone="pulp"
            title="Contenido"
            kicker="Editar la página de la tienda"
          >
            <P>
              Aquí se cambia lo que ve el cliente sin tocar código: fotos, precios, productos,
              textos, sedes. Funciona como un <b>borrador</b>: nada de lo que escribas se ve en la
              tienda hasta que pulses <b>Publicar</b>.
            </P>
            <Steps
              title="Cómo se hace un cambio"
              steps={[
                <>Elige la pestaña de lo que quieres cambiar (Menú, Precios, Textos…).</>,
                <>
                  Abre el recuadro del elemento (cada producto, sede o slide es uno) y edita los
                  campos. La barra de abajo dirá <b>«Cambios sin publicar»</b>.
                </>,
                <>
                  Pulsa <b>Publicar</b>. En un par de segundos la tienda ya lo muestra; si el
                  cliente tiene la página abierta, la verá al recargar.
                </>,
                <>
                  ¿Te equivocaste antes de publicar? <b>Descartar</b> vuelve a lo que estaba
                  publicado.
                </>,
              ]}
            />
            <Warn title="Restaurar no es Descartar">
              <b>Restaurar</b> devuelve <b>toda</b> la página a los textos, precios y fotos de
              fábrica y borra todo lo que se haya publicado alguna vez. Sólo tiene sentido si se
              rompió algo y no hay cómo arreglarlo. Pide confirmación, pero después no se puede
              deshacer.
            </Warn>

            <h4 className="u-display mt-2 text-2xl">Las pestañas del editor</h4>
            <Grid>
              <Card title="Carrusel">
                <P small>
                  Las pantallas grandes de arriba de la página. Cada slide tiene antetítulo,
                  título (una línea en negro y otra a color), botón y dos imágenes: la{" "}
                  <b>foto principal</b> junto al texto y el <b>fondo</b>, que admite video. Si dejas
                  una vacía, se dibuja la ilustración del vaso.
                </P>
              </Card>
              <Card title="Del día">
                <P small>
                  Las tres bebidas en oferta, con su precio rebajado, cuántas quedan y por qué
                  están de oferta. Al llegar a cero unidades la tienda las muestra agotadas.
                  Cámbialas cada mañana.
                </P>
              </Card>
              <Card title="Menú">
                <P small>
                  Las categorías (Batidos, Matcha, Açaí…) y los productos de cada una: nombre,
                  descripción, <b>precio de cada vaso</b> (chico, grande…), color, foto, recipiente,
                  ingredientes, etiqueta («Nuevo», «Más pedido») y el interruptor <b>Agotado</b>,
                  que lo deja visible pero sin poderse pedir.
                </P>
              </Card>
              <Card title="Arma tu blend">
                <P small>
                  Las bases (leche de avena, agua de coco…), los ingredientes con su color y
                  calorías, cuántos puede elegir el cliente, cuántos entran en el precio base y
                  cuáles salen marcados al abrir. El precio se define en «Precios y adicionales».
                </P>
              </Card>
              <Card title="Quiosco">
                <P small>
                  Lo que ve la tablet del mostrador: la pantalla de espera (video y texto) y las
                  cajas de productos. Todo sale del catálogo de «Menú»: aquí sólo eliges qué
                  aparece en cada caja. Nada se crea dos veces.
                </P>
              </Card>
              <Card title="Precios y adicionales">
                <P small>
                  Los precios que no son de una bebida concreta: los <b>adicionales</b> (granola,
                  mantequilla de maní…), los <b>tamaños</b> que existen (nombre y volumen; el
                  precio de cada uno se pone en cada bebida, en «Menú»), el <b>domicilio</b> y
                  desde cuánto va gratis, y el precio base del blend armado. Lo que pongas aquí es
                  exactamente lo que se cobra.
                </P>
              </Card>
              <Card title="Textos">
                <P small>
                  Los encabezados de cada sección (título en negro y palabra destacada a color),
                  los tres pasos de «Cómo llega tu pedido», el programa de sellos y las preguntas
                  frecuentes.
                </P>
              </Card>
              <Card title="Tiendas">
                <P small>
                  Cada sede con zona, dirección, horario, teléfono, servicios y coordenadas (latitud
                  y longitud). Las coordenadas ponen el pin en el mapa; las sacas de Google Maps
                  con clic derecho sobre el local. También son las sedes entre las que elige el
                  cliente al recoger.
                </P>
              </Card>
              <Card title="Marca">
                <P small>
                  Nombre, descripción corta, ciudad, teléfono, correo, Instagram, logo y la
                  <b>promesa de entrega</b> que sale bajo el carrusel. Y la <b>cinta superior</b>:
                  los mensajes que van girando arriba de la página.
                </P>
              </Card>
            </Grid>

            <Grid>
              <Card title="Fotos y videos">
                <Ul>
                  <li>
                    En cada campo de imagen puedes <b>subir un archivo</b> o <b>pegar la URL</b>{" "}
                    de una foto que ya esté en internet.
                  </li>
                  <li>
                    Las fotos de producto se ven mejor <b>cuadradas</b>, con el vaso centrado y
                    fondo limpio. El tamaño se ajusta solo en la tienda.
                  </li>
                  <li>
                    Hay un límite de peso por archivo; si se pasa, el editor lo dice antes de
                    subir. Un video de fondo corto (10–20 s) pesa menos y carga más rápido.
                  </li>
                </Ul>
              </Card>
              <Card title="Buenas costumbres">
                <Ul>
                  <li>Publica cambios pequeños y seguidos, no uno gigante al final del día.</li>
                  <li>
                    Si dos personas editan a la vez, gana la que publique última. Avisa antes de
                    editar.
                  </li>
                  <li>
                    Si cierras la pestaña con cambios sin publicar, el navegador avisa. Si aceptas,
                    se pierden.
                  </li>
                  <li>Revisa la tienda en el celular después de publicar: es donde más se ve.</li>
                </Ul>
              </Card>
            </Grid>
          </Section>

          {/* ------------------------------------------------ 6. Quiosco */}
          <Section
            n={6}
            id="quiosco"
            tone="mango"
            title="Quiosco"
            kicker="Autopedido en el mostrador"
          >
            <P>
              Una tablet en la barra donde el cliente arma su pedido solo, de pie. Está en la
              dirección <Mono>/quiosco</Mono>, sin ningún enlace desde la tienda: se llega
              escribiéndola y con una clave. Los pedidos entran al tablero marcados{" "}
              <b>Mostrador</b> y para recoger. Si el cliente eligió <b>Pagar ahora</b>, llegan
              como <b>Pagado en línea</b>; si eligió caja, llegan <b>Sin pagar</b> y se cobran ahí.
            </P>
            <Steps
              title="Montar una tablet nueva"
              steps={[
                <>
                  Un administrador activa el quiosco en <b>Cuentas → Autopedido del mostrador</b>{" "}
                  con una clave de diez caracteres o más. Si ya está activo, usa la que haya.{" "}
                  <b>Es la clave lo que lo activa</b>: el interruptor de «Contenido → Quiosco» sólo
                  enciende o apaga la pantalla de espera, y tiene que estar encendido también.
                </>,
                <>
                  En la tablet, abre el navegador y entra a la dirección de la tienda seguida de{" "}
                  <Mono>/quiosco</Mono>. En <b>Cuentas → Autopedido</b> está la dirección completa
                  con botones para copiarla o abrirla.
                </>,
                <>
                  Elige la <b>sede</b>, ponle un <b>nombre</b> a la pantalla («Barra norte») para
                  reconocerla luego, y escribe la clave.
                </>,
                <>
                  Listo: queda desbloqueada tres meses. Deja el navegador en pantalla completa y,
                  si la tablet lo permite, fija la app para que no se pueda salir.
                </>,
              ]}
            />
            <Grid>
              <Card title="Gestionarlo desde Cuentas">
                <Ul>
                  <li>
                    Cada pantalla conectada aparece con su nombre, cuándo se conectó y su último
                    pedido. <b>Desconectar</b> la saca al instante (si la tablet se perdió, por
                    ejemplo).
                  </li>
                  <li>
                    <b>Cambiar</b> la clave no desconecta las pantallas ya montadas; sólo afecta a
                    las nuevas.
                  </li>
                  <li>
                    <b>Apagar</b> desconecta todas y la tablet muestra que no está disponible.
                  </li>
                </Ul>
              </Card>
              <Card title="Lo que ve el cliente">
                <P small>
                  La tablet arranca en la <b>pantalla de espera</b>, con el video y el texto que se
                  editan en <b>Contenido → Quiosco</b>. Al tocarla salen las cajas de productos
                  configuradas ahí. El cliente arma su pedido, escribe su nombre y elige cómo paga;
                  el pedido llega al tablero sin teléfono, así que se le llama por nombre. Al
                  terminar, la tablet vuelve sola a la espera; si alguien lo deja a medias, el botón
                  <b>Volver</b> también la devuelve.
                </P>
              </Card>
            </Grid>
            <Card title="«Pagar ahora» en la tablet">
              <P small>
                Si está activo en <b>Contenido → Quiosco</b> (y la pasarela configurada), el
                cliente puede pagar sin pasar por caja. Como la tablet es de la tienda, lo primero
                que se le ofrece es un <b>código QR</b>: lo escanea con su celular y paga allí con
                Nequi, tarjeta o PSE; la tablet se entera sola y enseña el número. También puede
                tocar «Pagar en esta pantalla», o cambiar de idea con «Mejor pago en caja». Si se va
                sin pagar, la tablet vuelve al inicio a los cuatro minutos y ese pedido no sale a
                la barra (y si paga desde el celular más tarde, entra igual).
              </P>
              <P small>
                Para la barra no cambia nada: la tarjeta dice <b>Pagado en línea</b> o{" "}
                <b>Sin pagar</b>, y siempre <b>Pedido de quiosco</b>.
              </P>
            </Card>
          </Section>

          {/* ------------------------------------------------ 7. Reparto */}
          <Section n={7} id="reparto" tone="matcha" title="Reparto" kicker="Los domicilios">
            <P>
              Cada repartidor tiene su cuenta (rol <b>Repartidor</b>) y entra con ella en el
              celular, en <Mono>/equipo</Mono>: no ve el tablero, ve <b>su pantalla de reparto</b>{" "}
              con sus domicilios, la dirección, el teléfono y lo que lleva. Los domicilios se pagan
              siempre en línea al pedir, así que el repartidor <b>nunca cobra</b>.
            </P>
            <Flow
              steps={[
                { label: "Asignado", tone: "#FF6A1A", desc: "La barra lo asigna, o él lo toma de «Disponibles»." },
                { label: "Listo", tone: "#7B3FF2", desc: "La barra lo marca listo; le suena al repartidor." },
                { label: "En camino", tone: "#8FD14F", desc: "Toca «Salí». La barra y el cliente lo ven." },
                { label: "Entregado", tone: "#8A7BA0", desc: "Toca «Entregado». Cierra el pedido y suma sello." },
              ]}
            />
            <Grid>
              <Card title="Lo que hace la barra">
                <Ul>
                  <li>
                    En la tarjeta de cada domicilio hay un desplegable <b>🛵 Sin repartidor</b>:
                    elige quién lo lleva. Se puede hacer desde que entra, aunque aún se esté
                    preparando.
                  </li>
                  <li>
                    Si no asignas a nadie, el domicilio aparece en <b>Disponibles</b> de todos los
                    repartidores cuando esté <b>Listo</b>, y el primero que lo toma se lo lleva.
                  </li>
                  <li>
                    Cuando el repartidor sale, la tarjeta cambia a <b>En camino con Juan</b>. Marcar
                    «Entregado» lo hace él desde la calle; la barra también puede, si hace falta.
                  </li>
                </Ul>
              </Card>
              <Card title="Lo que ve el repartidor">
                <Dl>
                  <Dt>Mis entregas</Dt>
                  <Dd>Lo que le asignaron. Si aún se prepara, lo dice; cuando está listo aparece «Salí con el pedido».</Dd>
                  <Dt>En camino</Dt>
                  <Dd>Lo que lleva encima, con el botón grande <b>Entregado ✓</b>.</Dd>
                  <Dt>Disponibles</Dt>
                  <Dd>Domicilios listos sin repartidor, con botón <b>Tomar</b>.</Dd>
                  <Dt>Entregados hoy</Dt>
                  <Dd>Su cuenta del día.</Dd>
                  <Dt>📍 Mapa · 📞 Llamar</Dt>
                  <Dd>Abren Google Maps con la dirección y el teléfono del cliente con un toque.</Dd>
                  <Dt>No puedo</Dt>
                  <Dd>Suelta el pedido: vuelve a Disponibles para que otro lo tome.</Dd>
                </Dl>
              </Card>
            </Grid>
            <Steps
              title="Dar de alta un repartidor"
              steps={[
                <>
                  Un administrador crea su cuenta en <b>Cuentas → + Añadir cuenta</b> con rol{" "}
                  <b>Repartidor</b>.
                </>,
                <>
                  El repartidor entra desde el celular en la dirección de la tienda seguida de{" "}
                  <Mono>/equipo</Mono>, con su correo y contraseña. Le abre directo su pantalla.
                </>,
                <>
                  Conviene que la instale como app (Compartir → Añadir a pantalla de inicio) y suba
                  el volumen: suena cuando le asignan algo.
                </>,
              ]}
            />
            <Warn title="Si un domicilio dice «Cobrar»">
              Los domicilios se pagan en línea al pedir, así que casi nunca pasa. Sólo puede
              ocurrir con un pedido de antes de este cambio o si la pasarela estuvo caída y se
              aceptó pagar al recibir. En ese caso el repartidor debe cobrar el total que indica la
              etiqueta naranja y entregarlo en caja.
            </Warn>
          </Section>

          {/* ------------------------------------------------ 8. Cuentas */}
          <Section
            n={8}
            id="cuentas"
            tone="matcha"
            title="Cuentas"
            kicker="Sólo administradores"
            admin
          >
            <P>
              Quién puede entrar a esta vista y qué puede hacer. Cada persona debería tener su
              propia cuenta: así se sabe quién hizo qué y, si alguien se va, se le quita el acceso
              sin cambiarle la contraseña a nadie más.
            </P>
            <Grid>
              <Card title="Crear una cuenta">
                <Steps
                  compact
                  steps={[
                    <>
                      <b>+ Añadir cuenta</b>: correo, nombre, contraseña (diez caracteres o más)
                      y rol.
                    </>,
                    <>
                      La contraseña se ve mientras la escribes, a propósito: tienes que
                      pasársela a la persona. Pídele que la cambie después… o cámbiasela tú.
                    </>,
                    <>
                      <b>Barra</b> para quien atiende, <b>Repartidor</b> para quien lleva domicilios;
                      sube a Admin sólo a quien lo necesite.
                    </>,
                  ]}
                />
              </Card>
              <Card title="Cada cuenta tiene">
                <Dl>
                  <Dt>Rol</Dt>
                  <Dd>Se cambia con el desplegable. No puedes bajarte a ti mismo de Admin.</Dd>
                  <Dt>Contraseña</Dt>
                  <Dd>
                    Escribe una nueva. No se puede ver la actual: no está guardada, sólo una huella
                    de ella. Cambiarla cierra las sesiones de esa persona.
                  </Dd>
                  <Dt>Cerrar sesiones</Dt>
                  <Dd>La saca de todos los aparatos donde estuviera entrada, sin cambiar nada más.</Dd>
                  <Dt>Eliminar</Dt>
                  <Dd>Borra la cuenta. Siempre tiene que quedar al menos un administrador.</Dd>
                </Dl>
              </Card>
            </Grid>
            <Tip>
              Si alguien olvida su contraseña, no hay forma de recuperarla: entra tú como
              administrador, pulsa <b>Contraseña</b> en su cuenta y escríbele una nueva.
            </Tip>
          </Section>

          {/* ------------------------------------------------ 9. Clientes */}
          <Section
            n={9}
            id="clientes"
            tone="ube"
            title="Clientes y sellos"
            kicker="Lo que hace el cliente por su cuenta"
          >
            <P>
              El cliente puede pedir sin registrarse, o crear una cuenta en la tienda (con correo o
              con Google). Con cuenta guarda sus direcciones, ve el estado de sus pedidos y{" "}
              <b>acumula sellos</b>.
            </P>
            <Grid>
              <Card title="Los sellos salen del tablero">
                <P small>
                  Cada pedido que se marca <b>Entregado</b> es un sello para ese cliente. No hay
                  un contador aparte: si un pedido se queda en «Listo» para siempre, ese sello no
                  existe. Por eso importa cerrar cada pedido cuando se entrega.
                </P>
              </Card>
              <Card title="Lo que ve el cliente de su pedido">
                <P small>
                  En «Mi cuenta» ve cada pedido con el mismo estado que tú ves en el tablero: Nuevo,
                  Preparando, Listo, Entregado. Mover la tarjeta es también informarle.
                </P>
              </Card>
            </Grid>
          </Section>

          {/* ------------------------------------------------ 10. Problemas */}
          <Section n={10} id="problemas" tone="mango" title="Si algo falla" kicker="Antes de llamar">
            <div className="grid gap-2">
              <Faq q="No suena cuando entra un pedido">
                Pulsa <b>Aviso</b> hasta que quede en negro; el navegador pide permiso la primera
                vez. En iPad, además, el volumen del aparato tiene que estar subido y la pestaña
                visible. Prueba con <b>Pedido de prueba</b> y luego márcalo entregado.
              </Faq>
              <Faq q="Un pedido no aparece">
                Si es pagado en línea, mira la sección <a href="#ayuda-pagos" className="text-ube underline underline-offset-4">Pagos en línea</a>. Si no,
                revisa que la pestaña diga «Pedidos» y no esté en otra columna: en el celular
                sólo se ve una columna a la vez.
              </Faq>
              <Faq q="Dice «Sin conexión con el servidor»">
                Se cayó la red del aparato o de la tienda. Los pedidos no se pierden: siguen
                guardados y aparecen al volver la conexión. Revisa el wifi.
              </Faq>
              <Faq q="Publiqué y la tienda no cambió">
                Recarga la página de la tienda; el navegador puede tener la versión anterior. Si la
                barra de abajo del editor sigue diciendo «Cambios sin publicar», no llegaste a
                pulsar Publicar.
              </Faq>
              <Faq q="Subí una foto y no se ve">
                Espera a que la barra de progreso termine antes de publicar. Si pegaste una URL,
                tiene que ser el enlace directo a la imagen (termina en .jpg, .png, .webp), no la
                página que la contiene.
              </Faq>
              <Faq q="El quiosco dice que «todavía no tiene clave» aunque lo encendí">
                Lo que encendiste fue la pantalla de espera, en Contenido → Quiosco. Activarlo es
                ponerle una <b>clave</b> en <b>Cuentas → Autopedido del mostrador</b> (sólo un
                administrador). Con la clave puesta y la pantalla encendida, la tablet ya deja
                conectarse.
              </Faq>
              <Faq q="El quiosco pide la clave otra vez">
                La conexión de una tablet dura tres meses, o hasta que alguien la desconecte o apague
                el quiosco desde Cuentas. Vuelve a escribir la clave; si no la tienes, pídesela a un
                administrador.
              </Faq>
              <Faq q="Olvidé mi contraseña">
                Un administrador puede escribirte una nueva desde <b>Cuentas</b>. Si eres el único
                administrador, quien administra la página puede hacerlo desde el servidor.
              </Faq>
              <Faq q="El mapa de la tienda no carga">
                Si el mapa real no responde, la tienda muestra el mapa ilustrado con las sedes.
                Revisa que las coordenadas de cada sede en <b>Contenido → Tiendas</b> estén bien.
              </Faq>
            </div>
            <Tip>
              Cuando pidas ayuda, ten a mano el <b>número de pedido</b>, la <b>hora</b> y una{" "}
              <b>captura de pantalla</b>. Con eso se encuentra casi todo en un minuto.
            </Tip>
          </Section>

          <p className="u-mono text-center normal-case tracking-[0.01em] text-ink/35">
            Fin del manual ·{" "}
            <Link href="/" className="underline underline-offset-4 hover:text-ink">
              ver la tienda
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Piezas                                                              */

function Section({
  n,
  id,
  tone,
  title,
  kicker,
  admin,
  children,
}: {
  n: number;
  id: string;
  tone: Tone;
  title: string;
  kicker: string;
  admin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={`ayuda-${id}`} className="scroll-mt-24">
      <header className="flex items-end gap-4">
        <span
          className="u-display grid h-12 w-12 shrink-0 place-items-center rounded-full border-[1.5px] border-ink text-xl text-ink"
          style={{ background: TONE_BG[tone] }}
          aria-hidden="true"
        >
          {n}
        </span>
        <div className="min-w-0">
          <p className="u-mono text-ink/45">
            {kicker}
            {admin ? <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-paper">admin</span> : null}
          </p>
          <h3 className="u-display text-[clamp(1.8rem,4vw,2.6rem)] leading-none">{title}</h3>
        </div>
      </header>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function P({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <p className={`leading-relaxed text-ink/70 ${small ? "text-[0.95rem]" : "max-w-2xl"}`}>
      {children}
    </p>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-3 rounded-[22px] border-[1.5px] border-ink/15 bg-white p-4 sm:p-5">
      <h4 className="text-[1.05rem] font-semibold leading-tight">{title}</h4>
      {children}
    </div>
  );
}

function Dl({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-4 gap-y-1.5 text-[0.95rem] sm:grid-cols-[auto_1fr]">{children}</dl>;
}
function Dt({ children }: { children: React.ReactNode }) {
  return <dt className="u-mono pt-0.5 text-ink/55">{children}</dt>;
}
function Dd({ children }: { children: React.ReactNode }) {
  return <dd className="leading-relaxed text-ink/70 sm:pb-1">{children}</dd>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid gap-2 text-[0.95rem] leading-relaxed text-ink/70 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.7em] [&>li]:before:h-2 [&>li]:before:w-2 [&>li]:before:rounded-full [&>li]:before:bg-ink/25">
      {children}
    </ul>
  );
}

function Steps({
  title,
  steps,
  compact,
}: {
  title?: string;
  steps: React.ReactNode[];
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? "" : "rounded-[22px] border-[1.5px] border-ink bg-white p-4 sm:p-5"
      }
    >
      {title ? <h4 className="text-[1.05rem] font-semibold leading-tight">{title}</h4> : null}
      <ol className={`grid gap-3 ${title ? "mt-3" : ""}`}>
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-[0.95rem] leading-relaxed text-ink/70">
            <span className="u-mono mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-paper text-[0.65rem] text-ink">
              {i + 1}
            </span>
            <span className="min-w-0">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Las columnas del tablero, dibujadas como el recorrido que hace un pedido. */
function Flow({ steps }: { steps: { label: string; tone: string; desc: string }[] }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-4">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className="relative rounded-2xl border-[1.5px] border-ink/15 bg-white p-3.5"
        >
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: s.tone }} aria-hidden="true" />
            <span className="u-display text-xl">{s.label}</span>
            {i < steps.length - 1 ? (
              <span className="u-mono ml-auto text-ink/30 sm:hidden" aria-hidden="true">
                ↓
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[0.9rem] leading-snug text-ink/60">{s.desc}</p>
          {i < steps.length - 1 ? (
            <span
              className="u-mono absolute -right-3 top-1/2 hidden -translate-y-1/2 text-ink/30 sm:block"
              aria-hidden="true"
            >
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-3 rounded-2xl border-[1.5px] border-matcha-deep/60 bg-matcha/20 px-4 py-3 text-[0.95rem] leading-relaxed text-ink/75">
      <span className="u-mono shrink-0 text-matcha-deep" aria-hidden="true">
        ✓
      </span>
      <span>{children}</span>
    </p>
  );
}

function Warn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-mango-deep bg-mango/10 px-4 py-3.5">
      <p className="u-mono flex items-center gap-2 text-mango-deep">
        <span aria-hidden="true">!</span>
        {title}
      </p>
      <div className="mt-2 text-[0.95rem] leading-relaxed text-ink/75">{children}</div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border-[1.5px] border-ink/15 bg-white open:border-ink">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
        <span
          className="u-mono grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/25 text-[0.7rem] text-ink/60 transition-transform group-open:rotate-45"
          aria-hidden="true"
        >
          +
        </span>
        {q}
      </summary>
      <p className="px-4 pb-4 pl-[3.25rem] text-[0.95rem] leading-relaxed text-ink/70">
        {children}
      </p>
    </details>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="u-mono rounded-full border-[1.5px] border-ink/15 bg-paper px-3 py-1.5 normal-case tracking-[0.01em] text-ink/65">
      {children}
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border-[1.5px] border-ink/12 bg-paper px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
      {children}
    </code>
  );
}
