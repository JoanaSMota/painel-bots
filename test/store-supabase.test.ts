import assert from "node:assert/strict";
import { test } from "node:test";
import { REFRESH_TTL_MS, dnaToState, stateToDna } from "../src/store-supabase.js";

test("dnaToState mapeia looks/chat/groups/routines para o bot", () => {
  const st = dnaToState({
    bots: {
      CMO: { status: "waiting_user", step: "ok", since: "2026-01-01T00:00:00.000Z", steps: [] },
    },
    groups: { CMO: "Comercial + Marketing / Mkt" },
    looks: { CMO: { shape: "blob", color: "violet" } },
    chat: { CMO: "grokbot://app/v1/agent?id=x" },
    routines: { CMO: [{ name: "r", schedule: "x", next_run: null }] },
    floors: ["Comercial + Marketing"],
    roster: ["CMO"],
    feed: [],
    avatars: {},
  });
  const cmo = st.bots.CMO!;
  assert.equal(cmo.status, "waiting_user");
  assert.equal(cmo.team, "Comercial + Marketing");
  assert.equal(cmo.look?.shape, "blob");
  assert.equal(cmo.chat?.startsWith("grokbot://"), true);
  assert.equal(cmo.routines?.length, 1);
  assert.deepEqual(st.floors, ["Comercial + Marketing"]);
});

test("stateToDna preserva subtime do groups anterior", () => {
  const st = dnaToState({
    bots: { CMO: { status: "idle", step: "", since: "2026-01-01T00:00:00.000Z" } },
    groups: { CMO: "Comercial + Marketing / Mkt" },
  });
  const out = stateToDna(st, { groups: { CMO: "Comercial + Marketing / Mkt" }, metrics: { CMO: [] } });
  assert.equal((out.groups as Record<string, string>).CMO, "Comercial + Marketing / Mkt");
  assert.ok(Array.isArray((out.metrics as Record<string, unknown>).CMO));
});

test("REFRESH_TTL_MS cobre rajadas de poll sem ser maior que o intervalo do painel", () => {
  assert.ok(REFRESH_TTL_MS >= 1000);
  assert.ok(REFRESH_TTL_MS < 10_000);
});
