// HTML do login e do painel. Nenhum dado de bot é embutido no HTML:
// o painel busca /api/state (protegido) e monta o DOM só com textContent
// e atributos SVG. Sem CDN nem dependências: tudo inline (SVG + CSS).
import { floorOrder } from "./floors.js";
import { frescor } from "./frescor.js";

const STYLE = String.raw`
:root{--bg:#e9ecf1;--card:#16181d;--card2:#1f2229;--line:#2b2f38;--txt:#f3f4f6;--mut:#9aa1ad;
--working:#22c55e;--waiting_user:#f59e0b;--error:#ef4444;--idle:#94a3b8;--done:#60a5fa;--none:#64748b}
*{box-sizing:border-box}html,body{height:100%}
body{margin:0;font:13px/1.35 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:radial-gradient(ellipse at 55% 45%,#f7f8fa 0,#e6e9ee 70%);color:var(--txt);overflow:hidden}
button,.btn{font:inherit;cursor:pointer;border:0;border-radius:10px;padding:7px 12px;background:#2a2e37;color:var(--txt);text-decoration:none;display:inline-block}
.btn.light{background:#fff;color:#111;font-weight:600}.btn.sm{padding:4px 9px;font-size:12px;border-radius:8px}
#cena{position:fixed;inset:0;width:100%;height:100%;display:block}
.card{background:var(--card);border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,.18);padding:12px 14px}
.card h3{margin:0;font-size:13px;font-weight:650;letter-spacing:.01em;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
.card h3 .chev{margin-left:auto;color:var(--mut);font-size:11px;transition:transform .15s}
.card.fechado h3 .chev{transform:rotate(-90deg)}.card.fechado .corpo{display:none}
.corpo{margin-top:10px}.badge{background:#2c303a;color:var(--txt);border-radius:999px;padding:0 7px;font-size:11px;font-weight:600}
.badge.amb{background:var(--waiting_user);color:#1a1300}.badge.ok{background:rgba(34,197,94,.16);color:#86efac}
.card.alerta{background:linear-gradient(180deg,#3b2a07 0,#1b1a17 55%,var(--card));box-shadow:0 0 0 1.5px var(--waiting_user),0 12px 32px rgba(245,158,11,.28)}
.card.alerta h3{color:#fcd34d}.espera .t2 b{color:#fbbf24;font-weight:600}.espera .item{padding:7px 0}
.ok-linha{display:flex;align-items:center;gap:6px;color:var(--mut);font-size:12px}.ok-linha i{width:16px;height:16px;border-radius:50%;background:rgba(34,197,94,.18);color:#4ade80;display:grid;place-items:center;font-style:normal;font-size:10px}
#topo{position:fixed;top:14px;left:16px;right:16px;display:flex;align-items:center;gap:12px;pointer-events:none;z-index:3}
#topo>*{pointer-events:auto}
.marca{background:var(--card);border-radius:999px;padding:8px 14px;display:flex;gap:8px;align-items:center;font-weight:600;box-shadow:0 6px 20px rgba(15,23,42,.18)}
.vivo{color:var(--mut);font-weight:500}.vivo i{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--working);margin:0 5px 1px 2px;box-shadow:0 0 0 3px rgba(34,197,94,.2);animation:pulsa 2s infinite}
@keyframes pulsa{50%{box-shadow:0 0 0 6px rgba(34,197,94,0)}}
.contas{margin:0 auto;background:var(--card);border-radius:999px;padding:5px;display:flex;gap:4px;box-shadow:0 6px 20px rgba(15,23,42,.18)}
.contas span{display:flex;align-items:center;gap:6px;color:var(--mut);padding:4px 11px;border-radius:999px;font-variant-numeric:tabular-nums}.contas b{color:var(--txt);font-size:14px}
.contas .on-working{background:rgba(34,197,94,.14);color:#86efac}
.contas .on-waiting_user{background:var(--waiting_user);color:#2a1b00;font-weight:600;animation:pulsaAmb 1.8s infinite}.contas .on-waiting_user b{color:#2a1b00}.contas .on-waiting_user .dot{background:#2a1b00!important}
.contas .on-error{background:var(--error);color:#fff;font-weight:600}.contas .on-error b{color:#fff}.contas .on-error .dot{background:#fff!important}
@keyframes pulsaAmb{0%{box-shadow:0 0 0 0 rgba(245,158,11,.55)}70%{box-shadow:0 0 0 9px rgba(245,158,11,0)}100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none}
.sair{background:var(--card);border-radius:999px;padding:8px 14px;box-shadow:0 6px 20px rgba(15,23,42,.18)}
#esq{position:fixed;top:66px;left:16px;width:236px;bottom:178px;display:flex;flex-direction:column;gap:10px;overflow:auto;scrollbar-width:none;z-index:2}
#esq::-webkit-scrollbar{display:none}
#ativ{position:fixed;left:16px;bottom:14px;width:320px;height:152px;z-index:2;display:flex;flex-direction:column}
#ativ .corpo{overflow:hidden;flex:1}
.andar{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;cursor:pointer;color:var(--mut)}
.andar:hover{background:var(--card2)}.andar.sel{background:#2a2e37;color:var(--txt)}
.andar .n{width:20px;height:20px;border-radius:6px;background:#2c303a;display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--txt);flex:none}
.andar.sel .n{background:#fff;color:#111}.andar .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.andar .ct{font-size:12px;min-width:16px;text-align:right;font-variant-numeric:tabular-nums}
.tag{font-size:10.5px;font-weight:700;border-radius:999px;padding:0 6px;line-height:16px;flex:none}.tag.w{background:var(--waiting_user);color:#2a1b00}.tag.e{background:var(--error);color:#fff}.tag.t{background:rgba(34,197,94,.16);color:#86efac}.pontos{display:flex;gap:2px;flex-wrap:wrap;max-width:60px;justify-content:flex-end}.pontos .dot{width:5px;height:5px}
.item{display:flex;gap:8px;align-items:center;padding:5px 0;border-top:1px solid var(--line)}.item:first-child{border-top:0;padding-top:0}
.item .tx{flex:1;min-width:0}.item .t1{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.item .t2{color:var(--mut);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.item .hr{color:var(--mut);font-size:11px;white-space:nowrap}.mini{width:24px;height:24px;flex:none;overflow:visible}
.vazio{color:var(--mut);font-size:12px}
.feed .item{padding:4px 0;border:0}.feed .hr{width:36px}
#dir{position:fixed;top:66px;right:16px;width:300px;z-index:2;display:flex;flex-direction:column;gap:10px;max-height:calc(100% - 80px);overflow:auto;scrollbar-width:none}
.sel-cab{border-radius:16px;padding:14px;color:#0b1a10;background:var(--working)}
.sel-cab .l1{display:flex;gap:10px;align-items:center}.sel-cab .nome{font-size:16px;font-weight:700;line-height:1.2}
.sel-cab .sub{font-size:12px;opacity:.75}.sel-cab .chip{display:inline-block;margin-top:10px;background:rgba(0,0,0,.14);border-radius:999px;padding:3px 10px;font-weight:600;font-size:12px}
.sel-cab .passo{margin-top:8px;font-size:14px;font-weight:600;word-break:break-word}
.fresco{margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px}.fresco>span:first-child{opacity:.8}
.selo-velho{display:inline-block;background:rgba(0,0,0,.72);color:#fcd34d;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:700;white-space:nowrap}
.item .t3{display:flex;align-items:center;gap:6px;margin-top:3px}.espera .selo-velho{background:rgba(245,158,11,.16);color:#fcd34d;box-shadow:inset 0 0 0 1px rgba(245,158,11,.55)}
.sel-cab .resolver{margin-top:10px;width:100%;background:#1a1300;color:#fcd34d;font-weight:700}.sel-cab .resolver:hover{background:#000}.sel-cab .resolver.conf{background:#fff;color:#111}.sel-cab .resolver:disabled{opacity:.6;cursor:default}
.sel-cab.s-error,.sel-cab.s-none,.sel-cab.s-idle,.sel-cab.s-done{color:#fff}.fechar{margin-left:auto;align-self:flex-start;background:rgba(0,0,0,.12);color:inherit;border-radius:8px;padding:2px 8px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}
.stats div{background:var(--card2);border-radius:10px;padding:8px}.stats b{display:block;font-size:16px}.stats small{color:var(--mut);font-size:11px}
.passos .item{align-items:flex-start}.passos .dot{margin-top:5px}
.bar{height:7px;background:#2c303a;border-radius:4px;overflow:hidden;margin:6px 0}.bar>i{display:block;height:100%;background:var(--working)}
.bar.hi>i{background:var(--waiting_user)}.bar.max>i{background:var(--error)}
.cheio{width:100%;text-align:center;margin-top:10px}
.bot-g{cursor:pointer}.cam,.mov{transform-box:view-box}.mov{will-change:transform,opacity}
.respira{transform-box:fill-box;transform-origin:50% 100%;animation:respira 3.2s ease-in-out infinite}@keyframes respira{0%,100%{transform:scale(1,1)}50%{transform:scale(1.035,.965)}}
.hov{transform-box:fill-box;transform-origin:50% 100%;transition:transform .2s ease-out}.bot-g:hover .hov{transform:scale(1.07)}
.balao{transition:transform .2s ease-out,opacity .4s}.zoom .balao:not(.foco){opacity:.22}.balao.sobe{transform:translateY(-4px)}.bot-g.working .corpo-bot{animation:digita .36s ease-in-out infinite alternate}
@keyframes digita{to{transform:translateY(-0.05px)}}
.bot-g.idle .corpo-bot,.bot-g.done .corpo-bot,.bot-g.none .corpo-bot{filter:saturate(.5);opacity:.8}
.bot-g.waiting_user .corpo-bot{animation:espera 2.4s ease-in-out infinite}@keyframes espera{50%{transform:translateY(-0.08px)}}
.anel{transform-box:fill-box;transform-origin:center;animation:anel 1.8s ease-out infinite}
@keyframes anel{0%{transform:scale(.55);opacity:.95}100%{transform:scale(1.55);opacity:0}}
.brilho{animation:brilho 1.4s ease-in-out infinite alternate}@keyframes brilho{from{opacity:.55}to{opacity:1}}
.tela{animation:tela .9s steps(2) infinite}@keyframes tela{50%{opacity:.7}}
.balao{cursor:pointer}.balao text{font:600 11px Inter,system-ui,sans-serif}.balao text.l2{font:500 10px Inter,system-ui,sans-serif}
.balao.idle,.balao.done,.balao.none{opacity:.82}
.pulo{transform-box:fill-box;transform-origin:center bottom;animation:pulo 1.1s ease-in-out infinite}@keyframes pulo{50%{transform:translateY(-3px) scale(1.1)}}
.halo{animation:halo 1.8s ease-in-out infinite}@keyframes halo{50%{opacity:.15}}
.dig circle{animation:pisca 1.2s infinite}.dig circle:nth-child(2){animation-delay:.2s}.dig circle:nth-child(3){animation-delay:.4s}
@keyframes pisca{0%,80%,100%{opacity:.25}40%{opacity:1}}
.passante{pointer-events:none}.passante text{font:600 11px Inter,system-ui,sans-serif}.passante text.l2{font:500 10px Inter,system-ui,sans-serif}
.bot-g.recebe .hov{animation:recebe .55s ease-in-out 3}@keyframes recebe{50%{transform:translateY(-0.12px) scale(1.05)}}
.sel-cab.s-waiting_user{box-shadow:0 0 0 2px #fcd34d,0 12px 32px rgba(245,158,11,.35)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
@media (prefers-reduced-motion:reduce){.bot-g:hover .hov,.balao.sobe{transform:none}}
@media (max-height:860px){#ativ{height:124px}#esq{bottom:150px}.espera .item{padding:4px 0}}
@media (min-width:1700px){body{font-size:14px}#esq{width:270px}#dir{width:330px}#ativ{width:350px;height:166px}#esq{bottom:194px}.contas b{font-size:15px}}
.login-wrap{min-height:100%;display:grid;place-items:center;padding:20px}
.login{width:100%;max-width:360px;background:var(--card);border-radius:16px;padding:22px;box-shadow:0 10px 30px rgba(15,23,42,.2)}
.login h1{margin:0 0 4px;font-size:18px}.login p{color:var(--mut);margin:0 0 10px}
.login input{width:100%;padding:10px;margin:6px 0 12px;border-radius:10px;border:1px solid var(--line);background:#0f1115;color:var(--txt)}
.erro{color:var(--error)!important}
@media (max-width:900px){body{overflow:auto}#cena{position:relative;height:60vh}#esq,#dir,#ativ{position:static;width:auto;margin:10px;max-height:none}#topo{position:static;flex-wrap:wrap;margin:10px;width:auto}.contas{margin:0}}`;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function loginPage(nonce: string, erro?: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Painel dos bots — entrar</title><style nonce="${nonce}">${STYLE}</style></head>
<body><div class="login-wrap"><form class="login" method="post" action="/login"><h1>Painel dos bots</h1>
<p>Digite a chave de acesso.</p>${erro ? `<p class="erro">${esc(erro)}</p>` : ""}
<input type="password" name="chave" autocomplete="current-password" required autofocus aria-label="Chave">
<button type="submit" class="btn light">Entrar</button></form></div></body></html>`;
}

const CLIENT = String.raw`
(function(){
var TZ='America/Recife',SEM='Sem time',PREFIX='grokbot://app/v1/agent?id=',NS='http://www.w3.org/2000/svg';
var NOME_ST={working:'Trabalhando',idle:'Descansando',waiting_user:'Esperando por mim',error:'Erro',done:'Concluído',none:'Sem status'};
var VERBO={working:'começou',idle:'parou',waiting_user:'pediu você',error:'deu erro',done:'concluiu'};
var CAB_ST={working:'linear-gradient(135deg,#16a34a,#22c55e)',waiting_user:'linear-gradient(135deg,#d97706,#f59e0b)',error:'linear-gradient(135deg,#b91c1c,#ef4444)',done:'linear-gradient(135deg,#2563eb,#60a5fa)',idle:'linear-gradient(135deg,#334155,#475569)',none:'linear-gradient(135deg,#334155,#475569)'};
var COR_ST={working:'#22c55e',idle:'#94a3b8',waiting_user:'#f59e0b',error:'#ef4444',done:'#60a5fa',none:'#64748b'};
var CORES={violet:'#8b5cf6',blue:'#3b82f6',cyan:'#06b6d4',green:'#22c55e',orange:'#f97316',red:'#ef4444',black:'#2b2b33',gray:'#9ca3af',grey:'#9ca3af'};
var st=null,andarSel=null,botSel=null,fechados={},uid=0,geo=null;
// transições: troca de andar (1,5 s) e zoom no bot (1 s); com movimento reduzido, só esmaecimento
var RM=window.matchMedia('(prefers-reduced-motion: reduce)'),zoom=null,cam0={s:1,x:0,y:0},animCam=false,transAndar=0,ocupado=0,ultSel='';
function tf(c){return 'translate('+c.x.toFixed(1)+'px,'+c.y.toFixed(1)+'px) scale('+c.s.toFixed(3)+')';}
function irAndar(nome,bs){var ns=times().map(function(t){return t.nome;}),de=ns.indexOf(andarSel),pa=ns.indexOf(nome);
 if(pa!==de&&de>=0)transAndar=pa>de?1:-1;andarSel=nome;botSel=bs||null;zoom=null;cam0={s:1,x:0,y:0};desenhar();}
function focar(nome){botSel=nome;if(!RM.matches&&zoom!==nome){zoom=nome;animCam=true;}desenhar();}
function soltar(){if(zoom){zoom=null;animCam=true;desenhar();}}
var fHora=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit'});
var fData=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=String(txt);return e;}
function sv(t,a,p){var e=document.createElementNS(NS,t);if(a)for(var k in a)e.setAttribute(k,String(a[k]));if(p)p.appendChild(e);return e;}
function hora(iso){var d=new Date(iso);return isNaN(d)?'':fHora.format(d);}
function ha(iso){if(!iso)return '';var s=Math.round((Date.now()-new Date(iso))/1000);if(s<0)s=0;
 if(s<60)return 'agora';var m=Math.round(s/60);if(m<60)return 'há '+m+' min';var h=Math.round(m/60);if(h<48)return 'há '+h+' h';return 'há '+Math.round(h/24)+' dias';}
function dur(iso){if(!iso)return '';var m=Math.max(0,Math.round((Date.now()-new Date(iso))/60000));if(m<60)return m+' min';var h=Math.floor(m/60);if(h<48)return h+' h '+(m%60)+' min';return Math.round(h/24)+' dias';}
function em(iso){if(!iso)return 'sem próxima';var m=Math.round((new Date(iso)-Date.now())/60000);if(isNaN(m))return '';if(m<=0)return 'agora';
 if(m<60)return 'em '+m+' min';var h=Math.floor(m/60);if(h<24)return 'em '+h+' h'+(m%60?' '+(m%60)+' min':'');return fData.format(new Date(iso));}
function selo(){var s=el('span','selo-velho','pode estar desatualizado');s.title='Esperando há mais de 30 min sem nova atualização de status. Confira no chat do bot.';return s;}
function trunc(s,n){s=String(s);return s.length>n?s.slice(0,n-1)+'…':s;}
// ---- cores ----
function hex(c){c=String(c||'').toLowerCase();if(CORES[c])return CORES[c];if(/^#[0-9a-f]{6}$/.test(c))return c;
 if(/^#[0-9a-f]{3}$/.test(c))return '#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3];return CORES.violet;}
function mix(h,t,a){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);
 var x=t?255:0;function f(v){return Math.round(v+(x-v)*a).toString(16).padStart(2,'0');}return '#'+f(r)+f(g)+f(b);}
// ---- formas do app (viewBox 0 0 100 100) ----
function star(cx,cy,R,r){var p=[];for(var i=0;i<10;i++){var a=-Math.PI/2+i*Math.PI/5,q=i%2?r:R;p.push((cx+q*Math.cos(a)).toFixed(1)+','+(cy+q*Math.sin(a)).toFixed(1));}return p.join(' ');}
function formas(s){
 var R=function(x,y,w,h,rx){return ['rect',{x:x,y:y,width:w,height:h,rx:rx}];};
 var P=function(pts,w){return ['polygon',{points:pts,'stroke-width':w||10,'stroke-linejoin':'round',st:1}];};
 var C=function(x,y,r){return ['circle',{cx:x,cy:y,r:r}];};
 switch(s){
  case 'squircle':return [['path',{d:'M50 6C86 6 94 14 94 50C94 86 86 94 50 94C14 94 6 86 6 50C6 14 14 6 50 6Z'}]];
  case 'tablet':return [R(17,4,66,92,20)];
  case 'pill':return [R(21,4,58,92,29)];
  case 'pebble':return [['path',{d:'M47 20C79 17 97 36 96 59C95 83 76 94 50 94C22 94 3 83 4 59C5 37 19 22 47 20Z'}]];
  case 'hex':case 'hexagon':return [P('50,9 89,31 89,71 50,93 11,71 11,31',12)];
  case 'star':return [P(star(50,55,47,24),10)];
  case 'flower':var f=[C(50,52,27)];for(var i=0;i<6;i++){var a=i*Math.PI/3-Math.PI/2;f.push(C(50+27*Math.cos(a),52+27*Math.sin(a),19));}return f;
  case 'house':return [P('50,8 91,43 91,92 9,92 9,43',12)];
  case 'cloud':return [C(31,60,23),C(55,44,28),C(75,62,20),R(9,58,82,36,18)];
  case 'circle':return [C(50,50,45)];
  case 'square':return [R(6,6,88,88,8)];
  case 'rounded':return [R(6,6,88,88,24)];
  case 'triangle':return [P('50,10 92,90 8,90',10)];
  case 'diamond':return [P('50,6 94,50 50,94 6,50',10)];
  default:return [['path',{d:'M50 5C78 4 95 25 94 52C93 79 75 95 49 95C23 95 5 78 6 51C7 24 23 6 50 5Z'}]];
 }}
var OLHO_Y={pebble:56,house:60,cloud:62,flower:50,star:56,triangle:62,tablet:40,pill:40};
function boneco(nome,b,px){
 var look=(b&&b.look)||{},forma=look.shape||'blob',cor=hex(look.color||'violet'),id='b'+(++uid);
 var s=sv('svg',{viewBox:'-8 -14 116 116',width:px,height:px,overflow:'visible'});
 var defs=sv('defs',null,s);
 var g=sv('radialGradient',{id:'g'+id,gradientUnits:'userSpaceOnUse',cx:34,cy:26,r:86},defs);
 sv('stop',{offset:0,'stop-color':mix(cor,1,.45)},g);sv('stop',{offset:.45,'stop-color':cor},g);sv('stop',{offset:1,'stop-color':mix(cor,0,.35)},g);
 var fs=formas(forma),foto=st&&st.avatars&&st.avatars[nome];
 function desenha(par,fill){fs.forEach(function(f){var a={};for(var k in f[1])if(k!=='st')a[k]=f[1][k];a.fill=fill;if(f[1].st)a.stroke=fill;sv(f[0],a,par);});}
 if(foto){
  var cp=sv('clipPath',{id:'c'+id},defs);fs.forEach(function(f){var a={};for(var k in f[1])if(k!=='st')a[k]=f[1][k];if(f[1].st){a.stroke='#000';}sv(f[0],a,cp);});
  desenha(s,cor);
  var im=sv('image',{x:-6,y:-6,width:112,height:112,preserveAspectRatio:'xMidYMid slice','clip-path':'url(#c'+id+')'},s);
  im.setAttribute('href','/avatar/'+encodeURIComponent(nome)+'?v='+encodeURIComponent(foto));
  var hl=sv('radialGradient',{id:'h'+id,gradientUnits:'userSpaceOnUse',cx:32,cy:22,r:70},defs);
  sv('stop',{offset:0,'stop-color':'#fff','stop-opacity':.45},hl);sv('stop',{offset:.5,'stop-color':'#fff','stop-opacity':0},hl);
  var o=sv('g',{'clip-path':'url(#c'+id+')'},s);sv('rect',{x:0,y:0,width:100,height:100,fill:'url(#h'+id+')'},o);
 }else{
  desenha(s,'url(#g'+id+')');
  sv('ellipse',{cx:33,cy:24,rx:13,ry:7,fill:'#fff','fill-opacity':.35,transform:'rotate(-25 33 24)'},s);
  var ey=OLHO_Y[forma]||44,dk=cor==='#2b2b33'?'#0b0b0f':'#1b1530';
  [38,62].forEach(function(x){sv('ellipse',{cx:x,cy:ey,rx:8.5,ry:10.5,fill:'#fff'},s);sv('circle',{cx:x+1.5,cy:ey+2.5,r:4.6,fill:dk},s);sv('circle',{cx:x+3,cy:ey,r:1.5,fill:'#fff'},s);});
 }
 var ac=look.accessory;
 if(ac==='antenna'){sv('line',{x1:50,y1:7,x2:50,y2:-6,stroke:mix(cor,0,.3),'stroke-width':3},s);sv('circle',{cx:50,cy:-8,r:5,fill:'#facc15'},s);}
 else if(ac==='glasses'){var ey2=(OLHO_Y[forma]||44);[38,62].forEach(function(x){sv('circle',{cx:x,cy:ey2,r:12,fill:'none',stroke:'#111','stroke-width':3},s);});sv('line',{x1:50,y1:ey2,x2:50,y2:ey2,stroke:'#111'},s);}
 else if(ac==='bow'){sv('polygon',{points:'50,10 34,0 34,20',fill:'#f43f5e'},s);sv('polygon',{points:'50,10 66,0 66,20',fill:'#f43f5e'},s);sv('circle',{cx:50,cy:10,r:4,fill:'#be123c'},s);}
 else if(ac==='stem'||ac==='leaf'){sv('path',{d:'M50 8C50 0 54 -6 60 -8C60 -2 56 4 50 8Z',fill:'#16a34a'},s);}
 else if(ac==='hat'){sv('rect',{x:30,y:-6,width:40,height:14,rx:3,fill:'#111'},s);sv('rect',{x:22,y:6,width:56,height:5,rx:2,fill:'#111'},s);}
 return s;}
// ---- dados ----
function lista(){var bots=st.bots||{};return (st.roster?st.roster.slice():Object.keys(bots));}
function bot(n){return (st.bots||{})[n]||{};}
function stt(n){return bot(n).status||'none';}
function times(){var t={};lista().forEach(function(n){var k=bot(n).team||SEM;(t[k]=t[k]||[]).push(n);});
 var ordem=floorOrder(Object.keys(t),st.floors);return ordem.map(function(k){return {nome:k,bots:t[k].sort(function(a,b){return a.localeCompare(b,'pt-BR');})};});}
function chatOk(n){var c=bot(n).chat;return typeof c==='string'&&c.indexOf(PREFIX)===0?c:null;}
function linkChat(n,cls){var c=chatOk(n);if(!c)return null;var a=el('a','btn '+(cls||'sm'),'Abrir chat');a.href=c;a.addEventListener('click',function(e){e.stopPropagation();});return a;}
// ---- cena isométrica ----
var CX=0.866,SY=0.5,UZ=0.9;
function P(x,y,z){return [(x-y)*CX,(x+y)*SY-(z||0)*UZ];}
function pts(a){return a.map(function(p){var q=P(p[0],p[1],p[2]);return q[0].toFixed(3)+','+q[1].toFixed(3);}).join(' ');}
function quad(par,a,fill,extra){var o={points:pts(a),fill:fill};if(extra)for(var k in extra)o[k]=extra[k];return sv('polygon',o,par);}
function caixa(par,x0,y0,z0,x1,y1,z1,ct,cy,cx){
 quad(par,[[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],cy);
 quad(par,[[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],cx);
 quad(par,[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],ct);}
function banco(par,x,y,h){var c=P(x,y,h),b=P(x,y,0),rx=0.36*1.2,ry=0.36*0.62;
 sv('ellipse',{cx:b[0],cy:b[1],rx:rx*1.05,ry:ry*1.05,fill:'#000','fill-opacity':.06},par);
 sv('rect',{x:b[0]-0.05,y:c[1],width:0.1,height:b[1]-c[1],fill:'#cbd0d8'},par);
 sv('ellipse',{cx:c[0],cy:c[1]+0.07,rx:rx,ry:ry,fill:'#dfe3e9'},par);
 sv('ellipse',{cx:c[0],cy:c[1],rx:rx,ry:ry,fill:'#ffffff',stroke:'#e3e6eb','stroke-width':0.02},par);}
function planta(par,x,y){caixa(par,x-0.3,y-0.3,0,x+0.3,y+0.3,0.55,'#e5e7eb','#d1d5db','#bfc5ce');
 var c=P(x,y,0.55),fo=[[-0.35,-0.9,0.28,0.55,-20],[0.3,-0.85,0.26,0.5,25],[0,-1.2,0.25,0.6,0],[-0.5,-0.45,0.3,0.4,-50],[0.45,-0.4,0.3,0.4,50]];
 fo.forEach(function(f,i){sv('ellipse',{cx:c[0]+f[0],cy:c[1]+f[1],rx:f[2],ry:f[3],fill:i%2?'#22a356':'#34c26b',transform:'rotate('+f[4]+' '+(c[0]+f[0])+' '+(c[1]+f[1])+')'},par);});}
var COR_LAP={working:'#4ade80',waiting_user:'#fbbf24',error:'#f87171'};
function laptop(par,x,y,s){var z=1.05,on=s==='working';
 if(on){var sp=P(x,y-0.32,z+0.3);sv('ellipse',{cx:sp[0],cy:sp[1],rx:0.62,ry:0.42,fill:'url(#glT)',class:'brilho'},par);}
 quad(par,[[x-0.32,y-0.05,z],[x+0.32,y-0.05,z],[x+0.32,y+0.38,z],[x-0.32,y+0.38,z]],'#a7adb7');
 quad(par,[[x-0.32,y-0.05,z],[x+0.32,y-0.05,z],[x+0.32,y-0.05,z+0.42],[x-0.32,y-0.05,z+0.42]],on?'#2b3340':'#3d4350');
 if(on)sv('polyline',{points:pts([[x-0.32,y-0.05,z+0.42],[x+0.32,y-0.05,z+0.42]]),stroke:'#86efac','stroke-width':0.035,fill:'none',class:'brilho'},par);
 var c=P(x,y-0.05,z+0.24);sv('circle',{cx:c[0],cy:c[1],r:on?0.07:0.05,fill:COR_LAP[s]||'#6b7280',class:on?'tela':''},par);}
function sofa(par,x,y){var b=P(x+0.6,y+1.1,0);sv('ellipse',{cx:b[0],cy:b[1]+0.1,rx:1.8,ry:0.9,fill:'#0f172a','fill-opacity':.1,filter:'url(#blur)'},par);
 caixa(par,x,y,0,x+1.2,y+0.28,0.75,'#ffffff','#eef0f3','#e2e5ea');caixa(par,x,y+0.28,0,x+0.95,y+1.92,0.45,'#ffffff','#eef0f3','#e5e8ec');
 caixa(par,x+0.95,y+0.28,0,x+1.2,y+1.92,0.95,'#ffffff','#eef0f3','#e2e5ea');caixa(par,x,y+1.92,0,x+1.2,y+2.2,0.75,'#ffffff','#eef0f3','#e2e5ea');}
function poltrona(par,x,y){var b=P(x+0.45,y+0.45,0);sv('ellipse',{cx:b[0],cy:b[1]+0.1,rx:0.9,ry:0.45,fill:'#0f172a','fill-opacity':.14,filter:'url(#blur)'},par);
 caixa(par,x,y,0,x+0.85,y+0.85,0.42,'#3a3f4a','#2b2f38','#23272f');caixa(par,x,y,0,x+0.85,y+0.18,0.8,'#3a3f4a','#2b2f38','#23272f');
 caixa(par,x,y+0.18,0,x+0.18,y+0.85,0.62,'#3a3f4a','#2b2f38','#23272f');caixa(par,x+0.67,y+0.18,0,x+0.85,y+0.85,0.62,'#3a3f4a','#2b2f38','#23272f');}
function grad(defs,id,cor,a){var r=sv('radialGradient',{id:id},defs);sv('stop',{offset:0,'stop-color':cor,'stop-opacity':a},r);sv('stop',{offset:1,'stop-color':cor,'stop-opacity':0},r);}
function lin(defs,id,c1,c2,x2,y2){var r=sv('linearGradient',{id:id,x1:0,y1:0,x2:x2,y2:y2},defs);sv('stop',{offset:0,'stop-color':c1},r);sv('stop',{offset:1,'stop-color':c2},r);}
function cena(lista){
 var svg=document.getElementById('cena'),velho=transAndar&&!RM.matches?svg.querySelector('.cam'):null;svg.replaceChildren();
 var W=svg.clientWidth||window.innerWidth,H=svg.clientHeight||window.innerHeight;
 var defs=sv('defs',null,svg);
 grad(defs,'glT','#4ade80',.75);grad(defs,'glworking','#22c55e',.5);grad(defs,'glwaiting_user','#f59e0b',.75);grad(defs,'glerror','#ef4444',.7);grad(defs,'glL','#fef3c7',.55);
 lin(defs,'piso','#fbfbfc','#e9ecf0',1,1);lin(defs,'parE','#e4e7eb','#f2f4f6',0,1);lin(defs,'parF','#f8f9fa','#eceef1',1,0);
 var f=sv('filter',{id:'blur',x:'-50%',y:'-50%',width:'200%',height:'200%'},defs);sv('feGaussianBlur',{stdDeviation:0.09},f);
 var n=lista.length,LUG=6,GAP=1.8,TW=1.35,L=LUG*GAP+0.5;
 var nm=Math.max(2,Math.ceil(n/LUG)),cols=nm>=5?2:1,rows=Math.ceil(nm/cols);
 var MX=2.3,MY=2.3,RG=3.7,CG=1.8;
 var RW=MX+cols*L+(cols-1)*CG+1.6,RD=MY+rows*RG+0.6;
 // enquadra no espaço livre entre os painéis
 var E=document.getElementById('esq').getBoundingClientRect(),D=document.getElementById('dir').getBoundingClientRect();
 var wide=W>900,fl=wide?E.right-50:10,fr=wide?D.left-10:W-10,ft=wide?40:10,fb=H+10;
 var cs=[P(0,0,3.3),P(RW,0,3.3),P(0,RD,-0.3),P(RW,RD,-0.3),P(0,RD,3.3),P(RW,0,-0.3)];
 var minx=Math.min.apply(null,cs.map(function(c){return c[0];})),maxx=Math.max.apply(null,cs.map(function(c){return c[0];}));
 var miny=Math.min.apply(null,cs.map(function(c){return c[1];})),maxy=Math.max.apply(null,cs.map(function(c){return c[1];}));
 var k=Math.min((fr-fl)/(maxx-minx),(fb-ft)/(maxy-miny+0.6))*1.06;
 var ox=fl+((fr-fl)-(maxx-minx)*k)/2-minx*k,oy=ft+((fb-ft)-(maxy-miny)*k)/2-miny*k+0.4*k;
 var T='translate('+ox.toFixed(1)+' '+oy.toFixed(1)+') scale('+k.toFixed(3)+')',cam=sv('g',{class:'cam'},svg);
 // sombra do prédio no chão (fica parada na troca de andar)
 var sb=P(RW*0.55,RD+0.6,-1.7);sv('ellipse',{cx:sb[0],cy:sb[1],rx:(RW+RD)*0.55,ry:(RW+RD)*0.13,fill:'#0f172a','fill-opacity':.1,filter:'url(#blur)',transform:T,class:'sombra'},cam);
 var mov=sv('g',{class:'mov'},cam),g=sv('g',{transform:T},mov),alvo=null,bm={};
 // prédio (andar de baixo) e laje
 caixa(g,0.25,0.25,-1.7,RW-0.25,RD-0.25,-0.32,'#cfd4db','#3a4250','#2c3340');
 for(var wx=0.8;wx<RW-0.4;wx+=1.3)quad(g,[[wx,RD-0.25,-1.5],[wx+0.9,RD-0.25,-1.5],[wx+0.9,RD-0.25,-0.55],[wx,RD-0.25,-0.55]],'#556274',{'fill-opacity':.8});
 for(var wy=0.8;wy<RD-0.4;wy+=1.3)quad(g,[[RW-0.25,wy,-1.5],[RW-0.25,wy+0.9,-1.5],[RW-0.25,wy+0.9,-0.55],[RW-0.25,wy,-0.55]],'#465264',{'fill-opacity':.8});
 caixa(g,0,0,-0.32,RW,RD,0,'url(#piso)','#dfe2e7','#cfd3da');
 for(var i=2;i<RW;i+=2)sv('polyline',{points:pts([[i,0,0],[i,RD,0]]),stroke:'#e6e9ed','stroke-width':0.03,fill:'none'},g);
 for(var j=2;j<RD;j+=2)sv('polyline',{points:pts([[0,j,0],[RW,j,0]]),stroke:'#e6e9ed','stroke-width':0.03,fill:'none'},g);
 // paredes do fundo
 caixa(g,-0.25,-0.25,0,0,RD,3.3,'#dfe3e8','url(#parE)','#f1f3f5');
 caixa(g,0,-0.25,0,RW,0,3.3,'#dfe3e8','url(#parF)','#eceef1');
 // sombra de contato parede/chão
 quad(g,[[0,0,0],[RW,0,0],[RW,0.45,0],[0.45,0.45,0],[0.45,RD,0],[0,RD,0]],'#0f172a',{'fill-opacity':.045});
 for(var x=1.6;x<RW-1.4;x+=2.4){
  // luz da janela no chão
  quad(g,[[x+0.1,0,0],[x+1.8,0,0],[x+3.0,2.6,0],[x+1.3,2.6,0]],'#ffffff',{'fill-opacity':.55});
  quad(g,[[x,0,1.0],[x+1.9,0,1.0],[x+1.9,0,2.85],[x,0,2.85]],'#ffffff');
  quad(g,[[x+0.08,0,1.08],[x+1.82,0,1.08],[x+1.82,0,2.77],[x+0.08,0,2.77]],'#cfe6f7');
  quad(g,[[x+0.08,0,2.2],[x+1.82,0,2.77],[x+1.82,0,2.77],[x+0.08,0,2.77]],'#e4f2fb');
  quad(g,[[x+0.93,0,1.08],[x+0.97,0,1.08],[x+0.97,0,2.77],[x+0.93,0,2.77]],'#ffffff');
  quad(g,[[x,0,0.98],[x+1.9,0,0.98],[x+1.9,0.12,0.98],[x,0.12,0.98]],'#e5e8ec');}
 // quadro branco e TV na parede da esquerda
 var qy=1.4;quad(g,[[0,qy,1.05],[0,qy+3.2,1.05],[0,qy+3.2,2.55],[0,qy,2.55]],'#ffffff',{stroke:'#c9ced6','stroke-width':0.04});
 [['#fde68a',0.4,2.25],['#bfdbfe',0.85,2.25],['#fecaca',1.3,2.25],['#bbf7d0',0.4,1.85],['#fde68a',0.85,1.85]].forEach(function(p){quad(g,[[0,qy+p[1],p[2]-0.3],[0,qy+p[1]+0.36,p[2]-0.3],[0,qy+p[1]+0.36,p[2]],[0,qy+p[1],p[2]]],p[0]);});
 [[1.9,2.3,2.8],[1.9,2.0,2.6],[1.9,1.7,3.0]].forEach(function(l){sv('polyline',{points:pts([[0,qy+l[0],l[1]],[0,qy+l[2],l[1]]]),stroke:'#94a3b8','stroke-width':0.05,'stroke-linecap':'round',fill:'none'},g);});
 var ty0=qy+4.1;if(ty0+2.6<RD-0.5){quad(g,[[0,ty0,1.25],[0,ty0+2.6,1.25],[0,ty0+2.6,2.65],[0,ty0,2.65]],'#1f2430');
  quad(g,[[0,ty0+0.1,1.33],[0,ty0+2.5,1.33],[0,ty0+2.5,2.57],[0,ty0+0.1,2.57]],'#1e293b');
  var nW=0,nA=0;lista.forEach(function(nn){var ss=stt(nn);if(ss==='working')nW++;if(ss==='waiting_user')nA++;});
  [[0.3,2.3,0.4+1.8*nW/Math.max(1,lista.length),'#34d399'],[0.3,2.05,0.4+1.8*nA/Math.max(1,lista.length),'#fbbf24'],[0.3,1.8,0.7,'#60a5fa']].forEach(function(b){quad(g,[[0,ty0+b[0],b[1]],[0,ty0+b[0]+b[2],b[1]],[0,ty0+b[0]+b[2],b[1]-0.12],[0,ty0+b[0],b[1]-0.12]],b[3]);});
  for(var bi=0;bi<6;bi++){var hh=0.15+0.45*((bi*37)%7)/7;quad(g,[[0,ty0+1.4+bi*0.17,1.5],[0,ty0+1.52+bi*0.17,1.5],[0,ty0+1.52+bi*0.17,1.5+hh],[0,ty0+1.4+bi*0.17,1.5+hh]],'#a78bfa');}}
 planta(g,0.9,0.9);planta(g,RW-0.9,0.9);
 // elevador na parede da esquerda, entre o quadro e a TV (por onde entra/sai quem vem de outro andar)
 var ey0=qy+3.28,ey1=qy+4.02,eg=sv('g',{class:'elevador'},g);
 quad(eg,[[0,ey0,0],[0.75,ey0,0],[0.75,ey1,0],[0,ey1,0]],'#dfe3e9');
 quad(eg,[[0,ey0-0.06,0],[0,ey1+0.06,0],[0,ey1+0.06,2.3],[0,ey0-0.06,2.3]],'#6b7686');
 quad(eg,[[0,ey0,0],[0,(ey0+ey1)/2,0],[0,(ey0+ey1)/2,2.1],[0,ey0,2.1]],'#c9d0da');
 quad(eg,[[0,(ey0+ey1)/2,0],[0,ey1,0],[0,ey1,2.1],[0,(ey0+ey1)/2,2.1]],'#bcc4cf');
 sv('polyline',{points:pts([[0,(ey0+ey1)/2,0],[0,(ey0+ey1)/2,2.1]]),stroke:'#8b95a5','stroke-width':0.03,fill:'none'},eg);
 var el1=P(0,(ey0+ey1)/2,2.2);sv('circle',{cx:el1[0],cy:el1[1],r:0.07,fill:passAt&&passAt.modo!=='mesmo'?'#22c55e':'#cbd5e1'},eg);
 // mesas
 var lugares=[],mesas=[];
 for(var m=0;m<nm;m++){var r=Math.floor(m/cols),c=m%cols;mesas.push({x:MX-0.6+c*(L+CG),y:MY+r*RG});}
 mesas.forEach(function(t,mi){for(var s=0;s<LUG;s++)lugares.push({mesa:mi,x:t.x+0.25+GAP*(s+0.5),y:t.y-0.72});});
 var mapa={};lista.forEach(function(nome,i){mapa[i]=nome;});
 var desenhaveis=[];var bals=[],lug={},bgs={};
 mesas.forEach(function(t,mi){
  var tg=sv('g',null,null);
  // sombra da mesa
  quad(tg,[[t.x+0.2,t.y+0.25,0],[t.x+L+0.35,t.y+0.25,0],[t.x+L+0.35,t.y+TW+0.45,0],[t.x+0.2,t.y+TW+0.45,0]],'#0f172a',{'fill-opacity':.07,filter:'url(#blur)'});
  lugares.forEach(function(l,li){if(l.mesa!==mi)return;var nome=mapa[li];if(nome!==undefined)lug[nome]={x:l.x,y:l.y};
   var s=nome!==undefined?stt(nome):'',fp=P(l.x,l.y,0);
   if(s==='working')sv('ellipse',{cx:fp[0],cy:fp[1],rx:0.85,ry:0.45,fill:'url(#glworking)'},tg);
   if(s==='waiting_user'||s==='error'){sv('ellipse',{cx:fp[0],cy:fp[1],rx:0.85,ry:0.45,fill:'url(#gl'+s+')'},tg);
    sv('ellipse',{cx:fp[0],cy:fp[1],rx:0.7,ry:0.36,fill:'none',stroke:COR_ST[s],'stroke-width':0.07,class:'anel'},tg);}
   if(nome!==undefined)sv('ellipse',{cx:fp[0],cy:fp[1]+0.03,rx:0.45,ry:0.22,fill:'#0f172a','fill-opacity':.16,filter:'url(#blur)'},tg);
   banco(tg,l.x,l.y,0.55);
   if(nome!==undefined){var b=bot(nome),tam=1.42,base=P(l.x,l.y,0.55);
    var bg=sv('g',{class:'bot-g '+s},tg);bgs[nome]=bg;bg.addEventListener('click',function(ev){ev.stopPropagation();focar(nome);});
    bg.addEventListener('mouseenter',function(){if(bm[nome])bm[nome].classList.add('sobe');});bg.addEventListener('mouseleave',function(){if(bm[nome])bm[nome].classList.remove('sobe');});
    if(s==='working'||s==='waiting_user'||s==='error'){var mc=P(l.x,l.y,0.55+tam*0.5);sv('ellipse',{cx:mc[0],cy:mc[1],rx:tam*0.72,ry:tam*0.72,fill:'url(#gl'+s+')',class:'brilho'},bg);}
    sv('ellipse',{cx:base[0],cy:base[1]+0.02,rx:0.42,ry:0.17,fill:'#0f172a','fill-opacity':.18,filter:'url(#blur)'},bg);
    var corpo=sv('g',{class:'corpo-bot'},sv('g',{class:'hov'},bg)),rs=sv('g',{class:'respira'},corpo),hs=0;
    for(var hi=0;hi<nome.length;hi++)hs=(hs*31+nome.charCodeAt(hi))%997;rs.style.animationDelay=(-((hs/97+Date.now()/1000)%3.2)).toFixed(2)+'s';
    if(nome===zoom)alvo=[ox+base[0]*k,oy+(base[1]-tam*0.5)*k];
    var fig=boneco(nome,b,tam);fig.setAttribute('x',(base[0]-tam/2).toFixed(3));fig.setAttribute('y',(base[1]-tam*0.98).toFixed(3));rs.appendChild(fig);
    if(nome===botSel){sv('ellipse',{cx:fp[0],cy:fp[1],rx:0.7,ry:0.35,fill:'none',stroke:'#111827','stroke-width':0.05,'stroke-dasharray':'0.14 0.09'},tg);}
    var topo=P(l.x,l.y,0.55+tam*0.96);bals.push({nome:nome,s:s,at:b.status_at,step:b.step,x:ox+topo[0]*k,y:oy+topo[1]*k});}});
  for(var lx=0;lx<2;lx++)for(var ly=0;ly<2;ly++){var px=t.x+0.12+lx*(L-0.24),py=t.y+0.12+ly*(TW-0.24);caixa(tg,px-0.05,py-0.05,0,px+0.05,py+0.05,0.97,'#9ca3af','#a3aab5','#8b93a0');}
  caixa(tg,t.x,t.y,0.97,t.x+L,t.y+TW,1.05,'#f6efe1','#e3d9c4','#d6cab2');
  for(var lp=1;lp<LUG;lp+=2){var lc=P(t.x+0.25+GAP*lp,t.y+TW/2,1.05);sv('ellipse',{cx:lc[0],cy:lc[1],rx:1.0,ry:0.5,fill:'url(#glL)'},tg);}
  lugares.forEach(function(l,li){if(l.mesa!==mi)return;var nome=mapa[li];laptop(tg,l.x,t.y+0.3,nome!==undefined?stt(nome):'');});
  for(var s2=0;s2<LUG;s2+=2){var bx=t.x+0.25+GAP*(s2+0.5),by=t.y+TW+0.7,fb2=P(bx,by,0);sv('ellipse',{cx:fb2[0],cy:fb2[1]+0.03,rx:0.42,ry:0.2,fill:'#0f172a','fill-opacity':.1,filter:'url(#blur)'},tg);banco(tg,bx,by,0.5);}
  desenhaveis.push({d:t.x+t.y,g:tg});});
 var lz=sv('g',null,null);sofa(lz,RW-1.5,RD-3.0);poltrona(lz,MX+L*0.55,RD-1.25);planta(lz,0.9,RD-0.9);desenhaveis.push({d:RW+RD,g:lz});
 desenhaveis.sort(function(a,b){return a.d-b.d;}).forEach(function(d){g.appendChild(d.g);});
 // balões (camada de cima, sem sobreposição; quem precisa de atenção escolhe lugar primeiro)
 var bl=sv('g',null,mov),postos=[],PRI={waiting_user:0,error:1,working:2,done:3,idle:4,none:5};
 bals.sort(function(a,b){return (PRI[a.s]-PRI[b.s])||(a.y-b.y);});
 bals.forEach(function(b){
  var nome=trunc(b.nome,22),l2=null,alerta=b.s==='waiting_user'||b.s==='error';
  if(b.s==='waiting_user')l2='esperando há '+(dur(b.at)||'0 min');
  else if(b.s==='error')l2=b.step?trunc(b.step,28):'deu erro';
  else if(b.s==='working')l2=b.step?trunc(b.step,26):'trabalhando';
  var ic=alerta?22:0,dg=b.s==='working'?18:0;
  var w=Math.round(Math.max(nome.length*6.4,l2?l2.length*5.6+dg:0)+28+ic),h=l2?36:22,x=b.x-w/2,y=b.y-h-8;
  function bate(x,y){return postos.some(function(p){return x<p.x+p.w+3&&x+w+3>p.x&&y<p.y+p.h+2&&y+h+2>p.y;});}
  var d=h+4,tent=[];[0,-1,1,-2,-3,2].forEach(function(dy){[0,-0.5,0.5,-1,1,-1.5,1.5].forEach(function(dx){tent.push([dx*(w+6),dy*d-(dx?4:0)]);});});
  tent.sort(function(p,q){return (Math.abs(p[0])/2+Math.abs(p[1])*1.4+(p[1]>0?40:0))-(Math.abs(q[0])/2+Math.abs(q[1])*1.4+(q[1]>0?40:0));});
  var ok=tent[0];for(var i=0;i<tent.length;i++){if(!bate(x+tent[i][0],y+tent[i][1])){ok=tent[i];break;}}
  x+=ok[0];y+=ok[1];postos.push({x:x,y:y,w:w,h:h});
  var sel=b.nome===botSel,gg=sv('g',{class:'balao '+b.s},bl);bm[b.nome]=gg;gg.addEventListener('click',function(ev){ev.stopPropagation();focar(b.nome);});
  var fundo=b.s==='waiting_user'?'#f59e0b':b.s==='error'?'#ef4444':'#ffffff';
  var c1=b.s==='waiting_user'?'#2a1b00':b.s==='error'?'#ffffff':(PRI[b.s]>=3?'#4b5563':'#111827');
  var c2=b.s==='waiting_user'?'#4a3000':b.s==='error'?'#ffe4e6':'#15803d';
  if(ok[0]||ok[1])sv('line',{x1:b.x,y1:b.y-4,x2:Math.max(x+8,Math.min(x+w-8,b.x)),y2:ok[1]>0?y:y+h,stroke:alerta?fundo:'#9aa1ad','stroke-width':alerta?1.6:1},gg);
  if(alerta)sv('rect',{x:x-4,y:y-4,width:w+8,height:h+8,rx:h/2+4,fill:fundo,'fill-opacity':.35,class:'halo'},gg);
  sv('rect',{x:x,y:y+2,width:w,height:h,rx:Math.min(12,h/2),fill:'#0f172a','fill-opacity':.14},gg);
  sv('rect',{x:x,y:y,width:w,height:h,rx:Math.min(12,h/2),fill:fundo,stroke:sel?'#111827':'none','stroke-width':sel?2:0},gg);
  if(!ok[0]&&!ok[1])sv('polygon',{points:(b.x-5)+','+(y+h-0.5)+' '+(b.x+5)+','+(y+h-0.5)+' '+b.x+','+(y+h+5),fill:fundo},gg);
  var tx=x+19;
  if(alerta){var ig=sv('g',{class:'pulo'},gg);sv('circle',{cx:x+15,cy:y+h/2,r:9,fill:'#ffffff'},ig);
   var it=sv('text',{x:x+15,y:y+h/2+4.5,fill:fundo,'text-anchor':'middle'},ig);it.textContent=b.s==='waiting_user'?'?':'!';it.style.fontSize='13px';it.style.fontWeight='800';tx=x+30;}
  else{var dt=sv('circle',{cx:x+11,cy:y+(l2?12:h/2),r:3.8,fill:COR_ST[b.s]},gg);if(b.s==='working')dt.setAttribute('class','brilho');}
  var t=sv('text',{x:tx,y:y+(l2?15:h/2+4),fill:c1},gg);t.textContent=nome;
  if(l2){var t2=sv('text',{x:tx,y:y+28,fill:c2,class:'l2'},gg);t2.textContent=l2;
   if(b.s==='working'){var dgg=sv('g',{class:'dig'},gg),dx=tx+l2.length*5.6+6;for(var q=0;q<3;q++)sv('circle',{cx:dx+q*5,cy:y+25,r:1.7,fill:'#22c55e'},dgg);}}
  var tt=sv('title',null,gg),fb3=frescor(b.at,b.s,Date.now());tt.textContent=b.nome+' · '+NOME_ST[b.s]+(b.step?' · '+b.step:'')+' · '+fb3.texto+(fb3.velho?' · pode estar desatualizado':'');});
 // câmera: zoom centraliza o bot no espaço livre entre os painéis, sem inclinar
 var cx=(fl+fr)/2,cy=(ft+Math.min(fb,H))/2,Z=1.9,c1=alvo&&!RM.matches?{s:Z,x:cx-alvo[0]*Z,y:cy-alvo[1]*Z}:{s:1,x:0,y:0};
 if(!alvo)zoom=null;if(zoom&&bm[zoom]){bm[zoom].classList.add('foco');bl.appendChild(bm[zoom]);}cam.classList.toggle('zoom',!!zoom);cam.style.transformOrigin='0 0';cam.style.transform=tf(c1);
 if(animCam&&!velho)cam.animate([{transform:tf(cam0)},{transform:tf(c1)}],{duration:1000,easing:'ease-in-out'});
 cam0=c1;animCam=false;
 if(velho){var vm=velho.querySelector('.mov'),vs=velho.querySelector('.sombra'),d=transAndar*H*0.45,o={duration:1500,easing:'ease-in-out'};
  if(vs)vs.remove();vm.style.pointerEvents='none';svg.insertBefore(velho,cam);mov.style.transformOrigin=vm.style.transformOrigin=cx+'px '+cy+'px';
  var a1=vm.animate([{transform:'translateY(0) scale(1)',opacity:1},{transform:'translateY('+(-d*0.5)+'px) scale(.92)',opacity:.35,offset:.5},{transform:'translateY('+(-d)+'px) scale(.92)',opacity:0}],o);
  mov.animate([{transform:'translateY('+d+'px) scale(.92)',opacity:0},{transform:'translateY('+(d*0.5)+'px) scale(.92)',opacity:.35,offset:.5},{transform:'translateY(0) scale(1)',opacity:1}],o);
  a1.onfinish=function(){velho.remove();};ocupado=Date.now()+1600;}
 else if(transAndar){mov.animate([{opacity:0},{opacity:1}],{duration:400,easing:'ease-in-out'});}
 transAndar=0;
 // geometria para a animação de passagem de tarefa (sobrevive ao redesenho: o quadro recria o boneco aqui)
 var corr=[MX-1.2];if(cols>1)corr.push(MX-0.6+L+CG/2);
 geo={andar:andarSel,g:g,top:sv('g',{class:'passante'},mov),ox:ox,oy:oy,k:k,lug:lug,bgs:bgs,corr:corr,elev:{x:0.4,y:(ey0+ey1)/2}};
 if(passAt)quadroJa();}
// ---- passagem de tarefa: o boneco levanta, anda até a mesa do outro, entrega e volta ----
var filaPass=[],passAt=null,vistos=null,raf=0,VEL=0.0034,AY=-0.55;
function novasPassagens(hs){if(!Array.isArray(hs))return;var ids={};hs.forEach(function(h){ids[h.id]=1;});
 // 1ª carga da página: as passagens que já estavam lá não são animadas
 if(vistos===null){vistos=ids;return;}
 var novas=hs.filter(function(h){return !vistos[h.id];}).reverse();for(var k in vistos)if(!ids[k]&&!(passAt&&passAt.h.id===k))delete vistos[k];
 novas.forEach(function(h){vistos[h.id]=1;filaPass.push(h);});if(filaPass.length>8)filaPass=filaPass.slice(-8);agenda();}
function agenda(){if(!raf)raf=requestAnimationFrame(quadro);}
function linhaRota(pts){var c=[0];for(var i=1;i<pts.length;i++)c.push(c[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
 return {pts:pts,len:c[c.length-1],at:function(d){d=Math.max(0,Math.min(c[c.length-1],d));for(var i=1;i<pts.length;i++)if(d<=c[i]||i===pts.length-1){var u=c[i]>c[i-1]?(d-c[i-1])/(c[i]-c[i-1]):1;
  return [pts[i-1][0]+(pts[i][0]-pts[i-1][0])*u,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*u];}return pts[0];}};}
function corredor(x0,x1){return geo.corr.slice().sort(function(a,b){return (Math.abs(x0-a)+Math.abs(x1-a))-(Math.abs(x0-b)+Math.abs(x1-b));})[0];}
// do lugar a (sentado) até ao lado do lugar b: corredor de trás da fileira, e o corredor lateral se mudar de fileira
function rotaMesas(a,b){var lado=a.x>b.x?1:-1,fim=[b.x+lado*1.1,b.y-0.1],ya=a.y+AY,yb=b.y+AY,p=[[a.x,a.y],[a.x,ya]];
 if(Math.abs(ya-yb)>0.01){var c=corredor(a.x,b.x);p.push([c,ya],[c,yb]);}p.push([fim[0],yb],fim);return p;}
function rotaElev(a){var c=geo.corr[0],e=geo.elev,ya=a.y+AY;return [[a.x,a.y],[a.x,ya],[c,ya],[c,e.y],[e.x+0.5,e.y]];}
function planejar(h){var a=geo.lug[h.from],b=geo.lug[h.to];if(!a&&!b)return null;
 var p={h:h,andar:geo.andar,t0:performance.now(),fases:[]};
 if(RM.matches){p.modo='rm';p.fases.push({d:4500});return p;}
 function anda(r,sobe,desce,extra){var o={d:Math.min(7000,Math.max(900,r.len/VEL)),r:r,sobe:sobe,desce:desce};for(var k in extra)o[k]=extra[k];p.fases.push(o);}
 var paraTxt='Para '+h.to,tk=h.task||'Nova tarefa';
 if(a&&b){p.modo='mesmo';var ida=linhaRota(rotaMesas(a,b)),volta=linhaRota(ida.pts.slice().reverse());
  anda(ida,1,0,{papel:1});p.fases.push({d:3200,fixo:ida.pts[ida.pts.length-1],bal:[paraTxt,tk],recebe:1,papel:1});anda(volta,0,1,{});}
 else if(a){p.modo='sai';var ida2=linhaRota(rotaElev(a)),e=geo.elev,porta=[e.x,e.y],fora=[e.x+0.5,e.y];
  var tm=bot(h.to).team;anda(ida2,1,0,{papel:1,bal:['Levando para '+h.to,tm?'andar '+tm:tk]});
  p.fases.push({d:700,de:fora,ate:porta,op0:1,op1:0,papel:1},{d:1500,fixo:porta,op0:0,op1:0},{d:700,de:porta,ate:fora,op0:0,op1:1});
  anda(linhaRota(ida2.pts.slice().reverse()),0,1,{});}
 else{p.modo='entra';var e2=geo.elev,porta2=[e2.x,e2.y],fora2=[e2.x+0.5,e2.y],c2=geo.corr[0];
  var r1=[fora2,[c2,e2.y],[c2,b.y+AY],[b.x-1.1,b.y+AY],[b.x-1.1,b.y-0.1]];
  var ida3=linhaRota(r1);p.fases.push({d:700,de:porta2,ate:fora2,op0:0,op1:1,papel:1});anda(ida3,0,0,{papel:1});
  p.fases.push({d:3200,fixo:r1[r1.length-1],bal:[paraTxt,tk],recebe:1,papel:1});anda(linhaRota(r1.slice().reverse()),0,0,{});
  p.fases.push({d:700,de:fora2,ate:porta2,op0:1,op1:0});}
 return p;}
function quadro(){raf=0;quadroJa();if(passAt||filaPass.length)agenda();}
function quadroJa(){
 if(!passAt){if(!filaPass.length||!geo||Date.now()<ocupado)return;var h=filaPass.shift();passAt=planejar(h);if(!passAt)return;}
 if(!geo||geo.andar!==passAt.andar){encerra();return;}
 var p=passAt,t=performance.now()-p.t0,f=null,u=0;for(var i=0;i<p.fases.length;i++){if(t<p.fases[i].d){f=p.fases[i];u=t/f.d;break;}t-=p.fases[i].d;}
 if(!f){encerra();return;}
 var h=p.h,a=geo.lug[h.from],b=geo.lug[h.to];
 if(p.modo==='rm'){desenhaRM(p,a,b,t);return;}
 var x,y,z=0,op=1,bob=0,tilt=0;
 if(f.r){var dd=u*f.r.len,q=f.r.at(dd);x=q[0];y=q[1];
  if(f.sobe)z=0.55*Math.max(0,1-dd/0.55);if(f.desce)z=0.55*Math.max(0,1-(f.r.len-dd)/0.55);
  var w=performance.now()/1000*Math.PI*3.2;bob=Math.abs(Math.sin(w))*0.12;tilt=Math.sin(w)*5;}
 else if(f.fixo){x=f.fixo[0];y=f.fixo[1];}
 else{x=f.de[0]+(f.ate[0]-f.de[0])*u;y=f.de[1]+(f.ate[1]-f.de[1])*u;}
 if(f.op0!=null)op=f.op0+(f.op1-f.op0)*u;
 // quem sai da mesa não fica sentado ao mesmo tempo
 if(a&&geo.bgs[h.from])geo.bgs[h.from].style.opacity='0';
 if(b&&geo.bgs[h.to])geo.bgs[h.to].classList.toggle('recebe',!!f.recebe);
 var wk=p.wk;if(!wk||wk.parentNode!==geo.g){wk=p.wk=sv('g',{class:'passante','data-pass':h.id},geo.g);p.wkSombra=sv('ellipse',{rx:0.42,ry:0.17,fill:'#0f172a','fill-opacity':.22},wk);
  p.wkFig=sv('g',null,wk);var tam=1.36,fig=boneco(h.from,bot(h.from),tam);fig.setAttribute('x',(-tam/2).toFixed(3));fig.setAttribute('y',(-tam*0.98).toFixed(3));p.wkFig.appendChild(fig);
  p.wkPapel=sv('g',null,p.wkFig);sv('rect',{x:0.34,y:-0.78,width:0.34,height:0.44,rx:0.03,fill:'#ffffff',stroke:'#94a3b8','stroke-width':0.025,transform:'rotate(12 0.5 -0.56)'},p.wkPapel);
  [-0.68,-0.6,-0.52].forEach(function(ly){sv('line',{x1:0.42,y1:ly,x2:0.6,y2:ly+0.04,stroke:'#94a3b8','stroke-width':0.025},p.wkPapel);});}
 var pp=P(x,y,z+bob);wk.setAttribute('transform','translate('+pp[0].toFixed(3)+' '+pp[1].toFixed(3)+')');wk.setAttribute('opacity',op.toFixed(2));
 p.wkSombra.setAttribute('cy',((z+bob)*UZ).toFixed(3));p.wkFig.setAttribute('transform','rotate('+tilt.toFixed(1)+' 0 0)');p.wkPapel.setAttribute('opacity',f.papel?'1':'0');
 balaoPass(p,f.bal,op>0.3?[geo.ox+pp[0]*geo.k,geo.oy+(pp[1]-1.45)*geo.k]:null);}
function balaoPass(p,txt,pos){var key=txt?txt.join('|'):'';
 if(!txt||!pos){if(p.bal&&p.bal.parentNode)p.bal.remove();p.bal=null;return;}
 if(!p.bal||p.balKey!==key||p.bal.parentNode!==geo.top){if(p.bal&&p.bal.parentNode)p.bal.remove();p.balKey=key;
  var l1=trunc(txt[0],30),l2=trunc(txt[1],34),w=Math.round(Math.max(l1.length*6.4,l2.length*5.6)+40),hh=36,g2=sv('g',null,geo.top);p.bal=g2;
  sv('rect',{x:-w/2,y:-hh-8+2,width:w,height:hh,rx:12,fill:'#0f172a','fill-opacity':.14},g2);sv('rect',{x:-w/2,y:-hh-8,width:w,height:hh,rx:12,fill:'#111827'},g2);
  sv('polygon',{points:'-5,-8.5 5,-8.5 0,-3',fill:'#111827'},g2);
  sv('rect',{x:-w/2+10,y:-hh-8+10,width:12,height:15,rx:2,fill:'#ffffff'},g2);[0,4,8].forEach(function(d){sv('line',{x1:-w/2+13,y1:-hh-8+14+d,x2:-w/2+19,y2:-hh-8+14+d,stroke:'#94a3b8','stroke-width':1.2},g2);});
  var t1=sv('text',{x:-w/2+30,y:-hh-8+15,fill:'#f3f4f6'},g2);t1.textContent=l1;var t2=sv('text',{x:-w/2+30,y:-hh-8+28,fill:'#86efac',class:'l2'},g2);t2.textContent=l2;
  var tt=sv('title',null,g2);tt.textContent=p.h.from+' → '+p.h.to+(p.h.task?' · '+p.h.task:'');}
 p.bal.setAttribute('transform','translate('+pos[0].toFixed(1)+' '+pos[1].toFixed(1)+')');}
// movimento reduzido: sem caminhada, só uma seta tracejada piscando entre as mesas (ou até o elevador)
function desenhaRM(p,a,b,t){var h=p.h,e=geo.elev,de=a?[a.x,a.y]:[e.x+0.4,e.y],ate=b?[b.x,b.y]:[e.x+0.4,e.y];
 if(!p.seta||p.seta.parentNode!==geo.g){p.seta=sv('g',{class:'passante'},geo.g);var A=P(de[0],de[1],1.3),B=P(ate[0],ate[1],1.3);
  sv('line',{x1:A[0],y1:A[1],x2:B[0],y2:B[1],stroke:'#111827','stroke-width':0.09,'stroke-dasharray':'0.3 0.18','stroke-linecap':'round'},p.seta);
  var an=Math.atan2(B[1]-A[1],B[0]-A[0]),s1=0.38;sv('polygon',{points:[B[0],B[1],B[0]-s1*Math.cos(an-0.5),B[1]-s1*Math.sin(an-0.5),B[0]-s1*Math.cos(an+0.5),B[1]-s1*Math.sin(an+0.5)].map(function(v){return v.toFixed(3);}).join(' '),fill:'#111827'},p.seta);
  [A,B].forEach(function(c){sv('circle',{cx:c[0],cy:c[1],r:0.32,fill:'none',stroke:'#22c55e','stroke-width':0.07},p.seta);});}
 p.seta.setAttribute('opacity',Math.floor(t/600)%2?'0.35':'1');
 var alvo=b||a,tp=P(alvo.x,alvo.y,2.2);balaoPass(p,[b?'Para '+h.to:'Levando para '+h.to,h.task||'Nova tarefa'],[geo.ox+tp[0]*geo.k,geo.oy+tp[1]*geo.k]);}
function encerra(){var p=passAt;passAt=null;if(!p)return;
 if(p.wk&&p.wk.parentNode)p.wk.remove();if(p.seta&&p.seta.parentNode)p.seta.remove();if(p.bal&&p.bal.parentNode)p.bal.remove();
 if(geo){var fb=geo.bgs[p.h.from],tb=geo.bgs[p.h.to];if(fb)fb.style.opacity='';if(tb)tb.classList.remove('recebe');}}
// ---- painéis ----
function card(id,titulo,extra){var c=el('section','card'+(fechados[id]?' fechado':''));var h=el('h3',null,titulo);
 if(extra!=null)h.appendChild(extra);h.appendChild(el('span','chev','▾'));h.addEventListener('click',function(){fechados[id]=!fechados[id];c.classList.toggle('fechado');});
 c.appendChild(h);var b=el('div','corpo');c.appendChild(b);return [c,b];}
function mini(nome){var s=boneco(nome,bot(nome),24);s.setAttribute('class','mini');return s;}
function linha(nome,t1,t2,dir){var it=el('div','item');it.appendChild(mini(nome));var tx=el('div','tx');tx.appendChild(el('div','t1',t1));if(t2)tx.appendChild(el('div','t2',t2));it.appendChild(tx);
 if(dir)it.appendChild(dir);it.addEventListener('click',function(){irAndar(bot(nome).team||SEM,nome);});it.style.cursor='pointer';return it;}
function desenhar(){
 if(!st)return;var ts=times(),todos=lista();if(!transAndar)uid=0;
 if(!ts.some(function(t){return t.nome===andarSel;}))andarSel=ts.length?ts[0].nome:null;
 var andar=ts.filter(function(t){return t.nome===andarSel;})[0]||{nome:'',bots:[]};
 if(botSel&&todos.indexOf(botSel)<0)botSel=null;
 if(!botSel||andar.bots.indexOf(botSel)<0){botSel=andar.bots.filter(function(n){return stt(n)==='waiting_user';})[0]||andar.bots.filter(function(n){return stt(n)==='working';})[0]||andar.bots[0]||null;}
 // topo
 var cnt={working:0,waiting_user:0,error:0,resto:0};todos.forEach(function(n){var s=stt(n);if(cnt[s]!=null)cnt[s]++;else cnt.resto++;});
 var ct=document.getElementById('contas');ct.replaceChildren();
 [['working',cnt.working,'trabalhando'],['waiting_user',cnt.waiting_user,'esperando'],['error',cnt.error,cnt.error===1?'erro':'erros'],['idle',cnt.resto,'descansando']].forEach(function(c){
  var s=el('span',c[1]>0&&c[0]!=='idle'?'on-'+c[0]:null);var d=el('i','dot');d.style.background=COR_ST[c[0]];s.appendChild(d);s.appendChild(el('b',null,c[1]));s.appendChild(document.createTextNode(c[2]));ct.appendChild(s);});
 // esquerda
 var esq=document.getElementById('esq');esq.replaceChildren();
 var esp=todos.filter(function(n){return stt(n)==='waiting_user';}).sort(function(x,y){return Date.parse(bot(x).status_at||0)-Date.parse(bot(y).status_at||0);});
 var bd=el('span','badge'+(esp.length?' amb':' ok'),esp.length);
 var e=card('esperando','Esperando por mim',bd);e[0].classList.add('espera');if(esp.length)e[0].classList.add('alerta');
 esp.forEach(function(n){var b=bot(n),t2=el('div','t2'),it=linha(n,n,null,linkChat(n));t2.appendChild(el('b',null,'há '+(dur(b.status_at)||'0 min')));
  if(b.step)t2.appendChild(document.createTextNode(' · '+b.step));it.querySelector('.tx').appendChild(t2);
  var fe=frescor(b.status_at,'waiting_user',Date.now());if(fe.velho){var t3=el('div','t3');t3.appendChild(selo());it.querySelector('.tx').appendChild(t3);}e[1].appendChild(it);});
 if(!esp.length){var ok=el('div','ok-linha');ok.appendChild(el('i',null,'✓'));ok.appendChild(document.createTextNode('Ninguém esperando por você.'));e[1].appendChild(ok);}esq.appendChild(e[0]);
 var a=card('andares','Andares');ts.forEach(function(t,i){var r=el('div','andar'+(t.nome===andarSel?' sel':''));r.appendChild(el('span','n',i+1));r.appendChild(el('span','nm',t.nome));
  var q={working:0,waiting_user:0,error:0};t.bots.forEach(function(n){var s=stt(n);if(q[s]!=null)q[s]++;});
  if(q.waiting_user){var tw=el('span','tag w',q.waiting_user+' ?');tw.title=q.waiting_user+' esperando por mim';r.appendChild(tw);}
  if(q.error){var te=el('span','tag e',q.error+' !');te.title=q.error+' com erro';r.appendChild(te);}
  if(q.working){var tt=el('span','tag t',String(q.working));tt.title=q.working+' trabalhando';r.appendChild(tt);}
  r.appendChild(el('span','ct',t.bots.length));
  r.addEventListener('click',function(){if(t.nome!==andarSel)irAndar(t.nome);});a[1].appendChild(r);});
 if(!ts.length)a[1].appendChild(el('div','vazio','Nenhum bot reportou ainda.'));esq.appendChild(a[0]);
 var feito=(st.feed||[]).filter(function(f){return f.status==='done'&&todos.indexOf(f.bot)>=0;}).filter(function(f,i,a){return a.findIndex(function(x){return x.bot===f.bot;})===i;}).slice(0,3);
 var cc=card('concluidos','Concluídos',el('span','badge',feito.length));feito.forEach(function(f){cc[1].appendChild(linha(f.bot,f.bot,f.step,el('span','hr',ha(f.at))));});
 if(!feito.length)cc[1].appendChild(el('div','vazio','Nada concluído recentemente.'));esq.appendChild(cc[0]);

 // atividade
 var at=document.getElementById('ativ');at.replaceChildren();var ac=card('ativ','Atividade');ac[0].style.height='100%';ac[0].style.display='flex';ac[0].style.flexDirection='column';ac[1].className='corpo feed';
 var fd=(st.feed||[]).filter(function(f){return todos.indexOf(f.bot)>=0;}).slice(0,5);
 fd.forEach(function(f){var it=el('div','item');it.appendChild(el('span','hr',hora(f.at)));it.appendChild(mini(f.bot));var tx=el('div','tx');
  var t1=el('div','t2');var bb=el('b',null,f.bot);bb.style.color='#f3f4f6';t1.appendChild(bb);t1.appendChild(document.createTextNode(' '+(VERBO[f.status]||'')+': '+f.step));tx.appendChild(t1);it.appendChild(tx);ac[1].appendChild(it);});
 if(!fd.length)ac[1].appendChild(el('div','vazio','Sem atividade ainda.'));at.appendChild(ac[0]);
 // direita: bot selecionado + consumo
 var dir=document.getElementById('dir');dir.replaceChildren();var cs=andarSel+'|'+botSel;
 if(ultSel&&cs!==ultSel)dir.animate([{opacity:0},{opacity:1}],{duration:transAndar?700:350,easing:'ease-in-out'});ultSel=cs;
 if(botSel){var b=bot(botSel),s=stt(botSel),cab=el('section','sel-cab s-'+s);cab.style.background=CAB_ST[s]||CAB_ST.none;
  var l1=el('div','l1');l1.appendChild(boneco(botSel,b,44));var nm=el('div');nm.appendChild(el('div','nome',botSel));
  nm.appendChild(el('div','sub',(b.team||SEM)+' · mesa '+(andar.bots.indexOf(botSel)+1)));l1.appendChild(nm);cab.appendChild(l1);
  cab.appendChild(el('span','chip',NOME_ST[s]+(b.status_at?' · '+dur(b.status_at):'')));
  if(b.step)cab.appendChild(el('div','passo',b.step));if(s==='waiting_user')cab.appendChild(botaoResolver(botSel));
  var fz=frescor(b.status_at,s,Date.now()),fq=el('div','fresco');fq.appendChild(el('span',null,fz.texto));if(fz.velho)fq.appendChild(selo());if(b.status_at)fq.title='Última atualização de status: '+fData.format(new Date(b.status_at));cab.appendChild(fq);dir.appendChild(cab);
  var det=el('section','card'),stt3=el('div','stats'),u=st.usage,rec=b.recent||[];
  [[rec.length,'passos recentes'],[(b.routines||[]).length,'rotinas'],[u&&u.bots&&u.bots[botSel]!=null?u.bots[botSel]+'%':'—','do consumo']].forEach(function(x){var d=el('div');d.appendChild(el('b',null,x[0]));d.appendChild(el('small',null,x[1]));stt3.appendChild(d);});
  det.appendChild(stt3);det.appendChild(el('h3',null,'Passos recentes'));var ps=el('div','corpo passos');
  rec.slice(0,6).forEach(function(r){var it=el('div','item');var d=el('i','dot');d.style.background=COR_ST[r.status]||COR_ST.none;it.appendChild(d);var tx=el('div','tx');tx.appendChild(el('div','t2',r.step));it.appendChild(tx);it.appendChild(el('span','hr',hora(r.at)));ps.appendChild(it);});
  if(!rec.length)ps.appendChild(el('div','vazio','Sem passos registrados.'));det.appendChild(ps);
  var pr=(b.routines||[]).filter(function(r){return r.next_run;}).sort(function(x,y){return Date.parse(x.next_run)-Date.parse(y.next_run);})[0];
  if(pr){var pp=el('div','vazio','Próxima rotina: '+pr.name+' · '+em(pr.next_run));pp.style.marginTop='8px';det.appendChild(pp);}
  var lk=linkChat(botSel,'light cheio');if(lk)det.appendChild(lk);else{var sl=el('div','vazio','Sem link de chat.');sl.style.marginTop='8px';det.appendChild(sl);}
  dir.appendChild(det);}
 var uc=el('section','card'),u2=st.usage;uc.appendChild(el('h3',null,'Consumo da semana'));var ub=el('div','corpo');
 if(u2){var p=u2.total_used_pct,br=el('div','bar'+(p>=90?' max':p>=70?' hi':''));var bi=el('i');bi.style.width=Math.max(0,Math.min(100,p))+'%';br.appendChild(bi);
  ub.appendChild(el('div',null,p+'% usado · renova '+fData.format(new Date(u2.resets_at))));ub.appendChild(br);}
 else ub.appendChild(el('div','vazio','Sem dados de consumo ainda.'));uc.appendChild(ub);dir.appendChild(uc);
 var rot=[];todos.forEach(function(n){(bot(n).routines||[]).forEach(function(r){rot.push({bot:n,r:r});});});
 rot.sort(function(x,y){var a1=x.r.next_run?Date.parse(x.r.next_run):Infinity,b1=y.r.next_run?Date.parse(y.r.next_run):Infinity;return a1-b1;});
 var rc=card('rotinas','Rotinas',el('span','badge',rot.length));rot.slice(0,3).forEach(function(o){rc[1].appendChild(linha(o.bot,o.r.name,o.bot+' · '+o.r.schedule,el('span','hr',em(o.r.next_run))));});
 if(!rot.length)rc[1].appendChild(el('div','vazio','Nenhuma rotina informada.'));dir.appendChild(rc[0]);

 cena(andar.bots);}
// botão "Resolvido": 1º clique pede confirmação, 2º envia POST /api/resolve (cookie + mesma origem)
function botaoResolver(nome){var bt=el('button','resolver','✓ Resolvido'),conf=false,tm=0;bt.type='button';bt.title='Marca que você já respondeu: o bot sai de "Esperando por mim" e fica descansando.';
 bt.addEventListener('click',function(ev){ev.stopPropagation();if(bt.disabled)return;
  if(!conf){conf=true;bt.classList.add('conf');bt.textContent='Confirmar: já resolvi';tm=setTimeout(function(){conf=false;bt.classList.remove('conf');bt.textContent='✓ Resolvido';},5000);return;}
  clearTimeout(tm);bt.disabled=true;bt.textContent='Salvando…';
  fetch('/api/resolve',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({bot:nome})})
   .then(function(r){if(r.status===401){location.href='/';return;}if(!r.ok)throw new Error(String(r.status));load();})
   .catch(function(){bt.disabled=false;conf=false;bt.classList.remove('conf');bt.textContent='Falhou. Tentar de novo';});});
 return bt;}
function relogio(){document.getElementById('hora').textContent=fHora.format(new Date());}
function load(){fetch('/api/state',{credentials:'same-origin',cache:'no-store'}).then(function(r){if(r.status===401){location.href='/';return null;}return r.json();})
 .then(function(s){if(!s)return;st=s;setTimeout(function(){desenhar();novasPassagens(s.handoffs);},Math.max(0,ocupado-Date.now()));document.getElementById('vivo').lastChild.textContent=' Ao vivo · ';})
 .catch(function(){document.getElementById('vivo').lastChild.textContent=' sem conexão · ';});}
document.getElementById('cena').addEventListener('click',soltar);
document.addEventListener('keydown',function(e){if(e.key==='Escape')soltar();});
var rz;window.addEventListener('resize',function(){clearTimeout(rz);rz=setTimeout(desenhar,120);});
relogio();setInterval(relogio,15000);load();setInterval(load,30000);
})();`;

export function panelPage(nonce: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Painel dos bots</title><style nonce="${nonce}">${STYLE}</style></head>
<body><svg id="cena" aria-label="Escritório dos bots"></svg>
<div id="topo"><div class="marca">Painel dos bots <span class="vivo" id="vivo"><i></i> carregando · </span><span id="hora"></span></div>
<div class="contas" id="contas"></div><form method="post" action="/logout"><button type="submit" class="sair">Sair</button></form></div>
<div id="esq"></div><div id="ativ"></div><div id="dir"></div>
<script nonce="${nonce}">var floorOrder=${floorOrder.toString()};var frescor=${frescor.toString()};${CLIENT}</script></body></html>`;
}
