# TEM8 Vocabulary OS 完整功能与正式上线

实现位于当前工作区，尚未部署线上。本文件替代早期 v1 范围说明。入口是学习侧栏「专八词汇」与 English OS 学习中心，路由 `/english/vocabulary`。

## 已实现的完整学习闭环

| 方案能力 | 实际实现 |
| --- | --- |
| Vocabulary Inbox | PDF/TXT/Markdown 上传、批量粘贴，以及真题、阅读、听力转写、翻译写作、真实错误单条摘录 |
| 提取与清洗 | 复用 PDF.js 文字解析；AI 提取原形与搭配，保留原形式、资料释义、来源与上下文；结果通过原文归属校验才整批保存 |
| 去重与恢复 | 同文本 SHA-256 去重、同用户同原形合并来源；批次事务、暂停、失败续传；重复导入不重置掌握状态 |
| 分层加工 | 普通词简明释义与例句；熟词生义的已知义、语境义、线索、误区、对比例句；输出词的搭配、语域、双例句、写作与翻译用法；近义表达与音标 |
| 五类词汇 | 新词、熟词生义、搭配、学术正式词、听力识别；可人工修订分类、目标和个人释义，来源原文保留 |
| 自动每日安排 | 进入今日学习时生成并保存上海时区当日名单；默认 25，有既有英语新学数量偏好时复用；60% 普通新词、20% 熟词生义、20% 输出词，不足则补足；跨设备不重复补入新词 |
| Learning / Review Queue | 新词名单与到期复习独立；D1/D3/D7/D14/D30；提前练习不推迟原到期日，同日重复不推进多级；支持只复习不加新词（名额 0） |
| R1 测试 | 英文释义四选一，服务端确定性判分 |
| R2 测试 | 新语境中的熟词生义和同义改写识别，服务端确定性判分 |
| Collocation 测试 | 搭配填空四选一 |
| P1 测试 | 中文语境到英文短语/翻译输出，AI 结合词义与词汇目标评分，接受合适变体 |
| P2 测试 | 受指定主题约束的自主英文造句；按词义、语法、搭配、语域评分，返回修改示例 |
| 听力训练 | 浏览器英语语音合成播放词或短搭配，输入听写；忽略大小写及标点；阅读和听力掌握状态、复习时间分别记录 |
| 等级调整 | 80 分通过；R1、R2 各需要相应测试证据；P1、P2 各需至少两个不同日期通过且满足前级；错误降低对应能力；听错不清空阅读等级 |
| 错词迁移 | 保存当时答案、实际含义、错因、迁移规则；后续题目参考该错误生成新语境；跨日两次通过后标记该类错误已解决 |
| 个人词库管理 | 搜索来源/释义、分类筛选、归档与恢复、完整词卡 JSON 导出 |
| 学习分析 | 各层级掌握分布、分模式平均分与通过率、近 30 天统计、最近 100 次测试及评分反馈 |

P1/P2 是自动形成的实际等级，不再只展示目标；旧自评提交 RPC 已禁止普通用户调用。选择题答案不返回浏览器，只有提交后返回解释。听力使用设备 TTS，因此音频文本必需传给浏览器，但测试界面不会提前展示它。

## 复用与成本

沿用当前 Supabase 项目、账号、RLS、统一 `invokeAI` / `aiRuntime` / DeepSeek 配置、React Query、PDF.js 动态解析、上海日期切换和既有英语新学数量偏好。没有新增项目依赖，没有新建 Google Sheets、另一套账号、AI Key 或定时任务。

- PDF 原文只提取一次并保存在现有数据库；批次至多 3500 字符，密集英文词表会提前切分，避免输出截断。
- 只加工实际打开的词卡，已有 v2 卡直接复用；不会上传后批量生成数千张完整卡。
- 客观题与听写不再调用 AI 评分；P1/P2 才调用。
- 题目按词条内容版本、模式和变体缓存；真实错误触发新的语境变体。
- 同一请求使用短租约防止并发重复调用；保存过的测试重试直接返回原结果。
- 原文按展开加载，导入阶段只刷新批次进度，词库分页读取。

## 上线前已完成的验证

当前工作区回归：37 个测试文件、800 项测试通过。隔离数据库共 58 项断言通过（基础 24 + 完整系统 34）。发布补丁已通过对缓存生产基线 `d9418f23` 的应用检查；实际发布仍应先 fetch 并重新检查最新生产代码。

- 前端回归、类型检查、生产构建、PWA 与环境占位符检查。
- 服务端使用现有 TypeScript 工具链检查 Deno 入口及共享调用代码，配置是 `tests/tsconfig.vocabulary-edge.json`。
- `tests/vocabulary-db.mjs` 验证基础迁移、去重、事务回滚和权限。
- `tests/vocabulary-system-db.mjs` 验证完整迁移、15/5/5 名单、跨日等级、独立听力、提前复习、旧接口封禁、AI 租约、真实错词重试和数据隔离。
- `tests/VocabularyEndpoint.test.ts` 验证确定性判分不调用 AI、AI 失败不写进度、重复提交复用、跨用户禁止提交和跨午夜题目失效。

数据库测试使用临时隔离的 PGlite，未修改生产数据库。生产真实 PDF、真实 AI 评分、设备发音和登录浏览器验收仍需按下文完成。

## 第一步：建立干净的发布分支

当前本地 `master` 与缓存的 `origin/master` 不一致，而且工作区还有阅读、口语和历史迁移改动。不要直接 `git add -A` 后推送当前分支。

已经提供 `docs/releases/tem8-vocabulary.patch`，只包含本功能的页面、入口、后端、迁移、测试和说明。补丁以缓存的生产分支为基准生成；实际发布前先 fetch 最新状态并检查能否干净应用。

在 PowerShell 执行（新目录尚不存在时）：

```powershell
Set-Location D:\ai\docs\nancy-os
git fetch origin
git worktree add -b codex/tem8-vocabulary-release D:\ai\docs\nancy-os-tem8-release origin/master
Set-Location D:\ai\docs\nancy-os-tem8-release
git apply --check D:\ai\docs\nancy-os\docs\releases\tem8-vocabulary.patch
git apply D:\ai\docs\nancy-os\docs\releases\tem8-vocabulary.patch
Copy-Item -LiteralPath D:\ai\docs\nancy-os\.env.local -Destination .\.env.local
pnpm install --frozen-lockfile
node node_modules/vitest/vitest.mjs run --exclude 'backups/**' --maxWorkers=4
node node_modules/typescript/bin/tsc --noEmit --project tests/tsconfig.vocabulary-edge.json
npm run build
```

如果补丁检查有冲突，先合并并重新验证，不要强制覆盖。若发布目录/分支已经存在，继续使用它，不要覆盖重建。`.env.local` 是原系统配置，受 `.gitignore` 保护。

## 第二步：应用数据库迁移

只需要新增的两份迁移：

1. `supabase/migrations/107_tem8_vocabulary.sql`
2. `supabase/migrations/108_tem8_learning_system.sql`

在现有 Supabase 项目的 SQL Editor 先检查：

```sql
select to_regclass('public.vocabulary_words') as vocabulary_words,
       to_regclass('public.vocabulary_attempts') as vocabulary_attempts;
select version, name from supabase_migrations.schema_migrations
where version in ('107', '108') order by version;
```

- 两张表都不存在且版本号未占用：依次运行 107、108 的完整内容。每份 SQL 建议包在 `begin;` 与 `commit;` 中运行；出错则 `rollback;` 后修正，不留下半份迁移。
- 已运行过 v1 的 107：只运行 108，不重跑 107。
- 已有 108：先检查结构与迁移记录，不要重复执行；同版本号若对应其他功能，应先处理版本冲突。

运行成功后核验：

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='vocabulary_words'
and column_name in ('mastery','target_level','listening_due_at','content_version','curated');
select has_function_privilege('authenticated', 'public.review_vocabulary(uuid,integer,boolean,text,text)', 'EXECUTE') as old_self_rating_should_be_false,
       has_function_privilege('authenticated', 'public.complete_vocabulary_attempt(uuid,uuid,text,jsonb)', 'EXECUTE') as direct_grading_should_be_false,
       has_table_privilege('authenticated', 'public.vocabulary_questions', 'SELECT') as answer_read_should_be_false;
```

应返回 5 个字段，最后三个权限值均为 `false`。

如果通过 SQL Editor 执行，**确认对应 SQL 已成功执行后**再记录迁移历史：

```powershell
supabase login
supabase link --project-ref raiyrrehejwxfyzsjvxj
supabase migration repair 107 108 --status applied
```

如果历史已经正确记录则不必 repair。repair 只修复历史，不执行 SQL；不能拿它跳过未运行的迁移。不要对 098/099 等历史改动批量标记。

也可使用 CLI：先 `supabase db push --dry-run`，仅在输出确实只有尚未应用的 107/108 时再 `supabase db push`；若出现其他待应用迁移，使用上述 SQL Editor 路径。官方说明：[数据库迁移](https://supabase.com/docs/guides/deployment/database-migrations)、[CLI 工作流](https://supabase.com/docs/guides/local-development/cli-workflows)。

## 第三步：部署 AI 函数

复用现有 `DEEPSEEK_API_KEY`。Supabase 运行时原有 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 继续使用；无需复制到前端。若原系统 AI 已可用，通常不需要设置新 Secret。缺少 DeepSeek Key 时，在 Supabase Dashboard → Edge Functions → Secrets 设置。参见[环境变量说明](https://supabase.com/docs/guides/functions/secrets)。

在干净发布目录执行：

```powershell
supabase functions deploy tem8-vocabulary-agent --project-ref raiyrrehejwxfyzsjvxj --use-api
```

`--use-api` 在本机 CLI 帮助中已核验，用于服务端打包，无需本地 Docker。只指定这一个函数，不部署全部函数，不使用 `--prune`。

保留默认 JWT 验证；函数内部还会通过原系统的 `authenticateOrRespond` 校验用户。官方建议用户会话调用保持验证：[Edge Function 认证](https://supabase.com/docs/guides/functions/auth)。若出现 401，先重新登录并确认前端 URL/Key 属于同一项目，不要直接删除认证逻辑。

## 第四步：只读检查后发布前端

在发布目录新建 `.env.vocabulary-qa.local`，写入用于验收的真实账号（该文件受现有忽略规则保护）：

```dotenv
VOCABULARY_QA_EMAIL=你的验收账号
VOCABULARY_QA_PASSWORD=该账号密码
```

```powershell
node --env-file=.env.local --env-file=.env.vocabulary-qa.local scripts/verify-vocabulary-deployment.mjs
```

脚本仅检查结构、认证、权限和函数路由，不调用 AI、不创建学习记录。检查通过后提交这个干净 worktree 中的词汇变更：

```powershell
git status --short
git add -- src/App.tsx src/pages/English.tsx src/config/navigation.ts src/components/layout/Sidebar.tsx src/pages/EnglishVocabulary.tsx src/components/english/vocabulary src/lib/english/vocabulary.ts src/lib/hooks/useVocabulary.ts src/__tests__/EnglishInformationArchitecture.test.tsx src/__tests__/Vocabulary.test.ts src/__tests__/VocabularyPage.test.tsx src/__tests__/VocabularyPractice.test.ts supabase/functions/tem8-vocabulary-agent supabase/migrations/107_tem8_vocabulary.sql supabase/migrations/108_tem8_learning_system.sql tests/VocabularyEndpoint.test.ts tests/vocabulary-db.mjs tests/vocabulary-system-db.mjs tests/vocabulary-edge-types.d.ts tests/tsconfig.vocabulary-edge.json scripts/verify-vocabulary-deployment.mjs docs/tem8-vocabulary-deployment.md
git diff --cached --stat
git commit -m "feat: complete TEM8 vocabulary learning system"
git push -u origin codex/tem8-vocabulary-release
```

将发布分支通过 PR 合并到 `master`，触发现有 Cloudflare Pages 生产部署。继续使用：

| 配置 | 值 |
| --- | --- |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| 环境变量 | 既有 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`，其他系统变量保持 |
| 生产路由 | `https://nancy-os.pages.dev/english/vocabulary` |

Cloudflare 的 Vite 构建设置可对照[官方构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)。前端继续使用原 SPA `_redirects` 与 PWA；已打开的 PWA 页面需要刷新以加载新版本。预览域名若不在共享 CORS 白名单，AI 请求会被阻止；生产域名及本地 5173/4173 已在现有白名单。

## 第五步：正式验收

1. 上传一份带文字层的小型真实词汇 PDF，确认原文、原形式和来源可查看；同文件重传不增词数、不重置学习进度。
2. 在一个批次完成后暂停、刷新再继续，确认完成批次不重新提取。
3. 打开熟词生义，确认有对比义、识别线索、对比例句；打开输出词，确认双例句与翻译写作用法。
4. 分别完成 R1/R2/搭配题、P1 翻译和 P2 造句；正确、错误、超时重试各检验一次。仅保存成功才显示完成反馈。
5. 用浏览器播放听力题并听写；听错后阅读等级保持，听力进入薄弱状态。
6. 刷新或另一设备登录，确认当日名单相同、成绩保存；错误可打开并用新语境再测。
7. 次日验证复习到期和跨日升级；P1/P2 不应在同一天通过重复点击升满。

任一步失败，保留现有数据并查看 Edge Function 日志及 AI 仪表盘。需要撤回时回滚前端发布/PR，保留新表与数据；不要用 `db reset`、删表或回滚旧迁移来处理前端问题。

## 明确的运行边界

支持文字层 PDF，不含扫描件 OCR；原 PDF 二进制不重复存储，保留提取原文与来源。输入上限 20MB / 100 万字符，超大资料需拆分。听力用设备 TTS，不等同于真实考试录音的口音与噪声训练。真实录音中的错误可以手动记录到听力专项。AI 的释义、出题和 P1/P2 评分仍需用户对照材料核验，不作为官方考试评分。

上述是功能的运行条件，不是留待实现的 v1 核心流程。正式上线是否成功，以第五步的真实环境验收为准。
