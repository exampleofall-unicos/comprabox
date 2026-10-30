import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validate,InputError} from '../core-co.mjs';
import {Shopify} from '../shopify-co.mjs';
const body=()=>({requestId:randomUUID(),lines:[{id:'123',quantity:100}],contact:{name:'Cliente',company:'',cuit:'',email:'cliente@example.com',whatsapp:'+5491112345678',province:'Buenos Aires',locality:'La Plata',privacy:true}});

test('malformed request objects fail as client errors rather than service failures',()=>{
 for(const input of [null,[],false,{...body(),lines:[null]}])assert.throws(()=>validate(input),InputError);
});
test('server accepts optional company and CUIT but requires locality and explicit consent',()=>{
 assert.equal(validate(body()).contact.company,'');
 for(const [field,value] of [['locality',''],['privacy',false],['privacy','true'],['cuit','invalid']]){const input=body();input.contact[field]=value;assert.throws(()=>validate(input));}
});
test('Draft Order includes COTIZACION_WEB and commercial fields with no payment or reservation',async()=>{
 let request;const client=new Shopify({SHOPIFY_SHOP:'comprabox-2.myshopify.com',SHOPIFY_ADMIN_ACCESS_TOKEN:'test'},async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({data:{draftOrderCreate:{draftOrder:{id:'1'},userErrors:[]}}})};});
 await client.create(validate(body()),'CBX-TEST');const input=request.variables.input;
 assert.ok(input.tags.includes('COTIZACION_WEB'));assert.equal(input.reserveInventoryUntil,undefined);assert.deepEqual(input.lineItems,[{variantId:'gid://shopify/ProductVariant/123',quantity:100}]);assert.ok(input.customAttributes.some(item=>item.key==='locality'&&item.value==='La Plata'));assert.ok(input.customAttributes.some(item=>item.key==='privacy'&&item.value==='true'));
});
