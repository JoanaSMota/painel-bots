// Testes do visual v2: destaque de status, movimento reduzido e CSP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { panelPage } from "../src/page.js";

const html = panelPage("nonce-teste");
const script = html.slice(html.indexOf('<script nonce="nonce-teste">') + 28, html.lastIndexOf("</script>"));

test("script do painel é JavaScript válido", () => {
  assert.doesNotThrow(() => new Function(script));
});

test("respeita prefers-reduced-motion", () => {
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)\{[^}]*animation:none!important/);
});

test("estilos de destaque por status existem (trabalhando, esperando, erro, descansando)", () => {
  for (const sel of [".bot-g.working", ".bot-g.waiting_user", ".bot-g.idle", ".contas .on-waiting_user", ".contas .on-error", ".card.alerta", ".tag.w", ".tag.e", ".anel"]) {
    assert.ok(html.includes(sel), "faltou " + sel);
  }
  assert.match(script, /esperando há /);
});

test("sem atributo style nem recurso externo (CSP com nonce, sem CDN)", () => {
  assert.ok(!/\sstyle=/.test(html), "atributo style bloqueado pela CSP");
  assert.ok(!/https?:\/\//.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, "")), "URL externa no HTML");
  assert.ok(!html.includes("onclick="), "handler inline");
});
