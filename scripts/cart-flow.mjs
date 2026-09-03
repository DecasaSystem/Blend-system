/**
 * Prueba del flujo de pedido en un navegador real.
 *   node scripts/cart-flow.mjs [url]
 */
import { chromium } from "playwright-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] ?? "http://localhost:3000";

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "es-CO",
  reducedMotion: "reduce",
});
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

// 1. Formato de moneda
// `.u-price` y no `.u-display`: los precios pasaron a la monoespaciada, y en
// la tarjeta la clase de titular ahora es el nombre de la bebida.
const firstPrice = await page.locator("#menu article").first().locator(".u-price").innerText();
check("precio en formato COP", /\$\s?\d{1,3}\.\d{3}/.test(firstPrice), firstPrice);

// El botón de agregar tiene que caber DENTRO de su tarjeta. En la rejilla de
// móvil las tarjetas miden 171 px: cualquier cosa que crezca en esa fila lo
// empuja fuera, encima de la tarjeta vecina, y deja de poder pulsarse.
//
// Se mide la geometría y no `elementFromPoint`, que depende de dónde esté el
// scroll: con la barra fija de móvil por medio daría falsas alarmas. Que el
// clic funcione lo comprueba el paso siguiente.
const sobra = await page
  .locator("#menu article")
  .first()
  .getByRole("button", { name: /Agregar .* al pedido/ })
  .evaluate((el) => {
    const b = el.getBoundingClientRect();
    const a = el.closest("article").getBoundingClientRect();
    return Math.round(b.right - a.right);
  });
check("el botón de agregar cabe en su tarjeta", sobra <= 0, `se sale ${sobra}px`);

// 2. Agregar rápido desde el menú
await page
  .locator("#menu article")
  .first()
  .getByRole("button", { name: /Agregar .* al pedido/ })
  .click();
await page.waitForTimeout(400);
const toastVisible = await page.getByText(/en el pedido/).isVisible();
check("aviso de agregado", toastVisible);
const drawerClosed = !(await page.getByRole("dialog", { name: "Tu pedido" }).isVisible());
check("el carrito NO se abre solo", drawerClosed);

// 3. Personalizar: grande + un topping
await page.locator("#menu article").first().locator("h3").click();
await page.waitForTimeout(400);
const sheet = page.getByRole("dialog").first();
await sheet.getByRole("button", { name: /^Grande/ }).click();
await sheet.getByRole("button", { name: /Cacao nibs/ }).click();
const addLabel = await sheet.getByRole("button", { name: /^Agregar ·/ }).innerText();
check("precio con tamaño y topping", /26\.400/.test(addLabel.replace(/\s/g, " ")), addLabel);
await sheet.getByRole("button", { name: /^Agregar ·/ }).click();
await page.waitForTimeout(500);

// 4. Carrito: dos líneas distintas
await page
  .locator("header")
  .getByRole("button", { name: /Abrir carrito/ })
  .click();
await page.waitForTimeout(500);
const drawer = page.getByRole("dialog", { name: "Tu pedido" });
const lineCount = await drawer.locator("ul > li").count();
check("dos líneas separadas por opciones", lineCount === 2, `líneas=${lineCount}`);

const detail = await drawer.locator("ul > li").nth(1).innerText();
// El CSS pone las etiquetas en mayúsculas, por eso la comparación ignora el caso.
check(
  "detalle de la línea",
  /grande/i.test(detail) && /cacao nibs/i.test(detail),
  detail.replace(/\n/g, " | "),
);

// 5. Totales: 17.900 + 26.400 = 44.300 y domicilio 6.900
let totalText = await drawer.getByText(/Total/).locator("..").innerText();
check(
  "total con domicilio",
  /51\.200/.test(totalText.replace(/\s/g, " ")),
  totalText.replace(/\n/g, " "),
);

// 6. Recoger quita el domicilio
await drawer.getByRole("button", { name: "Recoger" }).click();
await page.waitForTimeout(300);
totalText = await drawer.getByText(/Total/).locator("..").innerText();
check(
  "recoger sin domicilio",
  /44\.300/.test(totalText.replace(/\s/g, " ")),
  totalText.replace(/\n/g, " "),
);

// 7. Editar una línea desde el carrito
await drawer.locator("ul > li").nth(1).getByRole("button", { name: "Editar" }).click();
await page.waitForTimeout(500);
const editSheet = page.getByRole("dialog").first();
const isEditing = await editSheet.getByText("Editar", { exact: true }).isVisible();
const grandePressed = await editSheet
  .getByRole("button", { name: /^Grande/ })
  .getAttribute("aria-pressed");
check("la hoja abre en modo edición", isEditing);
check("conserva las opciones guardadas", grandePressed === "true", `aria-pressed=${grandePressed}`);

await editSheet.getByRole("button", { name: /^Chico/ }).click();
await editSheet.getByRole("button", { name: /^Guardar ·/ }).click();
await page.waitForTimeout(500);

// 8. Persistencia
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
const badge = await page
  .locator("header")
  .getByRole("button", { name: /Abrir carrito/ })
  .innerText();
check("el pedido sobrevive a recargar", /2/.test(badge), badge.replace(/\n/g, " "));

const modeKept = await page.evaluate(() => JSON.parse(localStorage.getItem("blend.cart.v2")).mode);
check("recuerda recoger vs domicilio", modeKept === "recoger", modeKept);

console.log(
  errors.length
    ? `\nERRORES DE CONSOLA:\n${errors.slice(0, 5).join("\n")}`
    : "\nsin errores de consola",
);
console.log(failures ? `\n${failures} fallas` : "\ntodo pasa");

await browser.close();
process.exit(failures ? 1 : 0);
