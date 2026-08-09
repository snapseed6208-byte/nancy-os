-- ============================================
-- English SRS V4: Learn → Review Lifecycle
-- Part 2: Default value update (DDL only, data migration handled separately)
-- ============================================

ALTER TABLE expressions ALTER COLUMN status SET DEFAULT 'collected';
