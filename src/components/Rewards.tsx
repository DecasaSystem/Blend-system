"use client";

import { useSite } from "./SiteProvider";

/** Programa de sellos. */
export default function Rewards() {
  const { rewards } = useSite();
  const colors = ["#FF6A1A", "#7B3FF2", "#8FD14F", "#FFD166", "#F2557A", "#6FA82E"];
  const total = Math.max(1, Math.min(12, rewards.stamps));

  return (
    <section className="border-y-[1.5px] border-ink bg-pulp">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-12">
        <div className="max-w-lg">
          <p className="u-mono text-ink/50">{rewards.eyebrow}</p>
          <h2 className="u-display mt-2 text-[clamp(2rem,5vw,3.2rem)]">
            {rewards.title} <span className="u-italic">{rewards.accent}</span>
          </h2>
          <p className="mt-3 text-ink/70">{rewards.body}</p>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
          {Array.from({ length: total }, (_, i) => {
            const filled = i < rewards.filled;
            return (
              <div
                key={i}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-ink sm:h-14 sm:w-14"
                style={{ background: filled ? colors[i % colors.length] : "transparent" }}
                aria-hidden="true"
              >
                <span
                  className="u-mono text-[0.6rem]"
                  style={{ color: filled ? "#fff" : "rgba(27,11,46,.35)" }}
                >
                  {i === total - 1 ? "★" : i + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
