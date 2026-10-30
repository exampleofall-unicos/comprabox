import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac,randomUUID } from 'node:crypto';
import { Store,validate,authenticate,processRequest,publicResult,InputError } from '../core-co.mjs';
import { Shopify } from '../shopify-co.mjs';
const secret='a'.repeat(64);
const payload=()=>({requestId:randomUUID(),lines:[{id:'123',quantity:50000}],contact:{name:'Cliente',email:'CLIENTE@example.com',whatsapp:'+54 9 11 1234 5678',company:'Empresa',province:'Buenos Aires',locality:'La Plata',privacy:true,notes:'Texto <script> sin HTML'}});
const database=()=>new Store(':memory:',secret);
test('quantities above stock survive normalization; duplicate variants merge',()=>{
 const body=payload();body.lines.push({id:'123',quantity:3});
 assert.deepEqual(validate(body).lines,[{id:'123',quantity:50003}]);
 assert.equal(validate(body).contact.email,'cliente@example.com');
 assert.equal(validate(body).contact.whatsapp,'+5491112345678');
});
test('reject malformed variants, quantity abuse, spam, missing or invalid contact',()=>{
 for(const quantity of [0,-1,1.5,1000001,NaN,'5',Infinity]) {const body=payload();body.lines[0].quantity=quantity;assert.throws(()=>validate(body),InputError);}
 for(const id of ['gid://shopify/Product/1','abc','0',12]) {const body=payload();body.lines[0].id=id;assert.throws(()=>validate(body),InputError);}
 for(const [key,value] of [['website','bot'],['email','x\ny@example.com'],['province','unknown'],['whatsapp','111']]){const body=payload();body.contact[key]=value;assert.throws(()=>validate(body),InputError);}
});
test('proxy signature verifies repeated parameters and rejects stale or tampered input',()=>{
 const url=new URL('https://service.invalid/proxy?extra=1&extra=2&shop=test.myshopify.com&timestamp=1000');
 const signature=createHmac('sha256','secret').update('extra=1,2shop=test.myshopify.comtimestamp=1000').digest('hex');url.searchParams.set('signature',signature);
 assert.doesNotThrow(()=>authenticate(url,'secret','test.myshopify.com',1000000));
 assert.throws(()=>authenticate(url,'secret','test.myshopify.com',2000000),InputError);
 url.searchParams.set('shop','evil.myshopify.com');assert.throws(()=>authenticate(url,'secret','test.myshopify.com',1000000),InputError);
});
test('durable idempotency, cross-tab duplicate detection, encrypted payload and rate limit',()=>{
 const store=database();try{
  const body=payload(),normalized=validate(body),row=store.create(body.requestId,normalized);
  assert.equal(store.create(body.requestId,normalized).id,row.id);
  const alias=randomUUID();assert.equal(store.create(alias,normalized).id,row.id);assert.equal(store.get(alias).id,row.id);
  assert.throws(()=>store.create(body.requestId,{...normalized,lines:[]}),InputError);
  assert.ok(!row.payload.includes('cliente@example.com'));assert.deepEqual(store.open(row.payload),normalized);
  assert.ok(!row.reference.includes(row.id));
  store.rate('x',1,60000);assert.throws(()=>store.rate('x',1,60000),InputError);
 }finally{store.close();}
});
test('concurrent processing creates exactly one draft and public receipt has no PII',async()=>{
 const store=database();try{
  const body=payload();store.create(body.requestId,validate(body));let calls=0;
  const shopify={validateVariants:async()=>{},create:async()=>{calls++;return {draftOrder:{id:'gid://shopify/DraftOrder/1',name:'#D1'},userErrors:[]};}};
  await Promise.all([processRequest(store,body.requestId,shopify),processRequest(store,body.requestId,shopify)]);
  assert.equal(calls,1);const result=publicResult(store.get(body.requestId));assert.equal(result.status,'confirmed');assert.deepEqual(Object.keys(result),['status','reference']);
 }finally{store.close();}
});
test('lost Shopify response becomes uncertain and is never blindly recreated',async()=>{
 const store=database();try{
  const body=payload();store.create(body.requestId,validate(body));let calls=0;
  const shopify={validateVariants:async()=>{},create:async()=>{calls++;throw new Error('Connection lost after commit');}};
  await processRequest(store,body.requestId,shopify);await processRequest(store,body.requestId,shopify);
  assert.equal(calls,1);assert.equal(store.get(body.requestId).status,'uncertain');assert.equal(publicResult(store.get(body.requestId)).status,'pending');
 }finally{store.close();}
});
test('invalid catalog variant fails before administrative mutation',async()=>{
 const store=database();try{
  const body=payload();store.create(body.requestId,validate(body));
  await processRequest(store,body.requestId,{validateVariants:async()=>{throw new InputError('Variante eliminada');},create:()=>assert.fail('Must not create')});
  assert.equal(store.get(body.requestId).status,'failed');
 }finally{store.close();}
});
test('GraphQL payload uses real variants with no reservation, payment or price override',async()=>{
 const calls=[];const shopify=new Shopify({SHOPIFY_SHOP:'test.myshopify.com',SHOPIFY_ADMIN_ACCESS_TOKEN:'secret'},async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({data:{draftOrderCreate:{draftOrder:{id:'1'},userErrors:[]}}})};});
 await shopify.create(validate(payload()),'CBX-TEST');
 assert.equal(calls.length,1);const input=calls[0].variables.input;
 assert.deepEqual(input.lineItems,[{variantId:'gid://shopify/ProductVariant/123',quantity:50000}]);
 for(const forbidden of ['reserveInventoryUntil','paymentTerms','priceOverride','purchasingEntity'])assert.equal(input[forbidden],undefined);
 assert.ok(!/draftOrderComplete|draftOrderInvoiceSend/.test(calls[0].query));
});
test('catalog eligibility checks publication, not inventory availability',async()=>{
 const shopify=new Shopify({SHOPIFY_SHOP:'test.myshopify.com',SHOPIFY_ADMIN_ACCESS_TOKEN:'secret',SHOPIFY_PUBLICATION_ID:'gid://shopify/Publication/1'},async(url,options)=>{
  const request=JSON.parse(options.body);assert.ok(!/inventoryQuantity|availableForSale/.test(request.query));
  return {ok:true,json:async()=>({data:{nodes:[{id:'gid://shopify/ProductVariant/123',product:{status:'ACTIVE',publishedOnPublication:true}}]}})};
 });
 await shopify.validateVariants([{id:'123',quantity:1000000}]);
});
