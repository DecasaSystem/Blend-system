"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  changeMemberRole,
  createMember,
  listTeam,
  removeMember,
  resetMemberPassword,
  signOutMember,
  type TeamMember,
  type TeamResult,
} from "@/actions/team";
import type { SessionUser } from "@/lib/session";

/**
 * Cuentas del equipo.
 *
 * Sólo la ve un administrador. Las comprobaciones de verdad están en el
 * servidor (`src/actions/team.ts`); esto sólo evita mostrar botones que van a
 * fallar.
 *
 * No hay ningún sitio donde se muestre una contraseña: de la base sólo sale su
 * hash. Cambiarla es escribir una nueva, y eso cierra las sesiones abiertas de
 * esa persona.
 */

const fecha = (ms: number | null) =>
  ms
    ? new Date(ms).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
    : "nunca ha entrado";

export default function TeamPanel({ user }: { user: SessionUser }) {
  const [miembros, setMiembros] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [pendiente, empezar] = useTransition();

  const recargar = useCallback(async () => {
    try {
      setMiembros(await listTeam());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las cuentas.");
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  /** Ejecuta una acción y refresca; todas devuelven la misma forma. */
  const correr = (accion: () => Promise<TeamResult>) => {
    setError(null);
    setFlash(null);
    empezar(async () => {
      try {
        const res = await accion();
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setFlash(res.mensaje);
        setTimeout(() => setFlash(null), 4000);
        await recargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar.");
      }
    });
  };

  if (user.role !== "admin") {
    return (
      <p className="u-mono py-16 text-center normal-case tracking-[0.01em] text-ink/40">
        Sólo un administrador puede ver las cuentas del equipo.
      </p>
    );
  }

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="u-display text-3xl">Cuentas del equipo</h2>
        <button
          type="button"
          onClick={() => setAbriendo((v) => !v)}
          className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink"
        >
          {abriendo ? "Cancelar" : "+ Añadir cuenta"}
        </button>
        <p className="u-mono ml-auto min-w-0 normal-case tracking-[0.01em]">
          {error ? (
            <span className="text-mango-deep">{error}</span>
          ) : flash ? (
            <span className="text-matcha-deep">{flash}</span>
          ) : pendiente ? (
            <span className="text-ink/40">Un momento…</span>
          ) : null}
        </p>
      </div>

      {abriendo ? (
        <Alta
          onCancel={() => setAbriendo(false)}
          onSubmit={(datos) => {
            correr(() => createMember(datos.email, datos.name, datos.role, datos.password));
            setAbriendo(false);
          }}
        />
      ) : null}

      {miembros === null ? (
        <p className="u-mono py-10 text-center text-ink/35">Cargando…</p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {miembros.map((m) => (
            <Miembro
              key={m.id}
              m={m}
              esYo={m.id === user.id}
              onRol={(rol) => correr(() => changeMemberRole(m.id, rol))}
              onClave={(clave) => correr(() => resetMemberPassword(m.id, clave))}
              onCerrar={() => correr(() => signOutMember(m.id))}
              onBorrar={() => correr(() => removeMember(m.id))}
            />
          ))}
        </ul>
      )}

      <p className="u-mono mt-6 normal-case tracking-[0.01em] text-ink/35">
        Las contraseñas no se pueden consultar: en la base sólo queda su hash. Si alguien la olvida,
        escríbele una nueva aquí.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Alta({
  onSubmit,
  onCancel,
}: {
  onSubmit: (d: { email: string; name: string; role: "admin" | "barra"; password: string }) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "barra">("barra");
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ email, name, role, password });
      }}
      className="mt-4 grid gap-3 rounded-[22px] border-[1.5px] border-ink/15 bg-white p-4 sm:p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Correo">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
            placeholder="persona@blend.cafe"
            className="input rounded-2xl"
          />
        </Campo>
        <Campo label="Nombre">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Camila Ruiz"
            className="input rounded-2xl"
          />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Contraseña" hint="Diez caracteres o más. Se puede cambiar luego.">
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            /* A la vista a propósito: quien la crea se la tiene que pasar a la
               otra persona, y una contraseña en puntitos se copia mal. */
            autoComplete="off"
            className="input rounded-2xl font-mono"
          />
        </Campo>
        <Campo label="Rol" hint="Barra ve pedidos; admin además gestiona cuentas y contenido.">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "barra")}
            className="input appearance-none rounded-2xl"
          >
            <option value="barra">Barra</option>
            <option value="admin">Administrador</option>
          </select>
        </Campo>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn btn-sm btn-mango">
          Crear cuenta
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/25 px-3.5 text-ink/60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Miembro({
  m,
  esYo,
  onRol,
  onClave,
  onCerrar,
  onBorrar,
}: {
  m: TeamMember;
  esYo: boolean;
  onRol: (r: "admin" | "barra") => void;
  onClave: (c: string) => void;
  onCerrar: () => void;
  onBorrar: () => void;
}) {
  const [clave, setClave] = useState("");
  const [cambiando, setCambiando] = useState(false);

  return (
    <li className="rounded-[22px] border-[1.5px] border-ink/15 bg-white p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {m.name}
            {esYo ? <span className="u-mono ml-2 text-ink/40">tú</span> : null}
          </p>
          <p className="u-mono truncate normal-case tracking-[0.01em] text-ink/50">{m.email}</p>
          <p className="u-mono mt-1 text-ink/35">
            Último acceso: {fecha(m.lastLoginAt)}
            {m.sesiones > 0 ? ` · ${m.sesiones} ${m.sesiones === 1 ? "sesión" : "sesiones"}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={m.role}
            onChange={(e) => onRol(e.target.value as "admin" | "barra")}
            disabled={esYo}
            aria-label={`Rol de ${m.name}`}
            className="u-mono min-h-11 appearance-none rounded-full border-[1.5px] border-ink/20 bg-white px-3.5 text-ink/70 disabled:opacity-50"
          >
            <option value="barra">Barra</option>
            <option value="admin">Admin</option>
          </select>

          <button
            type="button"
            onClick={() => setCambiando((v) => !v)}
            className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/20 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink"
          >
            Contraseña
          </button>

          {m.sesiones > 0 ? (
            <button
              type="button"
              onClick={onCerrar}
              className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/20 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink"
            >
              Cerrar sesiones
            </button>
          ) : null}

          {esYo ? null : (
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Borrar la cuenta de ${m.email}? No se puede deshacer.`)) onBorrar();
              }}
              className="u-mono min-h-11 rounded-full border-[1.5px] border-ink/20 px-3.5 text-ink/45 transition-colors hover:border-mango-deep hover:text-mango-deep"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {cambiando ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onClave(clave);
            setClave("");
            setCambiando(false);
          }}
          className="mt-3 flex flex-wrap items-end gap-2 border-t-[1.5px] border-ink/10 pt-3"
        >
          <div className="min-w-0 flex-1">
            <Campo label="Contraseña nueva" hint="Cierra sus sesiones abiertas.">
              <input
                type="text"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                required
                minLength={10}
                autoComplete="off"
                className="input rounded-2xl font-mono"
              />
            </Campo>
          </div>
          <button type="submit" className="btn btn-sm btn-mango">
            Cambiar
          </button>
        </form>
      ) : null}
    </li>
  );
}

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="u-mono mb-1.5 block text-ink/45">{label}</span>
      {children}
      {hint ? <span className="u-mono mt-1 block text-ink/35">{hint}</span> : null}
    </label>
  );
}
