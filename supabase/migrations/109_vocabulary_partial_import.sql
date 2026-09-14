-- Keep the existing validated import upsert and split large results atomically.
alter table public.vocabulary_imports add column if not exists partial_words jsonb not null default '{}';
create or replace function public.save_vocabulary_extraction(
  p_import uuid, p_chunk integer, p_entries jsonb, p_complete boolean default true
) returns integer language plpgsql security definer set search_path=public as $$
declare imp vocabulary_imports; batch jsonb; offset_index integer:=0; saved integer:=0;
begin
  select * into imp from vocabulary_imports where id=p_import and user_id=auth.uid() for update;
  if not found then raise exception 'Import not found'; end if;
  if p_chunk<0 or p_chunk>=jsonb_array_length(imp.chunks) then raise exception 'Invalid chunk'; end if;
  if p_chunk=any(imp.completed_chunks) then return 0; end if;
  if p_entries is null or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>2000 then raise exception 'Invalid entries'; end if;
  loop
    select coalesce(jsonb_agg(value order by ordinal),'[]'::jsonb) into batch
      from jsonb_array_elements(p_entries) with ordinality as entries(value,ordinal)
      where ordinal>offset_index and ordinal<=offset_index+150;
    saved:=saved+save_vocabulary_chunk(p_import,p_chunk,batch);
    update vocabulary_imports set completed_chunks=array_remove(completed_chunks,p_chunk) where id=p_import;
    offset_index:=offset_index+150;
    exit when offset_index>=jsonb_array_length(p_entries);
  end loop;
  if p_complete then
    update vocabulary_imports set completed_chunks=array_append(completed_chunks,p_chunk),partial_words=partial_words-p_chunk::text where id=p_import;
  else
    update vocabulary_imports set partial_words=jsonb_set(partial_words,array[p_chunk::text],
      (select coalesce(jsonb_agg(distinct value),'[]'::jsonb) from jsonb_array_elements(
        coalesce(partial_words->p_chunk::text,'[]'::jsonb) ||
        (select coalesce(jsonb_agg(value->'word'),'[]'::jsonb) from jsonb_array_elements(p_entries))))) where id=p_import;
  end if;
  return saved;
end $$;
revoke all on function public.save_vocabulary_extraction(uuid,integer,jsonb,boolean) from public,anon;
grant execute on function public.save_vocabulary_extraction(uuid,integer,jsonb,boolean) to authenticated;
