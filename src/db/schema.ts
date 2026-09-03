import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { CartLine, DeliveryMode } from "@/lib/cart";
import type { Customer, OrderStatus } from "@/lib/orders";
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
    role: text("role").$type<"admin" | "barra">().notNull().default("barra"),
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
    channel: text("channel").$type<"web" | "mostrador">().notNull().default("web"),
    /** Nulo si se pidió sin cuenta: comprar como invitado sigue siendo posible. */
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    /** Cuándo se confirmó el cobro. Nulo mientras no esté pagado. */
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_created_idx").on(t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_customer_idx").on(t.customerId),
  ],
);

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
