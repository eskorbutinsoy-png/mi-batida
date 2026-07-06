-- Security recovery health check
-- Run this in Supabase SQL Editor to validate recovery prerequisites.

select 'pgcrypto_installed' as check_name,
       exists (select 1 from pg_extension where extname = 'pgcrypto') as ok
union all
select 'perfiles_pregunta_col',
       exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'perfiles'
           and column_name = 'pregunta_seguridad'
       )
union all
select 'perfiles_respuesta_hash_col',
       exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'perfiles'
           and column_name = 'respuesta_seguridad_hash'
       )
union all
select 'fn_get_question_exists',
       exists (
         select 1
         from information_schema.routines
         where routine_schema = 'public'
           and routine_name = 'get_security_question_by_email'
       )
union all
select 'fn_reset_password_exists',
       exists (
         select 1
         from information_schema.routines
         where routine_schema = 'public'
           and routine_name = 'reset_password_with_security_answer'
       )
union all
select 'fn_reset_uses_extensions_gen_salt',
       coalesce((
         select pg_get_functiondef(p.oid) ilike '%extensions.gen_salt%'
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = 'reset_password_with_security_answer'
         limit 1
       ), false)
union all
select 'fn_reset_search_path_has_extensions',
       coalesce((
         select array_to_string(p.proconfig, ',') ilike '%search_path=public, auth, extensions%'
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = 'reset_password_with_security_answer'
         limit 1
       ), false)
union all
select 'grant_get_question_anon_authenticated',
       exists (
         select 1
         from information_schema.routine_privileges
         where specific_schema = 'public'
           and routine_name = 'get_security_question_by_email'
           and grantee in ('anon', 'authenticated')
           and privilege_type = 'EXECUTE'
       )
union all
select 'grant_reset_password_anon_authenticated',
       exists (
         select 1
         from information_schema.routine_privileges
         where specific_schema = 'public'
           and routine_name = 'reset_password_with_security_answer'
           and grantee in ('anon', 'authenticated')
           and privilege_type = 'EXECUTE'
       );
