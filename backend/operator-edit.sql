create or replace function public.digiturno_v2(action text, payload jsonb default '{}', session_token text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 a public.dt_accounts; target public.dt_accounts; s jsonb; arr jsonb; response jsonb; new_box text; new_name text; new_pin text;
begin
 -- Serializa la edición y las operaciones que dependen de la identidad del box.
 perform pg_advisory_xact_lock(hashtext('digiturno_operator_edits'));
 if action='profile' then
   select * into a from public.dt_accounts where box=(select box from public.dt_sessions where token_hash=encode(extensions.digest(session_token,'sha256'),'hex') and expires_at>now());
   if a.box is null then return jsonb_build_object('error','Sesión finalizada. Ingrese nuevamente.'); end if;
   return jsonb_build_object('sessionUser',jsonb_build_object('name',a.name,'box',a.box,'pin',a.box,'role',a.role));
 end if;
 if action<>'account_update' then
   response=public.digiturno_api(action,payload,session_token);
   if action='snapshot' then
     select * into a from public.dt_accounts where box=(select box from public.dt_sessions where token_hash=encode(extensions.digest(session_token,'sha256'),'hex') and expires_at>now());
     if a.box is not null then response=response||jsonb_build_object('sessionUser',jsonb_build_object('name',a.name,'box',a.box,'pin',a.box,'role',a.role)); end if;
   end if;
   return response;
 end if;
 select * into a from public.dt_accounts where box=(select box from public.dt_sessions where token_hash=encode(extensions.digest(session_token,'sha256'),'hex') and expires_at>now());
 if a.role is distinct from 'admin' then return jsonb_build_object('error','Se requiere acceso de administrador'); end if;
 new_box=trim(coalesce(payload->>'box','')); new_name=trim(coalesce(payload->>'name','')); new_pin=coalesce(payload->>'pin','');
 if length(new_name)=0 or length(new_box)=0 or length(new_name)>120 or length(new_box)>120 or new_box='admin' then return jsonb_build_object('error','Ingrese nombre y box válidos (máximo 120 caracteres)'); end if;
 if new_pin<>'' and new_pin !~ '^\d{4}$' then return jsonb_build_object('error','El PIN debe tener 4 dígitos'); end if;
 select data into s from public.dt_state where id=true for update;
 select * into target from public.dt_accounts where box=payload->>'originalBox' and role='operator' for update;
 if not found then return jsonb_build_object('error','El operador ya no existe. Actualice la lista.'); end if;
 if exists(select 1 from public.dt_accounts where box=new_box and box<>target.box) then return jsonb_build_object('error','Ese nombre de box ya existe'); end if;
 if new_box<>target.box then
   -- Primero crea la nueva identidad; así las sesiones siempre referencian un box válido.
   insert into public.dt_accounts(box,name,hash,role,preferences,failures,locked_until) values(new_box,new_name,target.hash,target.role,target.preferences,target.failures,target.locked_until);
   update public.dt_sessions set box=new_box where box=target.box;
   select coalesce(jsonb_agg(case when x->>'pin'=target.box then jsonb_set(x,'{pin}',to_jsonb(new_box)) else x end),'[]') into arr from jsonb_array_elements(s->'opHistory') x;
   update public.dt_state set data=jsonb_set(s,'{opHistory}',arr),revision=revision+1 where id=true;
   delete from public.dt_accounts where box=target.box and role='operator';
 end if;
 update public.dt_accounts set name=new_name,hash=case when new_pin='' then hash else extensions.crypt(new_pin,extensions.gen_salt('bf',10)) end,failures=case when new_pin='' then failures else 0 end,locked_until=case when new_pin='' then locked_until else null end where box=new_box;
 if new_pin<>'' then delete from public.dt_sessions where box=new_box; end if;
 return jsonb_build_object('updated',true);
end;
$$;
-- La función nueva solo se puede ejecutar desde el servidor; las tablas siguen protegidas.
revoke all on function public.digiturno_v2(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.digiturno_v2(text,jsonb,text) to service_role;
