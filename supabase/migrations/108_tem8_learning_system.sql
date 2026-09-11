-- Full TEM8 learning loop; apply after 107. New state lives in the existing Supabase project.
alter table public.vocabulary_words
  add column target_level text not null default 'R1' check(target_level in ('R1','R2','P1','P2')),
  add column mastery jsonb not null default '{}',
  add column listening_status text not null default 'unknown' check(listening_status in ('unknown','weak','learning','stable')),
  add column listening_stage integer not null default 0 check(listening_stage between 0 and 5),
  add column listening_due_at timestamptz,
  add column last_review_day date,
  add column last_listening_day date,
  add column content_version integer not null default 0,
  add column curated boolean not null default false,
  add column archived boolean not null default false;
alter table public.vocabulary_imports add column source_kind text not null default 'vocabulary'
  check(source_kind in ('vocabulary','reading','exam','listening','error','writing'));
alter table public.vocabulary_errors add column resolved_at timestamptz, add column mode text;
alter table public.vocabulary_errors add column source_import_id uuid references public.vocabulary_imports(id) on delete set null;
create unique index vocabulary_observation_once on public.vocabulary_errors(source_import_id,word_id) where source_import_id is not null;
create index vocabulary_listening_due on public.vocabulary_words(user_id,listening_due_at) where not archived;

create table public.vocabulary_daily_plans (
  user_id uuid not null references auth.users(id) on delete cascade, day date not null,
  new_ids uuid[] not null default '{}', familiar_ids uuid[] not null default '{}', production_ids uuid[] not null default '{}',
  target integer not null check(target between 0 and 100), created_at timestamptz not null default now(),
  primary key(user_id,day)
);
alter table public.vocabulary_daily_plans enable row level security;
create policy vocabulary_plan_read on public.vocabulary_daily_plans for select to authenticated using(user_id=auth.uid());
grant select on public.vocabulary_daily_plans to authenticated;

-- A question is private: neither correct option nor solution is selectable by the browser.
create table public.vocabulary_questions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.vocabulary_words(id) on delete cascade,
  mode text not null check(mode in ('R1','R2','collocation','P1','P2','listening')),
  content_version integer not null, variant integer not null, payload jsonb not null,
  created_at timestamptz not null default now(), unique(word_id,mode,content_version,variant)
);
create table public.vocabulary_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.vocabulary_words(id) on delete cascade,
  question_id uuid not null references public.vocabulary_questions(id) on delete cascade,
  mode text not null, day date not null default (now() at time zone 'Asia/Shanghai')::date,
  word_version integer not null, answer text, feedback jsonb, score integer check(score between 0 and 100),
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique(word_id,mode,word_version,day)
);
alter table public.vocabulary_questions enable row level security;
alter table public.vocabulary_attempts enable row level security;
create policy vocabulary_attempt_read on public.vocabulary_attempts for select to authenticated using(user_id=auth.uid());
revoke all on public.vocabulary_questions from anon,authenticated;
revoke all on public.vocabulary_attempts from anon,authenticated;
grant select on public.vocabulary_attempts to authenticated;
grant all on public.vocabulary_questions, public.vocabulary_attempts, public.vocabulary_daily_plans to service_role;

-- Short, renewable-on-expiry job leases prevent duplicate paid calls across tabs/retries.
create table public.vocabulary_ai_jobs (
  user_id uuid not null references auth.users(id) on delete cascade, job_key text not null,
  token uuid not null, expires_at timestamptz not null, primary key(user_id,job_key)
);
alter table public.vocabulary_ai_jobs enable row level security;
revoke all on public.vocabulary_ai_jobs from anon,authenticated;
grant all on public.vocabulary_ai_jobs to service_role;
create function public.claim_vocabulary_job(p_user uuid,p_key text) returns uuid
language plpgsql security invoker set search_path=public as $$
declare lease uuid;
begin
  insert into vocabulary_ai_jobs(user_id,job_key,token,expires_at) values(p_user,p_key,gen_random_uuid(),now()+interval '150 seconds')
  on conflict(user_id,job_key) do update set token=excluded.token,expires_at=excluded.expires_at
    where vocabulary_ai_jobs.expires_at < now()
  returning token into lease;
  return lease;
end $$;
revoke all on function public.claim_vocabulary_job(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_vocabulary_job(uuid,text) to service_role;

-- A single server-day plan shared by devices. Reviews never consume new-word slots.
create function public.ensure_vocabulary_day(p_target integer default 25) returns public.vocabulary_daily_plans
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); today date:=(now() at time zone 'Asia/Shanghai')::date;
  plan vocabulary_daily_plans; f uuid[]; p uuid[]; n uuid[]; ids uuid[]; missing integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_target is null or p_target not between 0 and 100 then raise exception 'Invalid daily target'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||today::text,0));
  select * into plan from vocabulary_daily_plans where user_id=uid and day=today;
  if found then return plan; end if;
  select coalesce(array_agg(id),'{}') into f from (
    select id from vocabulary_words where user_id=uid and not archived and due_at is null and type='familiar'
    order by error_count desc,jsonb_array_length(sources) desc,id limit round(p_target*0.2)::integer) s;
  select coalesce(array_agg(id),'{}') into p from (
    select id from vocabulary_words where user_id=uid and not archived and due_at is null and not(id=any(f)) and target_level in ('P1','P2')
    order by error_count desc,jsonb_array_length(sources) desc,id limit round(p_target*0.2)::integer) s;
  select coalesce(array_agg(id),'{}') into n from (
    select id from vocabulary_words where user_id=uid and not archived and due_at is null and not(id=any(f||p))
    order by error_count desc,case when enrichment->>'value'='high' then 1 else 0 end desc,jsonb_array_length(sources) desc,id
    limit greatest(0,p_target-cardinality(f)-cardinality(p))) s;
  insert into vocabulary_daily_plans(user_id,day,new_ids,familiar_ids,production_ids,target) values(uid,today,n,f,p,p_target) returning * into plan;
  return plan;
end $$;
revoke all on function public.ensure_vocabulary_day(integer) from public,anon;
grant execute on function public.ensure_vocabulary_day(integer) to authenticated;

-- Users can curate lexical metadata, but cannot set scores, levels or completion directly.
revoke insert,update on public.vocabulary_words from authenticated;
grant update(archived) on public.vocabulary_words to authenticated;
create function public.edit_vocabulary_word(p_word uuid,p_type text,p_target text,p_meaning text,p_pos text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_type not in ('new','familiar','collocation','academic','listening') or p_target not in ('R1','R2','P1','P2')
    or length(p_meaning)>3000 or length(p_pos)>50 then raise exception 'Invalid word metadata'; end if;
  update vocabulary_words set type=p_type,target_level=p_target,meaning=p_meaning,pos=p_pos,
    enrichment=null,curated=true,content_version=content_version+1,version=version+1 where id=p_word and user_id=auth.uid();
  if not found then raise exception 'Word not found'; end if;
end $$;
revoke all on function public.edit_vocabulary_word(uuid,text,text,text,text) from public,anon;
grant execute on function public.edit_vocabulary_word(uuid,text,text,text,text) to authenticated;

-- Import RPC must retain narrowly-scoped writes after direct score mutations are revoked.
alter function public.save_vocabulary_chunk(uuid,integer,jsonb) security definer;
create or replace function public.save_vocabulary_chunk(p_import uuid,p_chunk integer,p_entries jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare imp vocabulary_imports; item jsonb; src jsonb; normalized text; target text; count_saved integer:=0;
begin
  select * into imp from vocabulary_imports where id=p_import and user_id=auth.uid() for update;
  if not found then raise exception 'Import not found'; end if;
  if p_chunk<0 or p_chunk>=jsonb_array_length(imp.chunks) then raise exception 'Invalid chunk'; end if;
  if p_chunk=any(imp.completed_chunks) then return 0; end if;
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>150 then raise exception 'Invalid entries'; end if;
  for item in select value from jsonb_array_elements(p_entries) loop
    normalized:=lower(regexp_replace(trim(item->>'word'),'\s+',' ','g'));
    if normalized is null or length(normalized)=0 or length(normalized)>120 then raise exception 'Invalid word'; end if;
    target:=case when item->>'target_level' in ('R1','R2','P1','P2') then item->>'target_level'
      when item->>'type' in ('familiar','collocation') then 'R2' when item->>'type'='academic' then 'P1' else 'R1' end;
    src:=jsonb_build_array(jsonb_build_object('import_id',imp.id,'name',imp.name,'kind',imp.source_kind,'original',item->>'original','context',item->>'context'));
    insert into vocabulary_words(user_id,word,pos,meaning,type,target_level,sources)
      values(auth.uid(),normalized,coalesce(item->>'pos',''),coalesce(item->>'meaning',''),coalesce(item->>'type','new'),target,src)
      on conflict(user_id,word) do update set sources=(select coalesce(jsonb_agg(distinct value),'[]') from jsonb_array_elements(vocabulary_words.sources||excluded.sources));
    count_saved:=count_saved+1;
  end loop;
  update vocabulary_imports set completed_chunks=array_append(completed_chunks,p_chunk) where id=p_import;
  return count_saved;
end $$;
-- The old self-assessment route must not be usable to manufacture mastery after upgrade.
revoke execute on function public.review_vocabulary(uuid,integer,boolean,text,text) from authenticated;

-- Trusted server grading only. Records feedback + mastery + schedule + errors atomically.
create function public.complete_vocabulary_attempt(p_user uuid,p_attempt uuid,p_answer text,p_feedback jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare a vocabulary_attempts; w vocabulary_words; q vocabulary_questions; passed boolean; points integer;
  m jsonb; dim text; today date:=(now() at time zone 'Asia/Shanghai')::date; first_today boolean;
  cnt integer; stage integer; next_level text; applied boolean:=true; result jsonb; goal integer; actual integer;
begin
  select * into a from vocabulary_attempts where id=p_attempt and user_id=p_user for update;
  if not found then raise exception 'Attempt not found'; end if;
  if a.completed_at is not null then return a.feedback; end if;
  if a.day<>today then raise exception '日期已变更，请关闭测试并重新出题'; end if;
  if p_answer is null or length(trim(p_answer))=0 or length(p_answer)>3000 then raise exception 'Invalid answer'; end if;
  select * into w from vocabulary_words where id=a.word_id and user_id=p_user for update;
  if not found or w.archived then raise exception 'Word unavailable'; end if;
  select * into q from vocabulary_questions where id=a.question_id;
  if q.content_version<>w.content_version then raise exception '词条内容已修改，请重新出题'; end if;
  points := (p_feedback->>'score')::integer;
  if points is null or points not between 0 and 100 then raise exception 'Invalid grade'; end if;
  passed := points>=80;
  dim := case when a.mode='collocation' then 'R2' else a.mode end;
  m := w.mastery;
  first_today := coalesce(m->dim->>'last_day','')<>today::text;
  -- A repeated success on the same day cannot inflate mastery; an error still reveals weakness.
  cnt := case when passed then coalesce((m->dim->>'passes')::integer,0)+case when first_today or coalesce((m->dim->>'score')::integer,0)<80 then 1 else 0 end else 0 end;
  m := jsonb_set(m,array[dim],jsonb_build_object('passes',least(cnt,20),'last_day',today,'score',points));
  next_level := 'R0';
  if coalesce((m->'R1'->>'passes')::integer,0)>=1 then next_level:='R1'; end if;
  if next_level='R1' and coalesce((m->'R2'->>'passes')::integer,0)>=1 then next_level:='R2'; end if;
  if next_level='R2' and coalesce((m->'P1'->>'passes')::integer,0)>=2 then next_level:='P1'; end if;
  if next_level='P1' and coalesce((m->'P2'->>'passes')::integer,0)>=2 then next_level:='P2'; end if;
  -- Old self-assessed levels are not evidence; listening never rewrites reading mastery.
  if dim='listening' then
    stage:=case when not passed then 0 when (w.listening_due_at is null or w.listening_due_at<=now()) and w.last_listening_day is distinct from today then least(w.listening_stage+1,5) else w.listening_stage end;
    update vocabulary_words set mastery=m,listening_stage=stage,
      listening_status=case when not passed then 'weak' when cnt>=2 then 'stable' else 'learning' end,
      listening_due_at=case when not passed or ((w.listening_due_at is null or w.listening_due_at<=now()) and w.last_listening_day is distinct from today) then now()+make_interval(days=>(array[1,1,3,7,14,30])[stage+1]) else listening_due_at end,
      last_listening_day=case when not passed or w.listening_due_at is null or w.listening_due_at<=now() then today else last_listening_day end,error_count=error_count+case when passed then 0 else 1 end,version=version+1 where id=w.id;
  else
    stage:=case when not passed then 0 when (w.due_at is null or w.due_at<=now()) and w.last_review_day is distinct from today then least(w.review_stage+1,5) else w.review_stage end;
    actual:=array_position(array['R0','R1','R2','P1','P2'],next_level);
    goal:=array_position(array['R0','R1','R2','P1','P2'],w.target_level);
    update vocabulary_words set mastery=m,level=next_level,review_stage=stage,
      status=case when not passed then 'error' when stage=5 and actual>=goal then 'stable' else 'review' end,
      due_at=case when not passed or ((w.due_at is null or w.due_at<=now()) and w.last_review_day is distinct from today) then now()+make_interval(days=>(array[1,1,3,7,14,30])[stage+1]) else due_at end,
      last_review_day=case when not passed or w.due_at is null or w.due_at<=now() then today else last_review_day end,error_count=error_count+case when passed then 0 else 1 end,version=version+1 where id=w.id;
  end if;
  if not passed then
    insert into vocabulary_errors(user_id,word_id,interpretation,actual_meaning,error_type,root_cause,transferable_rule,mode)
    values(p_user,w.id,p_answer,coalesce(p_feedback->>'expected_answer',''),coalesce(p_feedback->>'error_type',a.mode),
      coalesce(p_feedback->>'root_cause',''),coalesce(p_feedback->>'transferable_rule',''),a.mode);
  elsif first_today and cnt>=2 then
    update vocabulary_errors set resolved_at=now() where user_id=p_user and word_id=w.id and mode=a.mode and resolved_at is null;
  end if;
  result:=p_feedback||jsonb_build_object('passed',passed,'level',case when dim='listening' then w.level else next_level end,'applied',applied,'mode',a.mode);
  update vocabulary_attempts set answer=p_answer,feedback=result,score=points,completed_at=now() where id=a.id;
  return result;
end $$;
revoke all on function public.complete_vocabulary_attempt(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.complete_vocabulary_attempt(uuid,uuid,text,jsonb) to service_role;
grant all on public.vocabulary_words,public.vocabulary_errors,public.vocabulary_imports to service_role;

create function public.vocabulary_dashboard() returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'attempts',(select count(*) from vocabulary_attempts where user_id=auth.uid() and completed_at is not null),
    'today_completed',(select count(distinct word_id) from vocabulary_attempts where user_id=auth.uid() and completed_at is not null and day=(now() at time zone 'Asia/Shanghai')::date),
    'open_errors',(select count(*) from vocabulary_errors where user_id=auth.uid() and resolved_at is null),
    'modes',coalesce((select jsonb_agg(s) from (select mode,count(*) as attempts,round(avg(score)) as average_score,count(*) filter(where score>=80) as passed from vocabulary_attempts where user_id=auth.uid() and completed_at is not null group by mode) s),'[]'::jsonb),
    'days',coalesce((select jsonb_agg(s order by day) from (select day,count(*) as attempts,count(*) filter(where score>=80) as passed from vocabulary_attempts where user_id=auth.uid() and completed_at is not null and day>=(now() at time zone 'Asia/Shanghai')::date-29 group by day) s),'[]'::jsonb)
  );
$$;
revoke all on function public.vocabulary_dashboard() from public,anon;
grant execute on function public.vocabulary_dashboard() to authenticated;

create function public.record_vocabulary_observation(p_user uuid,p_word uuid,p_interpretation text,p_meaning text,p_listening boolean,p_source uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
  perform 1 from vocabulary_words where id=p_word and user_id=p_user for update;
  if not found then raise exception 'Word not found'; end if;
  perform 1 from vocabulary_imports where id=p_source and user_id=p_user;
  if not found then raise exception 'Source not found'; end if;
  if exists(select 1 from vocabulary_errors where source_import_id=p_source and word_id=p_word) then return; end if;
  insert into vocabulary_errors(user_id,word_id,interpretation,actual_meaning,error_type,root_cause,transferable_rule,mode,source_import_id)
    values(p_user,p_word,p_interpretation,p_meaning,case when p_listening then 'listening_recognition' else 'real_error' end,
      '从真实练习记录；待专项测试进一步分析。','通过新语境测试核对词义与使用条件。',case when p_listening then 'listening' else 'R2' end,p_source);
  if p_listening then
    update vocabulary_words set listening_status='weak',listening_due_at=now(),error_count=error_count+1,version=version+1 where id=p_word;
  else
    update vocabulary_words set status='error',due_at=now(),error_count=error_count+1,version=version+1 where id=p_word;
  end if;
end $$;
revoke all on function public.record_vocabulary_observation(uuid,uuid,text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.record_vocabulary_observation(uuid,uuid,text,text,boolean,uuid) to service_role;
