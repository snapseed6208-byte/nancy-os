-- ============================================
-- Migration 030: Audit URL anomalies across all tables
-- Identifies corrupted / invalid URLs — does NOT auto-fix
-- ============================================

-- workout_videos.url (NOT NULL)
SELECT 'workout_videos' AS table_name, id, url, 'has_spaces' AS issue
FROM workout_videos
WHERE url LIKE '% %'
UNION ALL
SELECT 'workout_videos', id, url, 'has_chinese'
FROM workout_videos
WHERE url ~ '[\x{4e00}-\x{9fff}\x{3040}-\x{309f}\x{30a0}-\x{30ff}\x{ac00}-\x{d7af}]'
UNION ALL
SELECT 'workout_videos', id, url, 'non_http_protocol'
FROM workout_videos
WHERE url !~ '^https?://'
UNION ALL
SELECT 'workout_videos', id, url, 'has_newline'
FROM workout_videos
WHERE url LIKE '%' || CHR(10) || '%' OR url LIKE '%' || CHR(13) || '%';

-- recipes.source_url (nullable)
SELECT 'recipes' AS table_name, id, COALESCE(source_url, 'NULL'), 'has_spaces' AS issue
FROM recipes
WHERE source_url LIKE '% %'
UNION ALL
SELECT 'recipes', id, COALESCE(source_url, 'NULL'), 'has_chinese'
FROM recipes
WHERE source_url ~ '[\x{4e00}-\x{9fff}\x{3040}-\x{309f}\x{30a0}-\x{30ff}\x{ac00}-\x{d7af}]'
UNION ALL
SELECT 'recipes', id, COALESCE(source_url, 'NULL'), 'non_http_protocol'
FROM recipes
WHERE source_url IS NOT NULL AND source_url != '' AND source_url !~ '^https?://'
UNION ALL
SELECT 'recipes', id, COALESCE(source_url, 'NULL'), 'has_newline'
FROM recipes
WHERE source_url LIKE '%' || CHR(10) || '%' OR source_url LIKE '%' || CHR(13) || '%';

-- resources.url (nullable)
SELECT 'resources' AS table_name, id, COALESCE(url, 'NULL'), 'has_spaces' AS issue
FROM resources
WHERE url LIKE '% %'
UNION ALL
SELECT 'resources', id, COALESCE(url, 'NULL'), 'has_chinese'
FROM resources
WHERE url ~ '[\x{4e00}-\x{9fff}\x{3040}-\x{309f}\x{30a0}-\x{30ff}\x{ac00}-\x{d7af}]'
UNION ALL
SELECT 'resources', id, COALESCE(url, 'NULL'), 'non_http_protocol'
FROM resources
WHERE url IS NOT NULL AND url != '' AND url !~ '^https?://'
UNION ALL
SELECT 'resources', id, COALESCE(url, 'NULL'), 'has_newline'
FROM resources
WHERE url LIKE '%' || CHR(10) || '%' OR url LIKE '%' || CHR(13) || '%';

-- jobs.jd_url (nullable)
SELECT 'jobs' AS table_name, id, COALESCE(jd_url, 'NULL'), 'has_spaces' AS issue
FROM jobs
WHERE jd_url LIKE '% %'
UNION ALL
SELECT 'jobs', id, COALESCE(jd_url, 'NULL'), 'has_chinese'
FROM jobs
WHERE jd_url ~ '[\x{4e00}-\x{9fff}\x{3040}-\x{309f}\x{30a0}-\x{30ff}\x{ac00}-\x{d7af}]'
UNION ALL
SELECT 'jobs', id, COALESCE(jd_url, 'NULL'), 'non_http_protocol'
FROM jobs
WHERE jd_url IS NOT NULL AND jd_url != '' AND jd_url !~ '^https?://'
UNION ALL
SELECT 'jobs', id, COALESCE(jd_url, 'NULL'), 'has_newline'
FROM jobs
WHERE jd_url LIKE '%' || CHR(10) || '%' OR jd_url LIKE '%' || CHR(13) || '%';
