"use strict";
const crypto = require("crypto");
const { URL } = require("url");

const TOKEN = process.env.PAINEL_TOKEN || "";
const DB_SECRET = process.env.PAINEL_DB_SECRET || "";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
const TZ = process.env.TZ_PAINEL || "America/Recife";
const COOKIE = "painel_sess";
const MIN_LEN = 32;
const BODY_LIMIT = 64 * 1024;
const STYLE = "\n:root{--bg:#0A1430;--card:#111E43;--sup:#18295A;--borda:#27396C;--mint:#6FE3C1;--coral:#FF7A66;--tit:#FFFFFF;--txt:#C6D0E8;--sec:#8C9AC0}\n*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.45 system-ui,-apple-system,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif}\nh1,h2,h3{color:var(--tit);margin:0}button,a.btn{font:inherit;cursor:pointer;border-radius:10px;border:1px solid var(--borda);background:var(--sup);color:var(--tit);padding:6px 12px;text-decoration:none;display:inline-block}\nbutton.pri,a.pri{background:var(--mint);color:#0A1430;border-color:var(--mint);font-weight:600}\n.login{min-height:100vh;display:flex;align-items:center;justify-content:center}\n.login form{background:var(--card);border:1px solid var(--borda);border-radius:16px;padding:32px;width:min(360px,92vw);display:flex;flex-direction:column;gap:14px}\n.login input{background:var(--sup);border:1px solid var(--borda);border-radius:10px;color:var(--tit);padding:10px;font:inherit}\n.err{color:var(--coral)}.sec{color:var(--sec)}.mint{color:var(--mint)}\nheader{display:flex;align-items:center;gap:16px;padding:10px 18px;background:var(--card);border-bottom:1px solid var(--borda);flex-wrap:wrap}\nheader h1{font-size:18px}.live{display:flex;align-items:center;gap:6px}.dot{width:9px;height:9px;border-radius:50%;display:inline-block;background:var(--sec)}\n.counts{display:flex;gap:10px;margin-left:auto;flex-wrap:wrap}.chip{background:var(--sup);border:1px solid var(--borda);border-radius:999px;padding:3px 10px;display:flex;gap:6px;align-items:center}\nmain{display:grid;grid-template-columns:280px 1fr 300px;gap:12px;padding:12px;min-height:calc(100vh - 56px)}\n@media (max-width:1100px){main{grid-template-columns:1fr}}\n.col{display:flex;flex-direction:column;gap:12px;min-width:0}\ndetails{background:var(--card);border:1px solid var(--borda);border-radius:14px;padding:10px 12px}\nsummary{color:var(--tit);font-weight:600;cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}summary::before{content:\"\u25be \";color:var(--sec)}details:not([open]) summary::before{content:\"\u25b8 \"}\n.list{display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:300px;overflow:auto}#ficha .list{max-height:none}#detail{max-height:none}.q{background:var(--bg2,rgba(255,255,255,.03));border:1px solid var(--borda);border-radius:10px;padding:8px 10px}.qt{font-weight:600;color:var(--tit);display:flex;align-items:center;gap:6px;margin-bottom:4px}.q .ind{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none}\n.item{background:var(--sup);border:1px solid var(--borda);border-radius:10px;padding:6px 8px}\n.floorbtn{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:var(--sup)}\n.floorbtn.on{border-color:var(--mint)}.pts{display:flex;flex-wrap:wrap;gap:3px;flex:1}.pt{width:7px;height:7px;border-radius:50%}\n.stage{background:var(--card);border:1px solid var(--borda);border-radius:14px;padding:8px;display:flex;flex-direction:column;min-width:0}\n.stage h2{font-size:16px;padding:4px 6px}.stage svg{width:100%;height:auto;flex:1}\n.bot{cursor:pointer}.bar{height:8px;background:var(--sup);border-radius:6px;overflow:hidden;border:1px solid var(--borda)}.bar>i{display:block;height:100%;background:var(--mint)}\n.floorsWrap{display:flex;flex-direction:column;gap:14px;min-width:0}.floorsWrap.cols{flex-direction:row;align-items:flex-start;overflow-x:auto}\n.floorsWrap.cols .fl{flex:1 1 0;min-width:420px}.fl{background:var(--bg);border:1px solid var(--borda);border-radius:12px;padding:6px}.fl h2{font-size:15px;padding:4px 6px}.fl svg{width:100%;height:auto;display:block}\n.bot.working{filter:drop-shadow(0 0 6px #6FE3C1)}.glow{animation:pulse 1.6s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:.25}50%{opacity:.75}}\n.modal{position:fixed;inset:0;background:rgba(5,10,28,.72);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;z-index:9;overflow:auto}.modal[hidden]{display:none}\n.ficha{background:var(--card);border:1px solid var(--borda);border-radius:16px;width:min(720px,96vw);padding:18px;display:flex;flex-direction:column;gap:12px}\n.ficha h4{color:var(--tit);margin:4px 0}.ficha ul{margin:4px 0;padding-left:18px}.ficha li{margin:2px 0}\n.met{display:grid;grid-template-columns:14px 1fr auto;gap:8px;align-items:start;background:var(--sup);border:1px solid var(--borda);border-radius:10px;padding:8px}\n.met .ind{width:12px;height:12px;border-radius:50%;margin-top:4px}.met .v{text-align:right;white-space:nowrap}.tag{font-size:11px;color:var(--sec);border:1px solid var(--borda);border-radius:999px;padding:0 6px}\n.agora{color:var(--mint);font-weight:700}\n.legend{display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:6px 18px;background:var(--bg);border-bottom:1px solid var(--borda);font-size:12px;color:var(--sec)}.legend b{color:var(--tit)}.bdg{display:inline-block;border-radius:6px;padding:0 6px;font-size:11px;font-weight:700}.bdg.l{background:var(--mint);color:#0A1430}.bdg.e{border:1px solid var(--borda);color:var(--sec)}.bdg.c{border:1px solid var(--mint);color:var(--mint)}.jm.ja{background:transparent;border:1px solid #F2C94C;color:#F2C94C}.jm{display:inline-block;width:14px;height:14px;border-radius:50%;background:#F2C94C;color:#0A1430;font-size:9px;font-weight:800;text-align:center;line-height:14px}.ln{display:inline-block;width:22px;border-top:2px dashed var(--mint);vertical-align:middle}\n.small{font-size:12px}.row{display:flex;gap:8px;align-items:center}.av{width:56px;height:56px;border-radius:14px;background:var(--sup);border:1px solid var(--borda);object-fit:cover}\n\n.botcard{display:flex;gap:10px;align-items:flex-start;background:var(--sup);border:1px solid var(--borda);border-radius:12px;padding:10px;cursor:pointer;width:100%;text-align:left;color:inherit}\n.botcard:hover,.botcard.on{border-color:var(--mint)}\n.botcard .nm{font-weight:700;color:var(--tit)}\n.gridbots{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;padding:6px}\n.team{margin:8px 0 4px;color:var(--sec);font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}\n.stworking{color:var(--mint)}.stwaiting_user{color:#F2C94C}.sterror{color:var(--coral)}.stidle,.stdone{color:var(--sec)}\n.dot.ok{background:var(--mint)}.dot.bad{background:var(--coral)}.dot.wait{background:#F2C94C}\n#vivotxt{color:var(--sec)}\n.sair{margin-left:8px}\n";
const CLIENT = "\n(function(){\nvar st=null, sel=null, floorSel=null;\nvar NOME={working:'Trabalhando',idle:'Descansando',waiting_user:'Esperando por mim',error:'Erro',done:'Conclu\u00eddo',none:'Sem status'};\nvar COR={working:'#6FE3C1',idle:'#8C9AC0',waiting_user:'#F2C94C',error:'#FF7A66',done:'#6FE3C1',none:'#8C9AC0'};\nfunction $(id){return document.getElementById(id);}\nfunction esc(s){return String(s==null?'':s);}\nfunction bot(n){return (st&&st.bots&&st.bots[n])||{};}\nfunction statusOf(n){return bot(n).status||'none';}\nfunction roster(){return (st&&st.roster&&st.roster.length)?st.roster:Object.keys((st&&st.bots)||{});}\nfunction groups(){return (st&&st.groups)||{};}\nfunction floors(){var f=(st&&st.floors)||[]; if(f.length) return f; var g=groups(), set={}, out=[]; roster().forEach(function(n){var x=(g[n]||'Sem time').split(' / ')[0]; if(!set[x]){set[x]=1;out.push(x);}}); if(!out.length) out=['Sem time']; return out;}\nfunction teamOf(n){var g=groups()[n]||'Sem time'; var p=g.split(' / '); return {floor:p[0], team:p[1]||p[0]};}\nfunction ago(iso){if(!iso)return ''; var ms=Date.now()-Date.parse(iso); if(!(ms>=0))return ''; var m=Math.floor(ms/60000); if(m<1)return 'agora'; if(m<60)return m+' min'; var h=Math.floor(m/60); if(h<48)return h+' h'; return Math.floor(h/24)+' d';}\nfunction setLive(kind, text){var d=$('livedot'), t=$('vivotxt'); if(!t)return; t.textContent=text; if(d){d.className='dot'+(kind==='ok'?' ok':kind==='bad'?' bad':kind==='wait'?' wait':'');}}\nfunction counts(){var c={working:0,waiting_user:0,error:0,idle:0}; roster().forEach(function(n){var s=statusOf(n); if(c[s]!=null)c[s]++; else if(s==='done')c.idle++;}); return c;}\nfunction renderCounts(){var c=counts(); $('cWork').textContent=c.working; $('cWait').textContent=c.waiting_user; $('cErr').textContent=c.error; $('cIdle').textContent=c.idle;}\nfunction renderFloors(){var wrap=$('floorsList'); wrap.replaceChildren(); floors().forEach(function(f,i){var btn=document.createElement('button'); btn.type='button'; btn.className='floorbtn'+(floorSel===f?' on':''); var pts=document.createElement('span'); pts.className='pts';\n roster().filter(function(n){return teamOf(n).floor===f;}).forEach(function(n){var p=document.createElement('i'); p.className='pt'; p.style.background=COR[statusOf(n)]||COR.none; pts.appendChild(p);});\n btn.appendChild(document.createTextNode((i+1)+'. '+f)); btn.appendChild(pts);\n btn.onclick=function(){floorSel=f; render();}; wrap.appendChild(btn);});}\nfunction renderWaiting(){var wrap=$('waitList'); wrap.replaceChildren(); var list=roster().filter(function(n){return statusOf(n)==='waiting_user';}).sort(function(a,b){return Date.parse(bot(a).since||bot(a).at||0)-Date.parse(bot(b).since||bot(b).at||0);});\n if(!list.length){var e=document.createElement('div'); e.className='sec small'; e.textContent='Ningu\u00e9m esperando por voc\u00ea.'; wrap.appendChild(e); return;}\n list.forEach(function(n){wrap.appendChild(botItem(n));});}\nfunction botItem(n){var b=bot(n), s=statusOf(n), el=document.createElement('button'); el.type='button'; el.className='botcard'+(sel===n?' on':'');\n var left=document.createElement('div'); left.style.flex='1'; left.style.minWidth='0';\n var nm=document.createElement('div'); nm.className='nm'; nm.textContent=n; left.appendChild(nm);\n var sub=document.createElement('div'); sub.className='small sec'; sub.textContent=(NOME[s]||s)+(b.step?' \u00b7 '+b.step:'')+(b.since||b.at?' \u00b7 h\u00e1 '+ago(b.since||b.at):''); left.appendChild(sub);\n el.appendChild(left); el.onclick=function(){sel=n; renderDetail(); renderStage();}; return el;}\nfunction renderStage(){var wrap=$('floorsWrap'); wrap.replaceChildren(); var fs=floors(); if(!floorSel||fs.indexOf(floorSel)<0) floorSel=fs[0];\n var show=fs.filter(function(f){return f===floorSel;});\n show.forEach(function(f){var fl=document.createElement('div'); fl.className='fl'; var h=document.createElement('h2'); h.textContent=f; fl.appendChild(h);\n  var by={}; roster().filter(function(n){return teamOf(n).floor===f;}).forEach(function(n){var t=teamOf(n).team; (by[t]=by[t]||[]).push(n);});\n  Object.keys(by).sort().forEach(function(t){var lab=document.createElement('div'); lab.className='team'; lab.textContent=t; fl.appendChild(lab);\n   var grid=document.createElement('div'); grid.className='gridbots'; by[t].forEach(function(n){grid.appendChild(botItem(n));}); fl.appendChild(grid);});\n  wrap.appendChild(fl);});}\nfunction renderDetail(){var box=$('detail'); box.replaceChildren();\n if(!sel){var r=document.createElement('div'); r.className='q'; r.innerHTML='<div class=\"qt\">Resumo geral</div>';\n  var c=counts(); var lines=[['Travados',c.waiting_user+c.error],['Trabalhando agora',c.working],['Descansando',c.idle]];\n  lines.forEach(function(L){var d=document.createElement('div'); d.className='item small'; d.textContent=L[0]+': '+L[1]; r.appendChild(d);}); box.appendChild(r); return;}\n var b=bot(sel), s=statusOf(sel);\n var h=document.createElement('div'); h.className='q'; h.innerHTML='<div class=\"qt\">'+esc(sel)+'</div>';\n var p=document.createElement('div'); p.className='small'; p.innerHTML='<span class=\"st'+s+'\">'+(NOME[s]||s)+'</span>'+(b.step?' \u00b7 '+esc(b.step):''); h.appendChild(p);\n if(b.since||b.at){var a=document.createElement('div'); a.className='small sec'; a.textContent='Desde h\u00e1 '+ago(b.since||b.at); h.appendChild(a);}\n box.appendChild(h);\n var q1=document.createElement('div'); q1.className='q'; q1.innerHTML='<div class=\"qt\"><i class=\"ind\" style=\"background:'+COR[s]+'\"></i> Mando tarefa pra ele?</div><div class=\"small\">'+(s==='idle'||s==='done'?'Livre para receber tarefa.':s==='working'?'Ocupado agora.':'Parado \u2014 veja o bloqueio.')+'</div>'; box.appendChild(q1);\n var q2=document.createElement('div'); q2.className='q'; q2.innerHTML='<div class=\"qt\"><i class=\"ind\" style=\"background:'+(s==='waiting_user'||s==='error'?COR[s]:COR.none)+'\"></i> Algo travando?</div><div class=\"small\">'+(s==='waiting_user'?'Esperando por voc\u00ea'+(b.step?': '+esc(b.step):'.'):s==='error'?'Com erro'+(b.step?': '+esc(b.step):'.'):'Nada travado no momento.')+'</div>'; box.appendChild(q2);\n var mets=(st.metrics&&st.metrics[sel])||[];\n var q3=document.createElement('div'); q3.className='q'; q3.innerHTML='<div class=\"qt\"><i class=\"ind\" style=\"background:'+COR.idle+'\"></i> Alinhado ao objetivo?</div>';\n if(!mets.length){var m0=document.createElement('div'); m0.className='small sec'; m0.textContent='Sem m\u00e9tricas reportadas.'; q3.appendChild(m0);}\n else mets.slice(0,6).forEach(function(m){var row=document.createElement('div'); row.className='met'; var ind=document.createElement('i'); ind.className='ind'; ind.style.background=m.status==='ok'?COR.working:m.status==='sem_medicao'?COR.idle:COR.error; row.appendChild(ind); var mid=document.createElement('div'); mid.innerHTML='<b>'+esc(m.metric||m.name||'')+'</b><div class=\"small sec\">'+esc(m.value||'')+(m.target?' \u00b7 meta '+esc(m.target):'')+'</div>'; row.appendChild(mid); q3.appendChild(row);});\n box.appendChild(q3);\n var row=document.createElement('div'); row.className='row'; row.style.marginTop='8px';\n var clear=document.createElement('button'); clear.type='button'; clear.textContent='Limpar sele\u00e7\u00e3o'; clear.onclick=function(){sel=null; renderDetail(); renderStage();}; row.appendChild(clear);\n var chat=(st.chat&&st.chat[sel]); if(chat){var a=document.createElement('a'); a.className='btn pri'; a.href=chat; a.textContent='Abrir chat'; row.appendChild(a);}\n box.appendChild(row);\n}\nfunction render(){if(!st)return; renderCounts(); renderFloors(); renderWaiting(); renderStage(); renderDetail();}\nfunction load(){setLive('wait','conectando...'); var ctrl=typeof AbortController!=='undefined'?new AbortController():null; var to=setTimeout(function(){try{ctrl&&ctrl.abort();}catch(e){}},12000);\n fetch('/api/state',{credentials:'same-origin',cache:'no-store',signal:ctrl&&ctrl.signal}).then(function(r){clearTimeout(to); if(r.status===401){location.href='/';return null;} if(!r.ok) throw new Error('http '+r.status); return r.json();})\n .then(function(s){if(!s)return; st=s; setLive('ok','ao vivo'); render();})\n .catch(function(){clearTimeout(to); setLive('bad','sem conex\u00e3o');});}\nload(); setInterval(load,30000);\n})();\n";

function sha256hex(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}
function safeEqual(a, b) {
  const x = crypto.createHash("sha256").update(String(a), "utf8").digest();
  const y = crypto.createHash("sha256").update(String(b), "utf8").digest();
  return crypto.timingSafeEqual(x, y);
}
function sessionValue(token) {
  return crypto.createHmac("sha256", token).update("painel-bots/sessao/v1").digest("base64url");
}
function bearer(h) {
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  return m ? m[1].trim() : null;
}
function readCookie(header, name) {
  if (!header) return null;
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || "?";
}
function nonce() {
  return crypto.randomBytes(16).toString("base64");
}

async function rpc(fn, args) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("supabase não configurado");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const err = new Error(typeof data === "object" && data?.message ? data.message : `rpc ${fn} ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function getState() {
  const row = await rpc("painel_get_state", { p_secret: DB_SECRET });
  const v = row && typeof row === "object" ? row.v : null;
  return v && typeof v === "object" ? v : { bots: {}, roster: [], floors: [], groups: {}, feed: [], metrics: {}, chat: {}, looks: {}, routines: {}, usage: null };
}

async function putState(v, version) {
  return rpc("painel_put_state", { p_secret: DB_SECRET, p_v: v, p_version: version });
}

function loginPage(n, err) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Painel DNA</title><style nonce="${n}">${STYLE}</style></head>
<body><div class="login"><form method="post" action="/login"><h1>Painel DNA</h1><span class="sec">Acesso restrito. Entre com a chave.</span>
${err ? `<div class="err">${err}</div>` : ""}
<label for="chave">Chave</label><input id="chave" name="chave" type="password" autocomplete="current-password" required autofocus>
<button class="pri" type="submit">Entrar</button></form></div></body></html>`;
}

function panelPage(n) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Painel DNA</title><style nonce="${n}">${STYLE}</style></head>
<body>
<header>
  <h1>Painel DNA</h1>
  <div class="live"><i id="livedot" class="dot wait"></i><span id="vivotxt">conectando...</span></div>
  <div class="counts">
    <span class="chip"><i class="dot ok"></i>trabalhando agora <b id="cWork">0</b></span>
    <span class="chip"><i class="dot wait"></i>esperando <b id="cWait">0</b></span>
    <span class="chip"><i class="dot bad"></i>erros <b id="cErr">0</b></span>
    <span class="chip"><i class="dot"></i>descansando <b id="cIdle">0</b></span>
  </div>
  <form method="post" action="/logout"><button class="sair" type="submit">Sair</button></form>
</header>
<div class="legend">Como ler:
  <span class="bdg l">HEAD</span> <span class="bdg l">GER</span> <span class="bdg l">LÍDER</span>
  <span class="bdg e">ESP</span> <span class="bdg e">ANALISTA</span> <span class="bdg e">OPER</span>
  <span class="bdg c">COORD</span>
  <span class="jm">j</span> fala direto com a Joana
  <span class="jm ja">J</span> agenda/apoio executivo
  <span class="ln"></span> equipe do líder
  <span class="sec">· Joana fala com os líderes; cada líder exige, cobra e responde pelo resultado da equipe.</span>
</div>
<main>
  <div class="col">
    <details open><summary>Andares</summary><div class="list" id="floorsList"></div></details>
    <details open><summary>Esperando por mim</summary><div class="list" id="waitList"></div></details>
  </div>
  <div class="col stage"><div class="floorsWrap" id="floorsWrap"></div></div>
  <div class="col"><details open><summary>Decisão rápida</summary><div class="list" id="detail"></div></details></div>
</main>
<script nonce="${n}">${CLIENT}</script>
</body></html>`;
}

function send(res, status, body, headers = {}) {
  const h = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    ...headers,
  };
  res.statusCode = status;
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] || 0);
    if (declared > limit) { reject(Object.assign(new Error("grande"), { status: 413 })); req.resume(); return; }
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error("grande"), { status: 413 })); req.resume(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => reject(Object.assign(new Error("corpo"), { status: 400 })));
  });
}

function configured() {
  return TOKEN.length >= MIN_LEN && DB_SECRET && SUPABASE_URL && SUPABASE_KEY;
}

function authed(req) {
  if (!configured()) return false;
  const sess = sessionValue(TOKEN);
  const b = bearer(req.headers.authorization);
  if (b !== null) return safeEqual(b, TOKEN);
  const c = readCookie(req.headers.cookie, COOKIE);
  return c !== null && safeEqual(c, sess);
}

function pathOf(req) {
  try { return new URL(req.url || "/", "http://x").pathname; } catch { return "/"; }
}

module.exports = async function handler(req, res) {
  const method = req.method || "GET";
  const route = pathOf(req);
  const n = nonce();
  const csp = `default-src 'none'; script-src 'nonce-${n}'; style-src 'nonce-${n}'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`;
  res.setHeader("Content-Security-Policy", csp);

  try {
    if (!configured()) {
      if (route === "/health") return send(res, 200, JSON.stringify({ ok: false, reason: "env" }), { "Content-Type": "application/json; charset=utf-8" });
      return send(res, 500, "configuração incompleta", { "Content-Type": "text/plain; charset=utf-8" });
    }

    if (route === "/health") {
      return send(res, 200, JSON.stringify({ ok: true }), { "Content-Type": "application/json; charset=utf-8" });
    }

    if (route === "/logout" && method === "POST") {
      return send(res, 303, "", { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
    }

    if (route === "/login" && method === "POST") {
      const ip = clientIp(req);
      try {
        const blocked = await rpc("painel_login_blocked", { p_secret: DB_SECRET, p_ip: ip });
        if (blocked === true || blocked === "true") {
          return send(res, 429, loginPage(n, "muitos erros — tente em 15 min"), { "Content-Type": "text/html; charset=utf-8" });
        }
      } catch {}
      const raw = await readBody(req, 8 * 1024);
      const params = new URLSearchParams(raw.toString("utf8"));
      const chave = (params.get("chave") || "").trim();
      if (chave.length >= MIN_LEN && safeEqual(chave, TOKEN)) {
        try { await rpc("painel_login_ok", { p_secret: DB_SECRET, p_ip: ip }); } catch {}
        const sess = sessionValue(TOKEN);
        return send(res, 303, "", {
          Location: "/",
          "Set-Cookie": `${COOKIE}=${sess}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
        });
      }
      try { await rpc("painel_login_fail", { p_secret: DB_SECRET, p_ip: ip }); } catch {}
      return send(res, 401, loginPage(n, "chave inválida"), { "Content-Type": "text/html; charset=utf-8" });
    }

    if (route === "/api/state" && method === "GET") {
      if (!authed(req)) return send(res, 401, JSON.stringify({ error: "não autorizado" }), { "Content-Type": "application/json; charset=utf-8" });
      const state = await getState();
      return send(res, 200, JSON.stringify(state), { "Content-Type": "application/json; charset=utf-8" });
    }

    if (route === "/ingest" && method === "POST") {
      const b = bearer(req.headers.authorization);
      if (b === null || !safeEqual(b, TOKEN)) return send(res, 401, JSON.stringify({ error: "não autorizado" }), { "Content-Type": "application/json; charset=utf-8" });
      const raw = await readBody(req, BODY_LIMIT);
      let msg;
      try { msg = JSON.parse(raw.toString("utf8")); } catch {
        return send(res, 400, JSON.stringify({ error: "JSON inválido" }), { "Content-Type": "application/json; charset=utf-8" });
      }
      // Apply limited mutations: status, metric, routines, roster, looks, groups, chat, usage
      const row = await rpc("painel_get_state", { p_secret: DB_SECRET });
      const version = row && typeof row === "object" ? Number(row.version || 0) : 0;
      const state = (row && row.v && typeof row.v === "object") ? row.v : { bots: {}, roster: [], floors: [], groups: {}, feed: [], metrics: {}, chat: {}, looks: {}, routines: {}, usage: null };
      state.bots = state.bots || {};
      state.feed = Array.isArray(state.feed) ? state.feed : [];
      state.metrics = state.metrics || {};
      state.routines = state.routines || {};
      state.chat = state.chat || {};
      state.looks = state.looks || {};
      state.groups = state.groups || {};

      const type = msg && msg.type;
      const now = new Date().toISOString();
      if (type === "status") {
        const name = String(msg.bot || "").trim();
        const status = String(msg.status || "");
        if (!name || !["working","idle","waiting_user","error","done"].includes(status)) {
          return send(res, 400, JSON.stringify({ error: "status inválido" }), { "Content-Type": "application/json; charset=utf-8" });
        }
        let step = typeof msg.step === "string" ? msg.step.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() : "";
        if ([...step].length > 80) step = [...step].slice(0, 79).join("") + "…";
        const prev = state.bots[name] || {};
        const same = prev.status === status && (prev.step || "") === step;
        const entry = {
          status,
          step,
          at: now,
          since: same && prev.since ? prev.since : now,
          stepAt: (!same || prev.step !== step) ? now : (prev.stepAt || now),
          steps: Array.isArray(prev.steps) ? prev.steps.slice() : [],
        };
        if (!same && status !== "idle") {
          entry.steps.unshift({ at: now, step, status });
          entry.steps = entry.steps.slice(0, 10);
          state.feed.unshift({ at: now, bot: name, step, status });
          state.feed = state.feed.slice(0, 50);
        }
        state.bots[name] = entry;
      } else if (type === "metric") {
        const agent = String(msg.agent || "").trim();
        const metric = String(msg.metric || "").trim();
        if (!agent || !metric) return send(res, 400, JSON.stringify({ error: "metric inválida" }), { "Content-Type": "application/json; charset=utf-8" });
        const list = Array.isArray(state.metrics[agent]) ? state.metrics[agent].slice() : [];
        if (msg.remove) {
          state.metrics[agent] = list.filter((m) => m.metric !== metric);
        } else {
          const item = { metric, value: msg.value != null ? String(msg.value).slice(0, 60) : "", target: msg.target != null ? String(msg.target).slice(0, 60) : "", status: String(msg.status || "sem_medicao"), at: now };
          const i = list.findIndex((m) => m.metric === metric);
          if (i >= 0) list[i] = item; else list.push(item);
          state.metrics[agent] = list;
        }
      } else if (type === "routines") {
        const name = String(msg.bot || "").trim();
        if (!name || !Array.isArray(msg.items)) return send(res, 400, JSON.stringify({ error: "routines inválidas" }), { "Content-Type": "application/json; charset=utf-8" });
        state.routines[name] = msg.items.slice(0, 50);
        state.routines_at = now;
      } else if (type === "roster") {
        if (!Array.isArray(msg.names)) return send(res, 400, JSON.stringify({ error: "roster inválido" }), { "Content-Type": "application/json; charset=utf-8" });
        state.roster = msg.names.map(String).slice(0, 200);
      } else if (type === "groups") {
        if (!msg.bots || typeof msg.bots !== "object") return send(res, 400, JSON.stringify({ error: "groups inválido" }), { "Content-Type": "application/json; charset=utf-8" });
        state.groups = msg.bots;
        if (Array.isArray(msg.floors)) state.floors = msg.floors.map(String).slice(0, 50);
      } else if (type === "looks") {
        if (!msg.bots || typeof msg.bots !== "object") return send(res, 400, JSON.stringify({ error: "looks inválido" }), { "Content-Type": "application/json; charset=utf-8" });
        state.looks = Object.assign({}, state.looks, msg.bots);
      } else if (type === "chat") {
        if (!msg.bots || typeof msg.bots !== "object") return send(res, 400, JSON.stringify({ error: "chat inválido" }), { "Content-Type": "application/json; charset=utf-8" });
        state.chat = Object.assign({}, state.chat, msg.bots);
      } else if (type === "usage") {
        state.usage = { total_used_pct: msg.total_used_pct, resets_at: msg.resets_at, bots: msg.bots || {}, at: now };
      } else {
        return send(res, 400, JSON.stringify({ error: "type desconhecido" }), { "Content-Type": "application/json; charset=utf-8" });
      }

      await putState(state, version);
      return send(res, 200, JSON.stringify({ ok: true, type }), { "Content-Type": "application/json; charset=utf-8" });
    }

    if (route === "/" && method === "GET") {
      if (!authed(req)) return send(res, 200, loginPage(n), { "Content-Type": "text/html; charset=utf-8" });
      return send(res, 200, panelPage(n), { "Content-Type": "text/html; charset=utf-8" });
    }

    return send(res, 404, "não encontrado", { "Content-Type": "text/plain; charset=utf-8" });
  } catch (e) {
    console.error("painel-dna", e && e.message ? e.message : e);
    return send(res, e && e.status === 413 ? 413 : 500, JSON.stringify({ error: "falha interna" }), { "Content-Type": "application/json; charset=utf-8" });
  }
};
