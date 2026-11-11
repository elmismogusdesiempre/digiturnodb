// Endpoint adicional dedicado a edición, identidad y operaciones de boxes.
// No modifica el endpoint principal ni sus rutas de descarga/autenticación.
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return new Response(JSON.stringify({error:'Método no permitido'}),{status:405,headers});
 try{
  const raw=await req.text();if(raw.length>20000)return new Response(JSON.stringify({error:'Solicitud demasiado grande'}),{status:413,headers});
  const {action,payload={},token=''}=JSON.parse(raw);
  if(!['account_update','profile','next','notes','preferences'].includes(action)||typeof token!=='string'||!token||!payload||typeof payload!=='object'||Array.isArray(payload))return new Response(JSON.stringify({error:'Solicitud inválida o sesión ausente'}),{status:400,headers});
  const response=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/digiturno_v2',{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,Authorization:'Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'},body:JSON.stringify({action,payload,session_token:token})});
  if(!response.ok){console.error('Operator API failed',response.status);return new Response(JSON.stringify({error:'No fue posible completar la operación del box'}),{status:500,headers});}
  return new Response(await response.text(),{headers});
 }catch{return new Response(JSON.stringify({error:'Solicitud inválida'}),{status:400,headers});}
});
