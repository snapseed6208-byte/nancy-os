-- TEM8 v1 reuses the existing auth/database/AI infrastructure. Original text is immutable on reimport.
create table public.vocabulary_imports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, fingerprint text not null, chunks jsonb not null,
  chunk_count integer generated always as (jsonb_array_length(chunks)) stored,
  completed_chunks integer[] not null default '{}', created_at timestamptz not null default now(),
  unique(user_id, fingerprint)
);
create table public.vocabulary_words (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  word text not null, pos text not null default '', meaning text not null default '',
  type text not null default 'new' check(type in ('new','familiar','collocation','academic','listening')),
  sources jsonb not null default '[]', enrichment jsonb,
  level text not null default 'R0' check(level in ('R0','R1','R2','P1','P2')),
  status text not null default 'inbox' check(status in ('inbox','learning','review','error','stable')),
  review_stage integer not null default 0 check(review_stage between 0 and 5), due_at timestamptz,
  error_count integer not null default 0, version integer not null default 0,
  created_at timestamptz not null default now(), unique(user_id, word)
);
create index vocabulary_due on public.vocabulary_words(user_id, due_at);
create table public.vocabulary_errors (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.vocabulary_words(id) on delete cascade,
  interpretation text not null, actual_meaning text not null, error_type text not null,
  root_cause text not null, transferable_rule text not null, created_at timestamptz not null default now()
);
alter table public.vocabulary_imports enable row level security;
alter table public.vocabulary_words enable row level security;
alter table public.vocabulary_errors enable row level security;
create policy vocabulary_import_owner on public.vocabulary_imports for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy vocabulary_word_owner on public.vocabulary_words for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy vocabulary_error_owner on public.vocabulary_errors for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
grant select, insert, update, delete on public.vocabulary_imports, public.vocabulary_words, public.vocabulary_errors to authenticated;

-- One transaction per batch: retries never duplicate sources or overwrite learning progress.
create function public.save_vocabulary_chunk(p_import uuid, p_chunk integer, p_entries jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare imp vocabulary_imports; item jsonb; src jsonb; normalized text; count_saved integer := 0;
begin
  select * into imp from vocabulary_imports where id = p_import and user_id = auth.uid() for update;
  if not found then raise exception 'Import not found'; end if;
  if p_chunk < 0 or p_chunk >= jsonb_array_length(imp.chunks) then raise exception 'Invalid chunk'; end if;
  if p_chunk = any(imp.completed_chunks) then return 0; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) > 150 then raise exception 'Invalid entries'; end if;
  for item in select value from jsonb_array_elements(p_entries) loop
    normalized := lower(regexp_replace(trim(item->>'word'), '\s+', ' ', 'g'));
    if normalized is null or length(normalized) = 0 or length(normalized) > 120 then raise exception 'Invalid word'; end if;
    src := jsonb_build_array(jsonb_build_object('import_id',imp.id,'name',imp.name,'original',item->>'original','context',item->>'context'));
    insert into vocabulary_words(user_id,word,pos,meaning,type,sources)
    values(auth.uid(),normalized,coalesce(item->>'pos',''),coalesce(item->>'meaning',''),coalesce(item->>'type','new'),src)
    on conflict(user_id,word) do update set sources = (
      select coalesce(jsonb_agg(distinct value),'[]') from jsonb_array_elements(vocabulary_words.sources || excluded.sources)
    );
    count_saved := count_saved + 1;
  end loop;
  update vocabulary_imports set completed_chunks = array_append(completed_chunks,p_chunk) where id = p_import;
  return count_saved;
end $$;

-- Optimistic version prevents double submissions / concurrent tabs advancing twice.
create function public.review_vocabulary(p_word uuid, p_version integer, p_correct boolean, p_interpretation text default '', p_cause text default '')
returns void language plpgsql security invoker set search_path = public as $$
declare w vocabulary_words; next_stage integer; target text;
begin
  select * into w from vocabulary_words where id = p_word and user_id = auth.uid() for update;
  if not found then raise exception 'Word not found'; end if;
  if w.version <> p_version then raise exception '记录已更新，请刷新后重试'; end if;
  if w.due_at > now() then raise exception '尚未到复习时间'; end if;
  if not p_correct and length(trim(p_interpretation)) = 0 then raise exception '请记录你的理解'; end if;
  next_stage := case when p_correct then least(w.review_stage + 1,5) else 0 end;
  -- v1 is recognition self-assessment; production proficiency must not be inferred.
  target := case when p_correct then case when next_stage >= 3 then 'R2' else 'R1' end else 'R0' end;
  update vocabulary_words set review_stage = next_stage,
    level = target, status = case when not p_correct then 'error' when next_stage = 5 then 'stable' else 'review' end,
    due_at = now() + make_interval(days => (array[1,1,3,7,14,30])[next_stage + 1]),
    error_count = error_count + case when p_correct then 0 else 1 end, version = version + 1
  where id = w.id;
  if not p_correct then
    insert into vocabulary_errors(user_id,word_id,interpretation,actual_meaning,error_type,root_cause,transferable_rule)
    values(auth.uid(),w.id,left(p_interpretation,2000),coalesce(w.enrichment->>'tem8_meaning',w.meaning),w.type,
      left(coalesce(nullif(trim(p_cause),''),'尚未判断'),2000),coalesce(w.enrichment->>'trigger','结合原文语境重新识别词义'));
  end if;
end $$;
revoke all on function public.save_vocabulary_chunk(uuid,integer,jsonb) from public, anon;
revoke all on function public.review_vocabulary(uuid,integer,boolean,text,text) from public, anon;
grant execute on function public.save_vocabulary_chunk(uuid,integer,jsonb) to authenticated;
grant execute on function public.review_vocabulary(uuid,integer,boolean,text,text) to authenticated;
