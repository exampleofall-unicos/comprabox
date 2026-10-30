import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {Liquid} from 'liquidjs';
import {JSDOM,VirtualConsole} from 'jsdom';
const root=resolve(import.meta.dirname,'../../..');
const source=path=>readFileSync(resolve(root,path),'utf8');
const engine=new Liquid({root:resolve(root,'snippets'),extname:'.liquid',globals:{shop:{currency:'ARS'},localization:{country:{currency:{iso_code:'ARS'}}}}});
engine.registerFilter('json',JSON.stringify);engine.registerFilter('image_url',()=> 'https://cdn.shopify.com/termo.jpg');
const routes={cart_url:'/cart',root_url:'/',all_products_collection_url:'/collections/all'};
const context={routes,shop:{currency:'ARS',privacy_policy:{url:'/policies/privacy-policy'}},section:{id:'co',settings:{show_estimates:true,heading:'Datos para tu cotización'}},product:{id:1,title:'Termo <img src=x onerror=alert(1)>',url:'/products/termo',has_only_default_variant:true,featured_image:{id:3},selected_or_first_available_variant:{id:'123',sku:'TER-NEG',price:150000,currency:'ARS',title:'Negro',available:false}}};
const section=async name=>engine.parseAndRender(source(`sections/${name}.liquid`).split('{% schema %}')[0],context);
const line={id:'123',productId:'1',title:'Termo',variant:'Negro',sku:'TER-NEG',price:150000,currency:'ARS',quantity:100,image:'https://cdn.shopify.com/termo.jpg'};
async function browser({enabled=false,fetcher,stored=[],pending=null}={}){
 const html=`<script id="quote-defaults-co" type="application/json">{"shop":"comprabox-2.myshopify.com","root":"/","currency":"ARS","designMode":false}</script><script id="quote-settings-co" type="application/json">${JSON.stringify({enabled,endpoint:'/apps/comprabox-quotes',siteKey:enabled?'test':''})}</script><span data-co-count></span><product-info-co data-url="/products/termo?view=producto-co" data-section="co" data-update-url="true">${await engine.renderFile('quote-quantity-co',context)}${await engine.renderFile('buy-buttons-co',context)}</product-info-co>${await section('main-cart-items-co')}${await section('main-cart-footer-co')}${await section('quote-form-co')}`;
 const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>{throw error;});
 const dom=new JSDOM(html,{url:'https://comprabox-2.myshopify.com/cart?view=cotizador-co',runScripts:'outside-only',virtualConsole});
 dom.window.structuredClone=structuredClone;dom.window.AbortSignal.timeout=AbortSignal.timeout;
 dom.window.fetch=fetcher||(()=>assert.fail('Unexpected network request'));
 dom.window.localStorage.setItem('comprabox.co.v1:comprabox-2.myshopify.com',JSON.stringify(stored));
 if(pending)dom.window.localStorage.setItem('comprabox.co.v1:comprabox-2.myshopify.com:pending',JSON.stringify(pending));
 dom.window.turnstile={render:(node,options)=>{queueMicrotask(()=>options.callback('test'));return 1;},reset:()=>{},remove:()=>{}};
 for(const name of ['quote-store','quote-navigation','product-info','quote-cart','quote-form'])dom.window.eval(source(`assets/${name}-co.js`));
 await Promise.resolve();return dom;
}
function fill(dom){const form=dom.window.document.querySelector('[data-co-form]');for(const [key,value] of Object.entries({name:'Cliente',email:'cliente@example.com',whatsapp:'+5491112345678',province:'Buenos Aires',locality:'La Plata'}))form.elements.namedItem(key).value=value;form.elements.namedItem('privacy').checked=true;return form;}
test('all 413 protected files remain byte-identical, including uncommitted preexisting changes',()=>{
 const manifest=JSON.parse(source('docs/protected-files-co.json'));
 for(const [path,hash] of Object.entries(manifest.protected))assert.equal(createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex'),hash,path);
 for(const [path,record] of Object.entries(manifest.copies))assert.equal(record.sha256_at_copy,manifest.protected[record.source],path);
});
test('Co templates select a separate layout and preserve original template sections',()=>{
 for(const name of ['product.producto-co','product.ter-mm-1000-ngr-co','cart.cotizador-co','page.cotizador-co','collection.catalogo-co','search.busqueda-co','index.inicio-co'])assert.equal(JSON.parse(source(`templates/${name}.json`)).layout,'theme-co');
 const original=JSON.parse(source('templates/product.json').replace(/^\/\*[\s\S]*?\*\//,''));const co=JSON.parse(source('templates/product.producto-co.json'));
 assert.deepEqual(co.sections.main.settings,original.sections.main.settings);assert.deepEqual(co.sections.main.blocks,original.sections.main.blocks);
});

test('Co section groups use Shopify-compatible types and keep their own configuration',()=>{
 assert.equal(JSON.parse(source('sections/header-group-co.json')).type,'header');
 assert.equal(JSON.parse(source('sections/footer-group-co.json')).type,'footer');
 const group=JSON.parse(source('sections/quote-config-group-co.json'));
 assert.match(group.type,/^custom\.[a-zA-Z0-9]+$/);
 assert.equal(group.sections.configco.settings.enabled,false);
 assert.match(source('layout/theme-co.liquid'),/sections 'quote-config-group-co'/);
 assert.doesNotMatch(source('layout/theme-co.liquid'),/section 'quote-settings-co'/);
});

test('changing a variant retains the quantity and adds the newly rendered variant',async()=>{
 let requested;
 const html=`<product-info-co data-section="co" data-url="/products/termo" data-update-url="true"><select data-co-option><option value="88">Azul</option></select><input data-co-quantity value="1" type="number" min="1"><button data-co-add>Agregar a cotización</button><p data-co-product-status></p><script data-co-variant type="application/json">${JSON.stringify({...line,id:'456',variant:'Azul'})}</script></product-info-co>`;
 const dom=await browser({fetcher:async url=>{requested=url;return {ok:true,text:async()=>html};}});
 try{
  const doc=dom.window.document,product=doc.querySelector('product-info-co');
  product.dataset.updateUrl='false';
  const options=doc.createElement('div');options.dataset.coOptions='';options.innerHTML='<select data-co-option><option value="88">Azul</option></select>';product.append(options);
  // The primary product path is exercised with the actual product template view.
  dom.reconfigure({url:'https://comprabox-2.myshopify.com/products/termo?view=producto-co&preview_theme_id=192174883128'});product.dataset.updateUrl='true';
  doc.querySelector('[data-co-quantity]').value='100';
  await product.select(product.querySelector('select'));
  assert.equal(requested.searchParams.get('option_values'),'88');assert.equal(requested.searchParams.get('preview_theme_id'),'192174883128');assert.equal(requested.searchParams.get('view'),'producto-co');
  doc.querySelector('[data-co-add]').click();
  const added=dom.window.CompraboxCo.read()[0];assert.equal(added.id,'456');assert.equal(added.quantity,100);assert.equal(added.variant,'Azul');
 }finally{dom.window.close();}
});
test('stock-zero variant accepts requested quantities and retains SKU, image and reference price',async()=>{
 const dom=await browser();try{
  const doc=dom.window.document;doc.querySelector('[data-co-quantity]').value='100';doc.querySelector('[data-co-add]').click();
  const saved=dom.window.CompraboxCo.read()[0];assert.equal(saved.quantity,100);assert.equal(saved.sku,'TER-NEG');assert.equal(saved.price,150000);assert.match(saved.image,/cdn.shopify.com/);
  assert.equal(doc.querySelector('[data-co-count]').textContent,'100');assert.equal(doc.querySelectorAll('.co-line').length,1);assert.equal(doc.querySelectorAll('[onerror]').length,0);
  const input=doc.querySelector('.co-line input');input.focus();input.value='200';input.dispatchEvent(new dom.window.Event('input'));assert.equal(dom.window.CompraboxCo.read()[0].quantity,200);assert.equal(doc.activeElement,input);assert.match(doc.querySelector('[data-co-summary]').textContent,/200 unidades/);
  input.value='';input.dispatchEvent(new dom.window.Event('input'));assert.equal(dom.window.CompraboxCo.read()[0].quantity,200);assert.equal(input.checkValidity(),false);
  doc.querySelector('.co-line button').click();assert.equal(dom.window.CompraboxCo.read().length,0);
 }finally{dom.window.close();}
});
test('company and CUIT are optional; consent and locality are required',async()=>{
 const dom=await browser({stored:[line]});try{
  const form=fill(dom);assert.equal(form.elements.company.required,false);assert.equal(form.elements.cuit.required,false);assert.equal(form.checkValidity(),true);
  form.elements.locality.value='';assert.equal(form.checkValidity(),false);form.elements.locality.value='La Plata';form.elements.privacy.checked=false;assert.equal(form.checkValidity(),false);
 }finally{dom.window.close();}
});
test('confirmation sends variants and quantities without browser prices and clears only after a real receipt',async()=>{
 let request;
 const dom=await browser({enabled:true,stored:[line],fetcher:async(url,options)=>{assert.match(url.pathname,/\/requests$/);request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'confirmed',reference:'CBX-TEST'})};}});
 try{fill(dom);await dom.window.document.querySelector('quote-form-co').submit();assert.deepEqual(request.lines,[{id:'123',quantity:100}]);assert.equal(request.contact.privacy,true);assert.equal(request.contact.locality,'La Plata');assert.equal(dom.window.CompraboxCo.read().length,0);assert.match(dom.window.document.querySelector('[data-co-status]').textContent,/CBX-TEST/);}finally{dom.window.close();}
});
test('lost response keeps the selection and status checks never recreate a request',async()=>{
 let calls=0;const dom=await browser({enabled:true,stored:[line],fetcher:async url=>{calls++;if(url.pathname.endsWith('/requests'))throw new Error('Network lost');assert.match(url.pathname,/\/status$/);return {ok:true,json:async()=>({status:'pending'})};}});
 try{fill(dom);const form=dom.window.document.querySelector('quote-form-co');await form.submit();const id=dom.window.CompraboxCo.readPending().id;await form.submit();assert.equal(calls,1);await form.check();assert.equal(calls,2);assert.equal(dom.window.CompraboxCo.readPending().id,id);assert.equal(dom.window.CompraboxCo.read()[0].quantity,100);}finally{dom.window.close();}
});
test('links stay within Co, including dynamic checkout links and search forms',async()=>{
 const dom=await browser();try{
  const doc=dom.window.document,anchor=doc.createElement('a');anchor.href='/checkout';doc.body.append(anchor);
  await new Promise(resolve=>setImmediate(resolve));assert.match(anchor.href,/cart\?view=cotizador-co/);
  anchor.href='/products/test?variant=10';await new Promise(resolve=>setImmediate(resolve));assert.match(anchor.href,/view=producto-co/);assert.match(anchor.href,/variant=10/);
  const form=doc.createElement('form');form.method='get';form.action='/search';doc.body.append(form);await new Promise(resolve=>setImmediate(resolve));assert.equal(form.querySelector('input[name="view"]').value,'busqueda-co');
 }finally{dom.window.close();}
});
test('estimates sum per currency and stored malicious strings never become markup',async()=>{
 const dom=await browser({stored:[{...line,title:'<img onerror=alert(1)>',quantity:2}]});try{
  const doc=dom.window.document;assert.match(doc.querySelector('[data-co-estimates]').textContent,/3\.000/);assert.equal(doc.querySelectorAll('[onerror]').length,0);
 }finally{dom.window.close();}
});
test('JSON metadata safely encodes closing script tags',async()=>{
 const html=await engine.renderFile('quote-variant-data-co',{...context,product:{...context.product,title:'</script><img src=x onerror=alert(1)>'}});
 const dom=new JSDOM(html);try{assert.equal(dom.window.document.querySelectorAll('[onerror]').length,0);assert.equal(JSON.parse(dom.window.document.querySelector('script').textContent).title,'</script><img src=x onerror=alert(1)>');}finally{dom.window.close();}
});

test('Co product links retain recommendation parameters and fragments',async()=>{
 const html=await engine.renderFile('quote-card-button-co',{product:{url:'/products/test?pr_seq=uniform&variant=123#details'}});
 const dom=new JSDOM(html,{url:'https://comprabox.com.ar'});try{
  const url=new URL(dom.window.document.querySelector('a').href);
  assert.equal(url.searchParams.get('pr_seq'),'uniform');assert.equal(url.searchParams.get('variant'),'123');assert.equal(url.searchParams.get('view'),'producto-co');assert.equal(url.hash,'#details');
 }finally{dom.window.close();}
});
