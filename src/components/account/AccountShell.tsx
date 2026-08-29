"use client";

import Link from "next/link";
import Logo from "../Logo";
import InkField from "../InkField";

/** Marco común de las pantallas de cuenta, para que no se repita en cada una. */
export default function AccountShell({
  eyebrow,
  title,
  accent,
  lead,
  children,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  lead?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="relative min-h-svh overflow-hidden bg-paper">
      <InkField
        className="opacity-50"
        blobs={[
          { color: "#FFD166", size: 24, x: -8, y: 4 },
          { color: "#8FD14F", size: 18, x: 82, y: 40 },
        ]}
      />

      <div
        className={`relative mx-auto px-4 py-8 sm:px-6 lg:py-14 ${wide ? "max-w-3xl" : "max-w-md"}`}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="flex min-h-11 items-center gap-3" aria-label="BLEND, inicio">
            <Logo size={34} />
            <span className="u-display text-3xl">BLEND</span>
          </Link>
          <span className="u-mono ml-auto text-ink/40">{eyebrow}</span>
        </div>

        <h1 className="u-display mt-8 text-[clamp(2.4rem,8vw,3.6rem)]">
          {title} <span className="u-italic text-ube">{accent}</span>
        </h1>
        {lead ? <p className="mt-4 leading-relaxed text-ink/65">{lead}</p> : null}

        {children}
      </div>
    </main>
  );
}
