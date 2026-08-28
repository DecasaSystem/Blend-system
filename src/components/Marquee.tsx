"use client";

import { useSite } from "./SiteProvider";

export default function Marquee() {
  const { marquee } = useSite();
  const items = [...marquee, ...marquee];
  return (
    <div className="relative z-40 overflow-hidden border-b-[1.5px] border-ink bg-ink py-2 text-paper">
      <div className="marquee-track">
        {items.map((text, i) => (
          <span key={i} className="u-mono flex shrink-0 items-center gap-6 px-6 text-[0.62rem]">
            <span className="text-paper/85">{text}</span>
            <span aria-hidden="true" className="text-mango">
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
