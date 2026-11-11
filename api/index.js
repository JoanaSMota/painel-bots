// Entry Vercel do Painel DNA (ESM via dynamic import do build TypeScript).
// Requer `npm run build` antes do deploy (ou buildCommand no vercel.json).
import { MIN_TOKEN_LEN } from "../dist/src/auth.js";
import { OrgSource } from "../dist/src/organograma.js";
import { createHandler } from "../dist/src/server.js";
import { SupabaseStore } from "../dist/src/store-supabase.js";

let handlerPromise = null;

function brandDna() {
  return {
    name: "Painel DNA",
        titulo: "Painel DNA",
    wm: ["DNA", "IA"],
    hideOrg: !(process.env.NOTION_TOKEN || "").trim(),
  };
}

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const token = String(process.env.PAINEL_TOKEN || "").trim();
      if (token.length < MIN_TOKEN_LEN) {
        throw new Error("PAINEL_TOKEN ausente ou curto");
      }
      const url = String(process.env.SUPABASE_URL || "").trim();
      const key = String(process.env.SUPABASE_KEY || "").trim();
      const secret = String(process.env.PAINEL_DB_SECRET || "").trim();
      if (!url || !key || !secret) throw new Error("Supabase env incompleta");
      const store = await SupabaseStore.connect({ url, key, secret });
      const org = new OrgSource({ token: process.env.NOTION_TOKEN, dir: process.env.DATA_DIR });
      const login = String(process.env.PAINEL_LOGIN || "").trim();
      return createHandler({
        token,
        store,
        org,
        login: login || undefined,
        brand: brandDna(),
      });
    })();
  }
  try {
    return await handlerPromise;
  } catch (e) {
    // Falha no boot não pode prender o isolate num Promise rejeitada para sempre.
    handlerPromise = null;
    throw e;
  }
}

export default async function vercelHandler(req, res) {
  try {
    const h = await getHandler();
    return h(req, res);
  } catch (e) {
    console.error("painel-dna boot", e && e.message ? e.message : e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "falha ao iniciar" }));
  }
}
