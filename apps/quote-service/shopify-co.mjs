import { InputError } from './core-co.mjs';
export class Shopify {
  constructor(env,fetcher=fetch) { this.env=env; this.fetch=fetcher; }
  async token() {
    if(this.env.SHOPIFY_ADMIN_ACCESS_TOKEN) return this.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    if(this.cachedToken&&this.tokenExpires>Date.now()+60000) return this.cachedToken;
    if(!this.tokenRequest) this.tokenRequest=(async()=>{
      const response=await this.fetch(`https://${this.env.SHOPIFY_SHOP}/admin/oauth/access_token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:this.env.SHOPIFY_CLIENT_ID,client_secret:this.env.SHOPIFY_API_SECRET}),signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error('Shopify authentication failed');
      const data=await response.json();if(!data.access_token||!data.expires_in)throw new Error('Invalid Shopify token');
      this.cachedToken=data.access_token;this.tokenExpires=Date.now()+data.expires_in*1000;return this.cachedToken;
    })().finally(()=>{this.tokenRequest=null;});
    return this.tokenRequest;
  }
  async graphql(query,variables) {
    const response=await this.fetch(`https://${this.env.SHOPIFY_SHOP}/admin/api/${this.env.SHOPIFY_API_VERSION||'2026-10'}/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':await this.token()},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw new Error('Shopify unavailable');
    const result=await response.json(); if(result.errors?.length) throw new Error('Shopify GraphQL error'); return result.data;
  }
  async validateVariants(lines) {
    const data=await this.graphql(`query QuoteVariants($ids:[ID!]!,$publication:ID!){nodes(ids:$ids){... on ProductVariant{id product{status publishedOnPublication(publicationId:$publication)}}}}`,{ids:lines.map(x=>`gid://shopify/ProductVariant/${x.id}`),publication:this.env.SHOPIFY_PUBLICATION_ID});
    if(data.nodes.length!==lines.length || data.nodes.some((node,index)=>!node || node.id!==`gid://shopify/ProductVariant/${lines[index].id}` || node.product.status!=='ACTIVE' || !node.product.publishedOnPublication)) throw new InputError('Un producto ya no está disponible para cotizar. Revisá la selección.');
    // No availability, inventory quantity, inventory policy or stock comparison.
  }
  async create(payload,reference) {
    const {contact,lines}=payload;
    const input={email:contact.email,phone:contact.whatsapp,note:contact.notes,tags:['COTIZACION_WEB',reference],customAttributes:[{key:'Solicitud',value:reference},...['name','company','cuit','province','locality','privacy'].map(key=>({key,value:String(contact[key] || '')}))],lineItems:lines.map(line=>({variantId:`gid://shopify/ProductVariant/${line.id}`,quantity:line.quantity}))};
    // Deliberately omit inventory reservation, payment terms, completion and invoice sending.
    return (await this.graphql('mutation QuoteCreate($input:DraftOrderInput!){draftOrderCreate(input:$input){draftOrder{id name status} userErrors{field message}}}',{input})).draftOrderCreate;
  }
  async reconcile(reference) {
    const data=await this.graphql('query QuoteReconcile($query:String!){draftOrders(first:2,query:$query){nodes{id name tags}}}',{query:`tag:${reference}`});
    const matches=data.draftOrders.nodes.filter(x=>x.tags.includes(reference));
    return matches.length===1?matches[0]:null;
  }
}
