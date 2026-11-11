import { MIN_TOKEN_LEN } from "./auth.js";
import { OrgSource } from "./organograma.js";
import { createApp, type AppOptions } from "./server.js";
import { Store } from "./store.js";
import { SupabaseStore } from "./store-supabase.js";

const token = (process.env.PAINEL_TOKEN ?? "").trim();
if (token.length < MIN_TOKEN_LEN) {
  console.error(`PAINEL_TOKEN ausente ou curto (mínimo ${MIN_TOKEN_LEN} caracteres). Encerrando.`);
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3000);
const login = (process.env.PAINEL_LOGIN ?? "").trim();

const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim();
const supabaseKey = (process.env.SUPABASE_KEY ?? "").trim();
const dbSecret = (process.env.PAINEL_DB_SECRET ?? "").trim();
const useSupabase = Boolean(supabaseUrl && supabaseKey && dbSecret);

const store = useSupabase
  ? await SupabaseStore.connect({ url: supabaseUrl, key: supabaseKey, secret: dbSecret })
  : await Store.open(process.env.DATA_DIR);

// NOTION_TOKEN (opcional): só o servidor lê; sem ele o organograma usa cache/snapshot.
const org = new OrgSource({ token: process.env.NOTION_TOKEN, dir: process.env.DATA_DIR });

const brand =
  (process.env.PAINEL_BRAND ?? "").trim().toLowerCase() === "dna"
    ? {
        name: "Painel DNA",
        titulo: "PAINEL DNA",
        wm: ["DNA", "IA"] as [string, string],
        hideOrg: !(process.env.NOTION_TOKEN ?? "").trim(),
      }
    : undefined;

const opts: AppOptions = { token, store, org, login: login || undefined, brand };
const server = createApp(opts);
server.listen(port, () =>
  console.log(
    `painel-bots ouvindo na porta ${port} (persistência: ${useSupabase ? "supabase" : store.mode})`,
  ),
);

const stop = () => server.close(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
