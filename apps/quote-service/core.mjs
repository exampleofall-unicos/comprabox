import { createHmac, timingSafeEqual, createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class InputError extends Error { constructor(message, status=422) { super(message); this.status = status; } }
export function authenticate(url, secret, shop, now=Date.now()) {
  const params = url.searchParams;
  const signatures = params.getAll('signature');
  if (signatures.length !== 1 || !/^[a-f0-9]{64}$/.test(signatures[0])) throw new InputError('Firma inválida.',401);
  const message = [...new Set(params.keys())].filter(key => key !== 'signature').map(key => `${key}=${params.getAll(key).join(',')}`).sort().join('');
  const expected = createHmac('sha256',secret).update(message).digest();
  if (!timingSafeEqual(expected,Buffer.from(signatures[0],'hex')) || params.getAll('shop').length !== 1 || params.get('shop') !== shop || params.getAll('timestamp').length !== 1 || !/^\d+$/.test(params.get('timestamp') || '') || Math.abs(now/1000-Number(params.get('timestamp'))) > 300) throw new InputError('Solicitud no autorizada.',401);
}
export function requestId(id) {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) throw new InputError('Identificador inválido.');
  return id;
}
export const provinces = 'Ciudad Autónoma de Buenos Aires,Buenos Aires,Catamarca,Chaco,Chubut,Córdoba,Corrientes,Entre Ríos,Formosa,Jujuy,La Pampa,La Rioja,Mendoza,Misiones,Neuquén,Río Negro,Salta,San Juan,San Luis,Santa Cruz,Santa Fe,Santiago del Estero,Tierra del Fuego,Tucumán'.split(',');
export function validate(body) {
  requestId(body.requestId);
  if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length > 100) throw new InputError('Elegí entre 1 y 100 variantes.');
  const quantities = new Map();
  for (const line of body.lines) {
    if (typeof line.id !== 'string' || !/^[1-9]\d{0,19}$/.test(line.id) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000000) throw new InputError('Variante o cantidad inválida.');
    quantities.set(line.id,(quantities.get(line.id)||0)+line.quantity);
    if (quantities.get(line.id)>1000000) throw new InputError('Cantidad máxima por variante: 1.000.000.');
  }
  const contact = {};
  for (const [key,max] of Object.entries({name:200,email:200,whatsapp:50,company:200,province:100,notes:3000})) {
    const value = body.contact?.[key] ?? '';
    if (typeof value !== 'string' || value.length>max || (key !== 'notes' && !value.trim()) || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value)) throw new InputError(`Revisá el campo ${key}.`);
    contact[key] = value.trim();
  }
  if (body.contact?.website) throw new InputError('Solicitud inválida.');
  contact.email = contact.email.toLowerCase();
  contact.whatsapp = contact.whatsapp.replace(/[\s().-]/g,'');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) || !/^\+[1-9]\d{7,14}$/.test(contact.whatsapp) || !provinces.includes(contact.province)) throw new InputError('Revisá email, WhatsApp (con + y código de país) y provincia.');
  return {contact,lines:[...quantities].sort(([a],[b])=>a.localeCompare(b)).map(([id,quantity])=>({id,quantity}))};
}
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class Store {
  constructor(path, secret) {
    this.secret=Buffer.from(secret,'hex'); if(this.secret.length!==32) throw new Error('DATA_ENCRYPTION_KEY must contain 32 bytes.');
    this.db=new DatabaseSync(path); this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.db.exec(`CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, hash TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reference TEXT NOT NULL UNIQUE, draft_id TEXT, draft_name TEXT, message TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL, notified INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, next_notice INTEGER NOT NULL DEFAULT 0); CREATE INDEX IF NOT EXISTS request_hash ON requests(hash); CREATE TABLE IF NOT EXISTS aliases(id TEXT PRIMARY KEY,request_id TEXT NOT NULL); CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  }
  seal(value) { const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',this.secret,iv); const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]); return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64'); }
  open(value) { const data=Buffer.from(value,'base64'), decipher=createDecipheriv('aes-256-gcm',this.secret,data.subarray(0,12)); decipher.setAuthTag(data.subarray(12,28)); return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString()); }
  get(id) { return this.db.prepare('SELECT * FROM requests WHERE id=? OR id=(SELECT request_id FROM aliases WHERE id=?)').get(id,id); }
  create(id,payload) {
    const digest=hash(payload), existing=this.get(id);
    if(existing) { if(existing.hash!==digest) throw new InputError('El identificador ya corresponde a otro contenido.',409); return existing; }
    const now=Date.now();
    const duplicate=this.db.prepare("SELECT * FROM requests WHERE hash=? AND status!='failed' AND created>? ORDER BY created DESC LIMIT 1").get(digest,now-600000);
    if(duplicate) {this.db.prepare('INSERT INTO aliases(id,request_id) VALUES(?,?)').run(id,duplicate.id);return duplicate;}
    this.db.prepare('INSERT INTO requests(id,hash,payload,reference,created,updated) VALUES(?,?,?,?,?,?)').run(id,digest,this.seal(payload),`CBX-${randomBytes(8).toString('hex').toUpperCase()}`,now,now);
    return this.get(id);
  }
  update(id,status,values={}) { this.db.prepare('UPDATE requests SET status=?,draft_id=COALESCE(?,draft_id),draft_name=COALESCE(?,draft_name),message=?,updated=? WHERE id=?').run(status,values.draftId||null,values.draftName||null,values.message||null,Date.now(),id); }
  rate(key,maximum,windowMs) {
    const now=Date.now();
    const row=this.db.prepare('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END RETURNING count').get(key,now+windowMs,now,now);
    if(row.count>maximum) throw new InputError('Demasiados intentos. Volvé a intentar más tarde.',429);
  }
  close(){ this.db.close(); }
}
export function publicResult(row) {
  if(!row) return {status:'not_found'};
  return {status:row.status==='confirmed'?'confirmed':row.status==='failed'?'failed':'pending', ...(row.status==='confirmed'?{reference:row.reference}:{}), ...(row.status==='failed'?{message:row.message||'No pudimos registrar la solicitud. Revisá los productos e intentá nuevamente.'}:{})};
}
export async function processRequest(store,id,shopify) {
  const claimed=store.db.prepare("UPDATE requests SET status='creating',updated=? WHERE id=? AND status='pending'").run(Date.now(),id);
  if(!claimed.changes) return;
  const row=store.get(id), payload=store.open(row.payload);
  try { await shopify.validateVariants(payload.lines); }
  catch(error) { store.update(id,'failed',{message:error instanceof InputError?error.message:'No pudimos validar los productos. Intentá nuevamente más tarde.'}); return; }
  try {
    const result=await shopify.create(payload,row.reference);
    if(result.userErrors?.length) { store.update(id,'failed',{message:'Shopify no pudo registrar estos productos. Revisá la selección o contactá a Comprabox.'}); return; }
    if(!result.draftOrder?.id) throw new Error('Missing draft');
    store.update(id,'confirmed',{draftId:result.draftOrder.id,draftName:result.draftOrder.name});
  } catch { store.update(id,'uncertain'); }
}
