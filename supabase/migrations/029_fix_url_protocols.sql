-- ============================================
-- Migration 029: Fix missing https:// in external URLs
-- Ensures all user-submitted URLs have a protocol
-- ============================================

-- workout_videos.url (NOT NULL — only fix rows that look like valid URLs)
UPDATE workout_videos
SET url = 'https://' || url
WHERE url IS NOT NULL
  AND url != ''
  AND url !~ '^https?://'
  AND url !~ '^/'
  AND url ~ '\.';

-- recipes.source_url (nullable)
UPDATE recipes
SET source_url = 'https://' || source_url
WHERE source_url IS NOT NULL
  AND source_url != ''
  AND source_url !~ '^https?://'
  AND source_url !~ '^/'
  AND source_url ~ '\.';

-- resources.url (nullable)
UPDATE resources
SET url = 'https://' || url
WHERE url IS NOT NULL
  AND url != ''
  AND url !~ '^https?://'
  AND url !~ '^/'
  AND url ~ '\.';

-- jobs.jd_url (nullable)
UPDATE jobs
SET jd_url = 'https://' || jd_url
WHERE jd_url IS NOT NULL
  AND jd_url != ''
  AND jd_url !~ '^https?://'
  AND jd_url !~ '^/'
  AND jd_url ~ '\.';
