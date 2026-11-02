// HTML do login e do painel. Nenhum dado de bot é embutido no HTML:
// o painel busca /api/state (protegido) e monta o DOM só com textContent.

const STYLE = String.raw`
:root{--bg:#0f1115;--card:#181b22;--line:#2a2f3a;--txt:#e7e9ee;--mut:#9aa3b2;--ok:#2ecc71;--work:#3498db;--wait:#f1c40f;--err:#e74c3c;--done:#8e9aaf}
*{box-sizing:border-box}body{margin:0;font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--txt)}
header{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--line)}
h1{font-size:18px;margin:0}small,.mut{color:var(--mut)}main{padding:16px 20px;max-width:1200px;margin:0 auto}
button{background:#2a2f3a;color:var(--txt);border:1px solid var(--line);border-radius:6px;padding:6px 12px;cursor:pointer}
.usage{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:18px}
.bar{height:8px;background:#2a2f3a;border-radius:4px;overflow:hidden;margin:4px 0 8px}.bar>i{display:block;height:100%;background:var(--work)}
.bar.hi>i{background:var(--wait)}.bar.max>i{background:var(--err)}
.ub{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px 16px}
.floor{border:1px solid var(--line);border-radius:10px;margin-bottom:16px;background:linear-gradient(180deg,#151820,#12141a)}
.floor h2{margin:0;padding:8px 14px;font-size:14px;border-bottom:1px solid var(--line);letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}
.bots{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;padding:12px}
.bot{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.top{display:flex;gap:10px;align-items:center}.av{width:34px;height:34px;flex:none;background:#555;border-radius:50%}
.av.square{border-radius:4px}.av.rounded{border-radius:10px}.av.triangle{border-radius:0;clip-path:polygon(50% 0,100% 100%,0 100%)}
.av.diamond{border-radius:0;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}.av.hexagon{border-radius:0;clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)}
.av.star{border-radius:0;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
.name{font-weight:600}.acc{font-size:12px;color:var(--mut)}
.st{display:inline-block;font-size:12px;padding:1px 8px;border-radius:10px;margin-top:2px;color:#111;font-weight:600}
.s-working{background:var(--work)}.s-idle{background:var(--ok)}.s-waiting_user{background:var(--wait)}.s-error{background:var(--err);color:#fff}.s-done{background:var(--done)}.s-none{background:#444;color:#ddd}
.step{margin:8px 0 2px;word-break:break-word}.rt{margin:8px 0 0;padding:0;list-style:none;font-size:13px}.rt li{display:flex;justify-content:space-between;gap:8px;border-top:1px dashed var(--line);padding:3px 0}
a{color:#7fb3ff}.login{max-width:360px;margin:12vh auto;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:22px}
.login input{width:100%;padding:9px;margin:10px 0;border-radius:6px;border:1px solid var(--line);background:#0f1115;color:var(--txt)}
.erro{color:var(--err)}`;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function loginPage(nonce: string, erro?: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Painel dos bots — entrar</title><style nonce="${nonce}">${STYLE}</style></head>
<body><form class="login" method="post" action="/login"><h1>Painel dos bots</h1>
<p class="mut">Digite a chave de acesso.</p>${erro ? `<p class="erro">${esc(erro)}</p>` : ""}
<input type="password" name="chave" autocomplete="current-password" required autofocus aria-label="Chave">
<button type="submit">Entrar</button></form></body></html>`;
}

const CLIENT = String.raw`
(function(){
var TZ='America/Recife', SEM='Sem time', PREFIX='grokbot://app/v1/agent?id=';
var NOMES={working:'trabalhando',idle:'livre',waiting_user:'esperando o Lucas',error:'erro',done:'concluído'};
var SHAPES=['circle','square','rounded','triangle','diamond','hexagon','star'];
var fmt=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=String(txt);return e;}
function quando(iso){if(!iso)return '—';var d=new Date(iso);return isNaN(d)?'—':fmt.format(d)+' (Recife)';}
function ha(iso){if(!iso)return '';var s=Math.round((Date.now()-new Date(iso))/1000);if(s<0)s=0;
 if(s<60)return 'há '+s+'s';var m=Math.round(s/60);if(m<60)return 'há '+m+' min';var h=Math.round(m/60);if(h<48)return 'há '+h+' h';return 'há '+Math.round(h/24)+' dias';}
function bar(p){var b=el('div','bar'+(p>=90?' max':p>=70?' hi':''));var i=el('i');i.style.width=Math.max(0,Math.min(100,p))+'%';b.appendChild(i);return b;}
function render(st){
 var root=document.getElementById('app');root.replaceChildren();
 var u=st.usage,box=el('section','usage');
 box.appendChild(el('strong',null,'Consumo da semana'));
 if(u){box.appendChild(el('div',null,u.total_used_pct+'% usado · renova em '+quando(u.resets_at)));box.appendChild(bar(u.total_used_pct));
  var ub=el('div','ub');Object.keys(u.bots||{}).sort(function(a,b){return u.bots[b]-u.bots[a];}).forEach(function(n){var d=el('div');d.appendChild(el('small',null,n+': '+u.bots[n]+'%'));d.appendChild(bar(u.bots[n]));ub.appendChild(d);});
  box.appendChild(ub);box.appendChild(el('small',null,'atualizado '+ha(u.at)));}
 else box.appendChild(el('div','mut','Sem dados de consumo ainda.'));
 root.appendChild(box);
 var bots=st.bots||{},nomes=st.roster?st.roster.slice():Object.keys(bots);
 if(!nomes.length){root.appendChild(el('p','mut','Nenhum bot reportou ainda.'));return;}
 var times={};nomes.forEach(function(n){var t=(bots[n]&&bots[n].team)||SEM;(times[t]=times[t]||[]).push(n);});
 Object.keys(times).sort(function(a,b){if(a===SEM)return 1;if(b===SEM)return -1;return a.localeCompare(b,'pt-BR');}).forEach(function(t,idx){
  var f=el('section','floor');f.appendChild(el('h2',null,'Andar '+(idx+1)+' · '+t));var g=el('div','bots');
  times[t].sort(function(a,b){return a.localeCompare(b,'pt-BR');}).forEach(function(n){
   var b=bots[n]||{},c=el('article','bot'),top=el('div','top'),look=b.look||{};
   var av=el('div','av '+(SHAPES.indexOf(look.shape)>=0?look.shape:'circle'));
   if(/^#[0-9a-f]{3,6}$/i.test(look.color||''))av.style.background=look.color;top.appendChild(av);
   var nm=el('div');nm.appendChild(el('div','name',n));if(look.accessory)nm.appendChild(el('div','acc',look.accessory));
   var s=b.status||'none';nm.appendChild(el('span','st s-'+s,NOMES[s]||'sem status'));top.appendChild(nm);c.appendChild(top);
   if(b.step)c.appendChild(el('div','step',b.step));
   if(b.status_at)c.appendChild(el('small',null,ha(b.status_at)+' · '+quando(b.status_at)));
   if(b.routines&&b.routines.length){var ul=el('ul','rt');b.routines.forEach(function(r){var li=el('li');li.appendChild(el('span',null,r.name+' ('+r.schedule+')'));li.appendChild(el('small',null,r.next_run?'próx.: '+quando(r.next_run):'sem próxima'));ul.appendChild(li);});c.appendChild(ul);}
   if(typeof b.chat==='string'&&b.chat.indexOf(PREFIX)===0){var p=el('p');var a=el('a',null,'Abrir chat');a.href=b.chat;p.appendChild(a);c.appendChild(p);}
   g.appendChild(c);});
  f.appendChild(g);root.appendChild(f);});
}
function load(){fetch('/api/state',{credentials:'same-origin',cache:'no-store'}).then(function(r){if(r.status===401){location.href='/';return null;}return r.json();})
 .then(function(st){if(!st)return;render(st);document.getElementById('upd').textContent='atualizado às '+fmt.format(new Date())+' (Recife)';})
 .catch(function(){document.getElementById('upd').textContent='falha ao atualizar; tentando de novo em 30s';});}
load();setInterval(load,30000);
})();`;

export function panelPage(nonce: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Painel dos bots</title><style nonce="${nonce}">${STYLE}</style></head>
<body><header><div><h1>Painel dos bots</h1><small id="upd">carregando…</small></div>
<form method="post" action="/logout"><button type="submit">Sair</button></form></header>
<main id="app"></main><script nonce="${nonce}">${CLIENT}</script></body></html>`;
}
