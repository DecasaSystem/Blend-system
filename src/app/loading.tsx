import LoadingScreen from "@/components/CupLoader";

/**
 * Se ve mientras el servidor resuelve una página al navegar dentro del sitio
 * (menú → checkout → cuenta…). La primera carga llega pintada del servidor y
 * no pasa por aquí.
 */
export default function Loading() {
  return <LoadingScreen />;
}
