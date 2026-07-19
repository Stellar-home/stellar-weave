-- Migration 0002: follows table for FollowGraph event ingestion.
--
-- Stores directed follow edges derived from follow_created / follow_removed
-- events emitted by the FollowGraph contract.
--
-- Design notes:
--   - NUMERIC(39,0) matches profiles.profile_id — u128 IDs, same reasoning.
--   - Composite PRIMARY KEY (follower_id, followee_id) naturally enforces
--     uniqueness: ON CONFLICT DO NOTHING in the ingest path costs nothing and
--     prevents rare replay edge cases.
--   - follow_removed events DELETE the row — no soft-delete / status flag.
--     There is no current product requirement to keep a "used to follow"
--     history; adding one now would be speculative complexity.
--   - idx_follows_followee enables fast "who follows X" queries (GET /profiles/:id/followers).
--   - idx_follows_follower enables fast "who does X follow" queries (GET /profiles/:id/following).

CREATE TABLE follows (
    follower_id   NUMERIC(39, 0) NOT NULL,
    followee_id   NUMERIC(39, 0) NOT NULL,
    created_at_ts BIGINT        NOT NULL,
    indexed_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id)
);

CREATE INDEX idx_follows_followee ON follows (followee_id);
CREATE INDEX idx_follows_follower ON follows (follower_id);
