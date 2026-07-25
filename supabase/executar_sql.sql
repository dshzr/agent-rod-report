-- Rode no SQL Editor do Supabase (uma vez).
-- Função read-only: apenas SELECT / WITH ... SELECT.

create or replace function public.executar_sql(p_query text, p_max_rows int default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '15s'
as $$
declare
  q text := btrim(p_query);
  q_check text;
  lim int := least(greatest(coalesce(p_max_rows, 200), 1), 500);
  result jsonb;
begin
  if q is null or q = '' then
    raise exception 'Query vazia';
  end if;

  -- Um statement só (permite ; no final)
  q := regexp_replace(q, ';\s*$', '');
  if position(';' in q) > 0 then
    raise exception 'Apenas um statement é permitido';
  end if;

  q_check := lower(q);
  q_check := regexp_replace(q_check, '--[^\n]*', ' ', 'g');
  q_check := regexp_replace(q_check, '/\*.*?\*/', ' ', 'g');
  q_check := btrim(q_check);

  if q_check !~ '^(with|select)(\s|\()' then
    raise exception 'Apenas SELECT é permitido';
  end if;

  if q_check ~ '(^|[^a-z_])(insert|update|delete|merge|drop|alter|truncate|create|grant|revoke|copy|call|execute|do|refresh|reindex|vacuum|cluster|comment|security)([^a-z_]|$)' then
    raise exception 'Comando não permitido (somente SELECT)';
  end if;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)
     from (
       select * from (%s) as q
       limit %s
     ) as t',
    q,
    lim
  ) into result;

  return jsonb_build_object(
    'rows', result,
    'count', jsonb_array_length(result)
  );
end;
$$;

revoke all on function public.executar_sql(text, int) from public;
grant execute on function public.executar_sql(text, int) to service_role;
-- opcional: liberar authenticated/anon se quiser (não recomendado)
-- grant execute on function public.executar_sql(text, int) to authenticated;
