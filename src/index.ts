import { MIN_TOKEN_LEN } from "./auth.js";
import { createApp } from "./server.js";
import { Store } from "./store.js";

const token = process.env.PAINEL_TOKEN ?? "";
if (token.length < MIN_TOKEN_LEN) {
  console.error(`PAINEL_TOKEN ausente ou curto (mínimo ${MIN_TOKEN_LEN} caracteres). Encerrando.`);
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3000);
const store = await Store.open(process.env.DATA_DIR);
const server = createApp({ token, store });
server.listen(port, () => console.log(`painel-bots ouvindo na porta ${port} (persistência: ${store.mode})`));

const stop = () => server.close(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
