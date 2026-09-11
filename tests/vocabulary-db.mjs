// Run against an isolated PostgreSQL-compatible PGlite runtime, never production.
// node tests/vocabulary-db.mjs <absolute path to @electric-sql/pglite/dist/index.js>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "@electric-sql/pglite");
const db = new PGlite();
let checks = 0;
const check = (condition) => { assert.ok(condition); checks++; };
const u1 = "10000000-0000-0000-0000-000000000001";
const u2 = "10000000-0000-0000-0000-000000000002";
const entry = {word:"Qualify",original:"qualifies",context:"qualifies 限定",meaning:"限定",pos:"v.",type:"familiar"};
try {
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    insert into auth.users values('${u1}'),('${u2}');`);
  await db.exec(readFileSync("supabase/migrations/107_tem8_vocabulary.sql","utf8"));
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${u1}';`);
  async function newImport(name) {
    return (await db.query("insert into vocabulary_imports(user_id,name,fingerprint,chunks) values($1,$2,$2,$3) returning id,chunk_count",[u1,name,JSON.stringify(["qualifies 限定"])])).rows[0];
  }
  const a = await newImport("a.pdf");
  check(a.chunk_count === 1);
  await db.query("select save_vocabulary_chunk($1,0,$2)",[a.id,JSON.stringify([entry])]);
  const getWord = async () => (await db.query("select * from vocabulary_words where word='qualify'")).rows[0];
  let w = await getWord();
  check(w.word === "qualify" && w.sources[0].original === "qualifies");
  await db.query("select save_vocabulary_chunk($1,0,$2)",[a.id,JSON.stringify([entry])]);
  check((await getWord()).sources.length === 1);
  await db.query("select review_vocabulary($1,0,false,'有资格','忽略语境')",[w.id]);
  w = await getWord();
  check(w.status === "error" && w.error_count === 1 && w.version === 1 && w.review_stage === 0);
  check((await db.query("select * from vocabulary_errors")).rows[0].interpretation === "有资格");
  await assert.rejects(db.query("select review_vocabulary($1,0,true,'限定','')",[w.id]),/记录已更新/); checks++;
  await assert.rejects(db.query("select review_vocabulary($1,1,true,'限定','')",[w.id]),/尚未到/); checks++;
  const b = await newImport("b.pdf");
  await db.query("select save_vocabulary_chunk($1,0,$2)",[b.id,JSON.stringify([entry])]);
  w = await getWord();
  check(w.sources.length === 2 && w.error_count === 1 && w.version === 1 && w.status === "error");
  const c = await newImport("broken.pdf");
  await assert.rejects(db.query("select save_vocabulary_chunk($1,0,$2)",[c.id,JSON.stringify([{...entry,word:"valid"},{...entry,word:"bad",type:"invalid"}])])); checks++;
  check((await db.query("select * from vocabulary_words where word='valid'")).rows.length === 0);
  check((await db.query("select completed_chunks from vocabulary_imports where id=$1",[c.id])).rows[0].completed_chunks.length === 0);
  for (let stage=1;stage<=5;stage++) {
    await db.query("update vocabulary_words set due_at=now()-interval '1 second' where id=$1",[w.id]);
    await db.query("select review_vocabulary($1,$2,true,'限定','')",[w.id,stage]);
    const updated = await getWord();
    const scheduled = (await db.query("select round(extract(epoch from (due_at-now()))/86400)::int as days from vocabulary_words where id=$1",[w.id])).rows[0].days;
    check(updated.review_stage === stage && scheduled === [1,3,7,14,30][stage-1]);
  }
  w = await getWord();
  check(w.status === "stable" && w.level === "R2");
  await db.exec(`set request.jwt.claim.sub='${u2}';`);
  check((await db.query("select * from vocabulary_words")).rows.length === 0);
  check((await db.query("select * from vocabulary_errors")).rows.length === 0);
  check((await db.query("select * from vocabulary_imports")).rows.length === 0);
  await assert.rejects(db.query("select save_vocabulary_chunk($1,0,'[]')",[a.id]),/Import not found/); checks++;
  await assert.rejects(db.query("select review_vocabulary($1,$2,true,'','')",[w.id,w.version]),/Word not found/); checks++;
  await assert.rejects(db.query("insert into vocabulary_words(user_id,word) values($1,'intruder')",[u1]),/row-level security/); checks++;
  await db.exec("reset role; set role anon;");
  await assert.rejects(db.query("select review_vocabulary($1,0,true,'','')",[w.id]),/permission denied/); checks++;
  console.log(`Vocabulary database: ${checks} assertions passed (migration, atomicity, deduplication, review intervals, RLS, RPC permissions).`);
} finally { await db.close(); }
