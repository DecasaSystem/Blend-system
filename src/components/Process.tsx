"use client";

import { useSite } from "./SiteProvider";

/** Es una secuencia real, por eso va numerada. */
export default function Process() {
  const { processSteps } = useSite();
  if (processSteps.length === 0) return null;

  return (
    <section className="border-t-[1.5px] border-ink/10 bg-paper-2 py-14 lg:py-16">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
          {processSteps.map((s, i) => (
            <div key={s.title} className="flex gap-4">
              <span
                className="u-display shrink-0 text-5xl leading-none"
                style={{ color: s.color }}
                aria-hidden="true"
              >
                0{i + 1}
              </span>
              <div>
                <h3 className="u-display text-3xl">{s.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/62">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
