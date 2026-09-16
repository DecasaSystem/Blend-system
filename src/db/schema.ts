import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { CartLine, DeliveryMode } from "@/lib/cart";
import type { Customer, OrderStatus, Role } from "@/lib/orders";
import type { SiteContent } from "@/lib/site";

/**
 * Esquema de la base de datos.
 *
 * Las líneas de un pedido van en `jsonb`, no en una tabla aparte, a propósito:
 * son la foto de lo que se pidió. Si mañana sube el precio de un topping, un
 * pedido de ayer no puede cambiar de importe.
 */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** scrypt: sal y hash, ambos en hexadecimal. Nunca la contraseña. */
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<Role>().notNull().default("barra"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** Hash del token; el token en claro sólo existe en la cookie del navegador. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * Clientes.
 *
 * Tabla aparte de `users`, a propósito. Podrían compartir tabla con un campo de
 * rol, pero entonces un descuido en una comprobación de rol le daría a un
 * cliente el tablero de pedidos. Separados, ese error no existe.
 */
export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    /** Nulo si la cuenta entra con Google y nunca puso contraseña. */
    passwordHash: text("password_hash"),
    /** El `sub` de Google: su identificador estable, que no cambia si cambia el correo. */
    googleId: text("google_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("customers_email_idx").on(sql`lower(${t.email})`),
    uniqueIndex("customers_google_idx").on(t.googleId),
  ],
);

export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customer_sessions_customer_idx").on(t.customerId)],
);

/** Direcciones guardadas, para no volver a escribirlas en cada pedido. */
export const addresses = pgTable(
  "addresses",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    address: text("address").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("addresses_customer_idx").on(t.customerId)],
);

export const orders = pgTable(
  "orders",
  {
    /** El número que ve la barra: B-1043. */
    id: text("id").primaryKey(),
    status: text("status").$type<OrderStatus>().notNull().default("nuevo"),
    /** Cuándo entró al estado actual, para el cronómetro del tablero. */
    statusAt: timestamp("status_at", { withTimezone: true }).notNull().defaultNow(),
    mode: text("mode").$type<DeliveryMode>().notNull(),
    storeId: text("store_id").notNull(),
    customer: jsonb("customer").$type<Customer>().notNull(),
    lines: jsonb("lines").$type<CartLine[]>().notNull(),
    subtotal: integer("subtotal").notNull(),
    delivery: integer("delivery").notNull(),
    total: integer("total").notNull(),
    payment: text("payment").$type<"tarjeta" | "efectivo" | "pendiente">().notNull(),
    paymentMethod: text("payment_method").$type<"tarjeta" | "efectivo" | "transferencia">(),
    channel: text("channel").$type<"web" | "mostrador">().notNull().default("web"),
    /** Nulo si se pidió sin cuenta: comprar como invitado sigue siendo posible. */
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    /** Cuándo se confirmó el cobro. Nulo mientras no esté pagado. */
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /**
     * El id que la pasarela le dio al cobro (en Bold, el link `LNK_…`). Es lo
     * que viene en el webhook y con lo que se consulta el estado al volver.
     * Nulo si no se pagó en línea.
     */
    paymentRef: text("payment_ref"),
    /**
     * Reparto. Quién lleva el domicilio, desde cuándo lo tiene y cuándo salió
     * con él. Nulos en los pedidos para recoger y en los de domicilio que
     * nadie ha tomado todavía.
     */
    courierId: text("courier_id").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    outAt: timestamp("out_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_created_idx").on(t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_customer_idx").on(t.customerId),
    index("orders_payment_ref_idx").on(t.paymentRef),
    index("orders_courier_idx").on(t.courierId),
  ],
);

/**
 * Dónde va cada repartidor ahora mismo.
 *
 * Una fila por persona, que se sobrescribe: no es un historial de recorridos,
 * es «el último punto conocido». Sólo se escribe mientras lleva un domicilio
 * en la calle, y se borra al entregar el último; así el cliente ve la moto
 * venir y nada más. Si el celular deja de mandar, `updatedAt` se queda quieto
 * y el cliente ve «hace N min» en vez de un punto que parece vivo.
 */
export const courierPositions = pgTable("courier_positions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  /** Rumbo en grados (0 = norte), si el GPS lo da; nulo parado o sin dato. */
  heading: doublePrecision("heading"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Contador de los números de pedido. Una sola fila. */
export const counters = pgTable("counters", {
  name: text("name").primaryKey(),
  value: integer("value").notNull(),
});

/**
 * Contenido del sitio: una sola fila con el objeto entero.
 * Es la misma forma que ya tenía en el navegador, así que el editor no cambia.
 */
export const siteContent = pgTable("site_content", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<SiteContent>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

/**
 * Ajustes que sólo conoce el servidor.
 *
 * Tabla aparte de `site_content` a propósito: el contenido del sitio viaja
 * entero al navegador, así que ahí no puede vivir nada secreto. Aquí está el
 * hash de la clave del quiosco, y nada de esto se sirve al cliente.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

/**
 * Pantallas de autopedido.
 *
 * Igual que las sesiones de equipo: en la base sólo el hash del token, y el
 * token en claro únicamente en la cookie de la tablet. Con estado, para que
 * desconectar una pantalla perdida sea borrar una fila.
 *
 * No tiene nada que ver con `sessions`: una tablet en el mostrador no debe
 * poder abrir el tablero de pedidos ni el editor.
 */
export const kioskSessions = pgTable(
  "kiosk_sessions",
  {
    id: text("id").primaryKey(),
    /** La sede en la que está la pantalla; se cobra y se prepara ahí. */
    storeId: text("store_id").notNull(),
    /** Para reconocerla en la lista: «Tablet de la entrada». */
    label: text("label").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [index("kiosk_sessions_store_idx").on(t.storeId)],
);

export const SITE_ROW_ID = "sitio";
export const ORDER_COUNTER = "pedidos";
export const KIOSK_PASSWORD = "kiosk.password";

/**
 * Chat entre el cliente y la barra.
 *
 * Una conversación por cliente, como un hilo de WhatsApp: no hay «tickets»
 * ni asuntos, sólo la charla con esa persona, en la que contesta quien esté
 * en la barra. Sólo pueden escribir clientes con cuenta: así el equipo sabe
 * con quién habla y el cliente recupera la conversación desde cualquier
 * aparato.
 *
 * `customerReadAt` / `staffReadAt`: hasta cuándo leyó cada lado. Lo no leído
 * son los mensajes del otro posteriores a esa marca; no hace falta un
 * contador que se pueda desincronizar.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    /**
     * `store`: el hilo del cliente con la barra, uno por cliente.
     * `delivery`: el hilo de un domicilio concreto entre el cliente y su
     * repartidor, uno por pedido; vive y muere con el pedido.
     */
    kind: text("kind").$type<"store" | "delivery">().notNull().default("store"),
    orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    customerReadAt: timestamp("customer_read_at", { withTimezone: true }),
    staffReadAt: timestamp("staff_read_at", { withTimezone: true }),
    /** El último mensaje recortado, para la lista sin cargar el hilo. */
    preview: text("preview").notNull().default(""),
  },
  (t) => [
    // Un solo hilo de tienda por cliente; los de reparto van por pedido.
    uniqueIndex("conversations_store_idx")
      .on(t.customerId)
      .where(sql`${t.kind} = 'store'`),
    uniqueIndex("conversations_order_idx").on(t.orderId),
    index("conversations_customer_idx").on(t.customerId),
    index("conversations_last_idx").on(t.lastMessageAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sender: text("sender").$type<"customer" | "staff" | "courier">().notNull(),
    /** Quién del equipo (o repartidor) escribió; nulo si fue el cliente. */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** El nombre tal como se enseña, congelado al enviar. */
    senderName: text("sender_name").notNull(),
    body: text("body").notNull(),
    /** «Aquí estoy»: un punto en el mapa, además del texto. */
    location: jsonb("location").$type<{ lat: number; lng: number }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/**
 * Suscripciones a notificaciones push (Web Push).
 *
 * Cada fila es un navegador (un teléfono, un computador) que aceptó recibir
 * avisos, atado a quien estaba en sesión al aceptar: un cliente o alguien del
 * equipo. Un mismo aparato puede tener varias filas si entran varias cuentas.
 * Cuando el servicio de push dice que la suscripción ya no existe (404/410),
 * la fila se borra.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    /** La URL única que da el navegador; identifica el aparato. */
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("push_endpoint_idx").on(t.endpoint),
    index("push_customer_idx").on(t.customerId),
    index("push_user_idx").on(t.userId),
  ],
);
