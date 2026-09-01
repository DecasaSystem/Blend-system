import { stdin, stdout } from "node:process";

/**
 * Pide algo por teclado sin mostrarlo.
 *
 * Lee en modo crudo, carácter a carácter. La versión anterior usaba readline y
 * repintaba la línea en cada tecla; se veía bien, pero es un truco frágil que
 * depende de cómo trate la terminal el eco. Aquí no hay eco que tapar: los
 * caracteres nunca se escriben.
 */
export function askHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);

    const chars = [];
    const cleanup = () => {
      stdin.off("data", onData);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
    };

    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(chars.join(""));
          return;
        }
        // Ctrl+C
        if (ch === "") {
          cleanup();
          stdout.write("\n");
          process.exit(130);
        }
        // Retroceso
        if (ch === "" || ch === "\b") {
          chars.pop();
          continue;
        }
        // Ignora teclas de control (flechas, escape…)
        if (ch < " ") continue;
        chars.push(ch);
      }
    };

    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });
}
