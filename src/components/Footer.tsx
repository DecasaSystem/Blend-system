"use client";

import Logo from "./Logo";
import { useSite } from "./SiteProvider";

export default function Footer() {
  const { brand, categories, stores } = useSite();
  return (
    <footer className="relative overflow-hidden border-t-[1.5px] border-ink bg-paper">
      {/* pb extra en móvil: la barra fija del carrito no debe tapar los enlaces */}
      <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-16 sm:px-6 lg:px-10 lg:pb-10">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.6fr_0.6fr_0.9fr]">
          <div>
            <div className="flex items-center gap-3">
              <Logo size={40} />
              <span className="u-display text-3xl">BLEND</span>
            </div>
            <p className="mt-4 max-w-xs leading-relaxed text-ink/62">
              {brand.tagline}. Fruta congelada, matcha de Uji y nada de azúcar añadida.
            </p>
            <div className="mt-5 flex gap-2">
              {["Instagram", "TikTok", "WhatsApp"].map((s) => (
                <a
                  key={s}
                  href="#contacto"
                  className="u-mono inline-flex min-h-11 items-center rounded-full border-[1.5px] border-ink/20 px-3.5 text-ink/60 transition-colors hover:border-ink hover:text-ink"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          <nav aria-label="Menú">
            <p className="u-mono mb-3 text-ink/40">Menú</p>
            <ul className="grid gap-2">
              {categories.map((c) => (
                <li key={c.id}>
                  <a
                    href="#menu"
                    className="inline-block py-1 text-ink/70 underline-offset-4 hover:text-ink hover:underline"
                  >
                    {c.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Tiendas">
            <p className="u-mono mb-3 text-ink/40">Tiendas</p>
            <ul className="grid gap-2">
              {stores.map((s) => (
                <li key={s.id}>
                  <a
                    href="#tiendas"
                    className="inline-block py-1 text-ink/70 underline-offset-4 hover:text-ink hover:underline"
                  >
                    {s.area}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="u-mono mb-3 text-ink/40">Receta del mes</p>
            <p className="u-display text-3xl leading-tight">Matcha Yuzu en casa</p>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-ink/62">
              2 g de matcha, 60 ml de agua a 80°, jugo de medio yuzu y tónica bien fría. Bate el
              matcha primero, siempre.
            </p>
            <a href="#constructor" className="btn btn-sm btn-paper mt-4">
              Ver más recetas
            </a>
          </div>
        </div>

        {/* Marca grande */}
        <div className="mt-14 select-none" aria-hidden="true">
          <p
            className="u-display leading-[0.8]"
            style={{
              fontSize: "clamp(4rem, 20vw, 17rem)",
              color: "transparent",
              WebkitTextStroke: "1.5px rgba(27,11,46,0.28)",
            }}
          >
            BLEND
          </p>
        </div>

        <div className="rule mt-6" />
        <div className="u-mono mt-5 flex flex-col gap-3 text-ink/40 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Blend · Hecho en {brand.city}
          </p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-ink">
              Aviso de privacidad
            </a>
            <a href="#" className="hover:text-ink">
              Términos
            </a>
            <a href="/equipo" className="hover:text-ink">
              Acceso equipo
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
