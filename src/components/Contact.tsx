"use client";

import { useState } from "react";
import SectionHead from "./SectionHead";
import InkField from "./InkField";
import { useSite } from "./SiteProvider";

const MOTIVES = ["Pedido grande", "Catering o evento", "Trabajar con ustedes", "Otra cosa"];

export default function Contact() {
  const { brand, faqs, sections } = useSite();
  const [motive, setMotive] = useState(MOTIVES[0]);
  const [sent, setSent] = useState(false);

  return (
    <section id="contacto" className="relative overflow-hidden bg-ink py-20 text-paper lg:py-28">
      <InkField
        tone="dark"
        blobs={[
          { color: "#FF6A1A", size: 40, x: 72, y: -8, opacity: 0.3 },
          { color: "#8FD14F", size: 30, x: -8, y: 58, opacity: 0.26 },
        ]}
      />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <SectionHead copy={sections.contact} tone="#FFD166" invert />

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* Formulario */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="rounded-[30px] border-[1.5px] border-paper/20 bg-paper/[0.04] p-6 backdrop-blur-sm sm:p-8"
          >
            {sent ? (
              <div className="flex min-h-[380px] flex-col items-center justify-center gap-4 text-center">
                <div className="flex" aria-hidden="true">
                  <span
                    className="h-14 w-14 rounded-full bg-mango"
                    style={{ mixBlendMode: "screen" }}
                  />
                  <span
                    className="-ml-5 h-14 w-14 rounded-full bg-matcha"
                    style={{ mixBlendMode: "screen" }}
                  />
                </div>
                <p className="u-display text-4xl">Mensaje recibido</p>
                <p className="max-w-sm text-paper/65">
                  Te contestamos al correo que dejaste, normalmente antes de dos horas.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="btn btn-ghost border-paper/30 text-paper"
                >
                  Escribir otro
                </button>
              </div>
            ) : (
              <>
                <p className="u-mono mb-3 text-paper/50">Motivo</p>
                <div className="flex flex-wrap gap-2">
                  {MOTIVES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMotive(m)}
                      aria-pressed={motive === m}
                      className={`min-h-11 rounded-full border-[1.5px] px-3.5 text-[0.82rem] transition-colors ${
                        motive === m
                          ? "border-paper bg-paper text-ink"
                          : "border-paper/25 text-paper/75 hover:border-paper"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Input label="Nombre" name="nombre" placeholder="Camila Ruiz" required />
                  <Input label="Teléfono" name="telefono" type="tel" placeholder="310 123 4567" />
                </div>
                <div className="mt-4">
                  <Input
                    label="Correo"
                    name="correo"
                    type="email"
                    placeholder="camila@correo.com"
                    required
                  />
                </div>
                <div className="mt-4">
                  <label className="u-mono mb-2 block text-paper/50" htmlFor="mensaje">
                    Mensaje
                  </label>
                  <textarea
                    id="mensaje"
                    name="mensaje"
                    rows={4}
                    required
                    placeholder="Cuéntanos qué necesitas y para cuándo."
                    className="w-full resize-none rounded-2xl border-[1.5px] border-paper/30 bg-transparent px-4 py-3 text-paper outline-none placeholder:text-paper/45 focus:border-paper"
                  />
                </div>

                <button type="submit" className="btn btn-mango mt-6 w-full sm:w-auto">
                  Enviar mensaje
                </button>
              </>
            )}
          </form>

          {/* Datos + preguntas */}
          <div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="Teléfono"
                value={brand.phone}
                href={`tel:${brand.phone.replace(/\s/g, "")}`}
              />
              <Detail label="Correo" value={brand.email} href={`mailto:${brand.email}`} />
              <Detail label="Instagram" value={brand.instagram} href="https://instagram.com" />
              <Detail label="Horario" value="Todos los días, 7:00 – 21:00" />
            </dl>

            <p className="u-mono mb-3 mt-10 text-paper/50">Preguntas frecuentes</p>
            <div className="divide-y-[1.5px] divide-paper/12 border-y-[1.5px] border-paper/12">
              {faqs.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium marker:content-['']">
                    {f.q}
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-[1.5px] border-paper/30 transition-transform duration-300 group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-prose leading-relaxed text-paper/65">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Input({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="u-mono mb-2 block text-paper/50" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-full border-[1.5px] border-paper/30 bg-transparent px-4 py-3 text-paper outline-none placeholder:text-paper/45 focus:border-paper"
      />
    </div>
  );
}

function Detail({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = href ? (
    <a href={href} className="underline-offset-4 hover:underline">
      {value}
    </a>
  ) : (
    value
  );
  return (
    <div className="rounded-2xl border-[1.5px] border-paper/15 p-4">
      <dt className="u-mono text-paper/45">{label}</dt>
      <dd className="mt-1.5 text-paper">{body}</dd>
    </div>
  );
}
