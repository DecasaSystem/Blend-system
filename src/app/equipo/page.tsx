import type { Metadata } from "next";
import TeamGate from "@/components/team/TeamGate";

export const metadata: Metadata = {
  title: "BLEND · Barra",
  robots: { index: false, follow: false },
};

export default function EquipoPage() {
  return <TeamGate />;
}
