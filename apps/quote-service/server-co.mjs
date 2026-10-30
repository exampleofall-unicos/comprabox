import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { authenticate,requestId,validate,hash,Store,InputError,publicResult,processRequest } from './core-co.mjs';
import { Shopify } from './shopify-co.mjs';
const env=process.env;
for(const name of ['SHOPIFY_SHOP','SHOPIFY_API_SECRET','SHOPIFY_PUBLICATION_ID','DATA_ENCRYPTION_KEY','TURNSTILE_SECRET_KEY','TURNSTILE_HOSTNAME']) if(!env[name]) throw new Error(`Missing ${name}`);
if(!env.SHOPIFY_CLIENT_ID&&!env.SHOPIFY_ADMIN_ACCESS_TOKEN) throw new Error('Set SHOPIFY_CLIENT_ID or SHOPIFY_ADMIN_ACCESS_TOKEN');
if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(env.SHOPIFY_SHOP) || !/^gid:\/\/shopify\/Publication\/\d+$/.test(env.SHOPIFY_PUBLICATION_ID) || !/^[a-fA-F0-9]{64}$/.test(env.DATA_ENCRYPTION_KEY)) throw new Error('Invalid shop, publication or encryption key');
const database=env.DATABASE_PATH||'./data/quotes-co.sqlite';mkdirSync(dirname(database),{recursive:true});
const store=new Store(database,env.DATA_ENCRYPTION_KEY), shopify=new Shopify(env);
// Run one service process per SQLite database. Interrupted mutations are uncertain,
// never automatically recreated. Reconciliation can recover their Shopify IDs.
store.db.prepare("UPDATE requests SET status='uncertain' WHERE status='creating'").run();
store.db.prepare("UPDATE requests SET status='failed',message='La verificación se interrumpió. Intentá nuevamente.' WHERE status='verifying'").run();
async function bodyOf(req) { let size=0,parts=[]; for await(const chunk of req){size+=chunk.length;if(size>65536) throw new InputError('Solicitud demasiado grande.',413);parts.push(chunk);} try{return JSON.parse(Buffer.concat(parts).toString());}catch{throw new InputError('Contenido inválido.',400);} }
async function challenge(token) {
  if(typeof token!=='string'||token.length>4096||!token) throw new InputError('Completá la verificación de seguridad.');
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token}),signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error('Challenge unavailable'); const result=await response.json();
  if(!result.success||result.hostname!==env.TURNSTILE_HOSTNAME||result.action!=='quote') throw new InputError('La verificación venció. Volvé a intentarlo.');
}
const server=createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try {
    const url=new URL(req.url,'https://quote-service.invalid');
    if(url.pathname==='/health'&&req.method==='GET') return send(200,{ok:true});
    authenticate(url,env.SHOPIFY_API_SECRET,env.SHOPIFY_SHOP);
    if(req.method!=='POST') throw new InputError('Método inválido.',405);
    if(!(req.headers['content-type']||'').startsWith('application/json')) throw new InputError('Contenido inválido.',415);
    const body=await bodyOf(req);requestId(body?.requestId);
    store.rate('all',600,60000);
    if(url.pathname==='/proxy/status') { store.rate(`status:${body.requestId}`,30,60000); return send(200,publicResult(store.get(body.requestId))); }
    if(url.pathname!=='/proxy/requests') throw new InputError('Ruta inválida.',404);
    if(env.QUOTE_ENABLED!=='true') throw new InputError('El envío está temporalmente deshabilitado.',503);
    const payload=validate(body),old=store.get(body.requestId);
    if(old) { if(old.hash!==hash(payload)) throw new InputError('El identificador corresponde a otra solicitud.',409);return send(200,publicResult(old)); }
    store.rate('new-shop',60,3600000);store.rate(`contact:${hash(payload.contact.email)}`,5,3600000);
    const row=store.create(body.requestId,payload);
    if(row.id!==body.requestId) return send(200,publicResult(row));
    store.update(row.id,'verifying');
    try { await challenge(body.challenge); store.update(row.id,'pending'); }
    catch(error) {store.update(row.id,'failed',{message:error instanceof InputError?error.message:'No pudimos verificar el envío. Intentá nuevamente.'});return send(200,publicResult(store.get(row.id)));}
    await processRequest(store,row.id,shopify);
    return send(200,publicResult(store.get(row.id)));
  } catch(error) {send(error instanceof InputError?error.status:503,{message:error instanceof InputError?error.message:'Servicio temporalmente no disponible. Tu selección se conserva.'});}
});
server.requestTimeout=30000;server.headersTimeout=10000;
async function sendEmail(to,subject,text,idempotencyKey) {
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:env.EMAIL_FROM,to:[to],subject,text}),signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error('Email unavailable');
}
let working=false;
async function work() {
  if(working)return;working=true;
  try {
    for(const row of store.db.prepare("SELECT * FROM requests WHERE status='pending' LIMIT 5").all()) await processRequest(store,row.id,shopify);
    for(const row of store.db.prepare("SELECT * FROM requests WHERE status='uncertain' AND updated<? LIMIT 5").all(Date.now()-60000)) {
      try {const draft=await shopify.reconcile(row.reference);if(draft)store.update(row.id,'confirmed',{draftId:draft.id,draftName:draft.name});else store.update(row.id,'uncertain');}catch{store.update(row.id,'uncertain');}
    }
    if(env.RESEND_API_KEY&&env.EMAIL_FROM&&env.NOTIFY_EMAIL) for(const row of store.db.prepare("SELECT * FROM requests WHERE status='confirmed' AND notified<2 AND next_notice<? LIMIT 5").all(Date.now())) {
      try {
        const payload=store.open(row.payload);
        if(row.notified===0) {await sendEmail(payload.contact.email,`Solicitud ${row.reference} recibida`,`Recibimos tu solicitud ${row.reference}. Comprabox revisará los productos y cantidades y te contactará para preparar el presupuesto.`,`${row.id}-customer`);store.db.prepare('UPDATE requests SET notified=1 WHERE id=?').run(row.id);}
        const draftNumber=row.draft_id.split('/').at(-1);
        await sendEmail(env.NOTIFY_EMAIL,`Nueva cotización ${row.reference}`,`Revisar en Shopify: https://${env.SHOPIFY_SHOP}/admin/draft_orders/${draftNumber}\nContacto: ${payload.contact.name}\nEmail: ${payload.contact.email}\nWhatsApp: ${payload.contact.whatsapp}\nEmpresa: ${payload.contact.company}\nProvincia: ${payload.contact.province} / ${payload.contact.locality}\nCUIT: ${payload.contact.cuit}`,`${row.id}-merchant`);
        store.db.prepare('UPDATE requests SET notified=2 WHERE id=?').run(row.id);
      } catch {store.db.prepare('UPDATE requests SET attempts=attempts+1,next_notice=? WHERE id=?').run(Date.now()+Math.min(3600000,60000*2**Math.min(row.attempts,6)),row.id);}
    }
    store.db.prepare('DELETE FROM limits WHERE expires<?').run(Date.now()-3600000);
  } finally {working=false;}
}
const timer=setInterval(()=>work().catch(()=>console.error('Quote worker failed; retrying later.')),15000);
server.listen(Number(env.PORT||3000),'0.0.0.0',()=>console.log('Comprabox Co service listening.'));
function shutdown(){clearInterval(timer);server.close(()=>{store.close();process.exit(0);});}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
