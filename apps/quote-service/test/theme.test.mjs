import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Liquid } from 'liquidjs';
import { JSDOM, VirtualConsole } from 'jsdom';
const root=resolve(import.meta.dirname,'../../..');
const source=path=>readFileSync(resolve(root,path),'utf8');
const engine=new Liquid({root:resolve(root,'snippets'),extname:'.liquid'});
engine.registerFilter('json',JSON.stringify);
engine.registerFilter('t',value=>value);
const routes={cart_url:'/cart',all_products_collection_url:'/collections/all'};
const product={id:1,title:'Termo <img src=x onerror=alert(1)>',url:'/products/termo',description:'<p>Acero inoxidable.</p>',has_only_default_variant:true,selected_or_first_available_variant:{id:'123',title:'Negro',available:false}};
async function markup(){return await engine.renderFile('quote-product',{product,section:{id:'quote'}})+await engine.renderFile('quote-cart',{routes,shop:{}});}
async function browser({siteKey='',fetcher,stored=[]}={}) {
 const config={shop:'test.myshopify.com',url:'/cart',endpoint:'/apps/comprabox-quotes',siteKey,designMode:false};
 const virtualConsole = new VirtualConsole();virtualConsole.on('jsdomError',error=>{throw error;});
 const dom=new JSDOM(`<script id="comprabox-quote-config" type="application/json">${JSON.stringify(config)}</script><span data-quote-count></span>${await markup()}`,{url:'https://test.myshopify.com/products/termo',runScripts:'outside-only',virtualConsole});
 dom.window.structuredClone=structuredClone;dom.window.AbortSignal.timeout=AbortSignal.timeout;
 dom.window.fetch=fetcher||(()=>assert.fail('Unexpected network request'));
 dom.window.localStorage.setItem('comprabox.quote.v1:test.myshopify.com',JSON.stringify(stored));
 dom.window.turnstile={render:(element,options)=>{queueMicrotask(()=>options.callback('test-token'));return 1;},reset:()=>{},remove:()=>{}};
 dom.window.eval(source('assets/quote.js'));await Promise.resolve();return dom;
}
test('sold-out real variant can be added above stock without native cart calls',async()=>{
 const dom=await browser();try{
  const doc=dom.window.document;
  doc.querySelector('[data-quote-quantity]').value='30000';doc.querySelector('[data-quote-add]').click();
  assert.equal(dom.window.CompraboxQuote.read()[0].quantity,30000);
  assert.equal(doc.querySelector('[data-quote-count]').textContent,'30000');
  doc.querySelector('[data-quote-add]').click();assert.equal(dom.window.CompraboxQuote.read()[0].quantity,60000);
  assert.equal(doc.querySelectorAll('[onerror]').length,0);
  const quantity=doc.querySelector('.quote-line input');quantity.value='90000';quantity.dispatchEvent(new dom.window.Event('change'));
  assert.equal(dom.window.CompraboxQuote.read()[0].quantity,90000);
  assert.equal(doc.querySelector('button[type=submit]').disabled,true);
 }finally{dom.window.close();}
});
test('storage quota failure keeps the current selection in memory',async()=>{
 const dom=await browser();try{
  dom.window.Storage.prototype.setItem=()=>{throw new Error('Quota exceeded');};
  dom.window.document.querySelector('[data-quote-add]').click();
  assert.equal(dom.window.CompraboxQuote.read()[0].quantity,1);
  assert.equal(dom.window.document.querySelector('[data-quote-count]').textContent,'1');
 }finally{dom.window.close();}
});
test('old and injected checkout links lead to quote confirmation, including new-tab navigation',async()=>{
 const dom=await browser();try{
  const link=dom.window.document.createElement('a');link.href='/checkout';dom.window.document.body.append(link);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(link.pathname,'/cart');
  link.href='https://test.myshopify.com/cart/123:5';await new Promise(resolve=>setImmediate(resolve));assert.equal(link.pathname,'/cart');
 }finally{dom.window.close();}
});
test('Liquid JSON cannot break out of script with a product title',async()=>{
 const html=await engine.renderFile('quote-product',{product:{...product,title:'</script><img src=x onerror=alert(1)>'},section:{id:'quote'}});
 const dom=new JSDOM(html);try{
  assert.equal(dom.window.document.querySelectorAll('[onerror]').length,0);
  assert.equal(JSON.parse(dom.window.document.querySelector('[data-quote-variant]').textContent).title,'</script><img src=x onerror=alert(1)>');
 }finally{dom.window.close();}
});
test('restores local cart and removes variants independently',async()=>{
 const dom=await browser({stored:[{id:'123',title:'Termo',variant:'Negro',quantity:20},{id:'124',title:'Termo',variant:'Azul',quantity:40}]});try{
  const doc=dom.window.document;assert.equal(doc.querySelectorAll('.quote-line').length,2);
  doc.querySelector('.quote-line button').click();assert.equal(dom.window.CompraboxQuote.read().length,1);assert.equal(dom.window.CompraboxQuote.read()[0].id,'124');
 }finally{dom.window.close();}
});
test('submits real variant IDs; only confirmed responses remove submitted quantities',async()=>{
 let received;
 const dom=await browser({siteKey:'test',stored:[{id:'123',title:'Termo',variant:'Negro',quantity:50}],fetcher:async(url,options)=>{
  received=JSON.parse(options.body);assert.ok(url.pathname.endsWith('/requests'));
  return {ok:true,json:async()=>({status:'confirmed',reference:'CBX-TEST'})};
 }});try{
  const form=dom.window.document.querySelector('form');
  for(const [key,value] of Object.entries({name:'Cliente',email:'cliente@example.com',whatsapp:'+5491112345678',company:'Empresa',province:'Buenos Aires'}))form.elements.namedItem(key).value=value;
  await dom.window.document.querySelector('quote-cart').submit();
  assert.deepEqual(received.lines,[{id:'123',quantity:50}]);assert.equal(received.contact.name,'Cliente');
  assert.equal(dom.window.CompraboxQuote.read().length,0);
  assert.match(dom.window.document.querySelector('[data-quote-status]').textContent,/CBX-TEST/);
  assert.equal(dom.window.localStorage.getItem('comprabox.quote.v1:test.myshopify.com:pending'),null);
 }finally{dom.window.close();}
});
test('lost response retains pending identity and cart; status check never resubmits',async()=>{
 let calls=0;
 const dom=await browser({siteKey:'test',stored:[{id:'123',title:'Termo',variant:'Negro',quantity:50}],fetcher:async(url)=>{
  calls++;if(url.pathname.endsWith('/requests'))throw new Error('Network lost');
  assert.ok(url.pathname.endsWith('/status'));return {ok:true,json:async()=>({status:'pending'})};
 }});try{
  const form=dom.window.document.querySelector('form');
  for(const [key,value] of Object.entries({name:'Cliente',email:'cliente@example.com',whatsapp:'+5491112345678',company:'Empresa',province:'Buenos Aires'}))form.elements.namedItem(key).value=value;
  const cart=dom.window.document.querySelector('quote-cart');await cart.submit();const id=cart.pending.id;
  await cart.submit();assert.equal(calls,1);await cart.checkPending();assert.equal(calls,2);assert.equal(cart.pending.id,id);
  assert.equal(dom.window.CompraboxQuote.read()[0].quantity,50);
  assert.ok(!dom.window.document.querySelector('[data-quote-status]').textContent.includes('recibida'));
 }finally{dom.window.close();}
});
