-- Removes disposable users created by the k6 load tests.
-- Pattern: k6.<run-id>.<label>.<index>@example.com
-- Safe to run multiple times. Only matches disposable k6 accounts; it never
-- touches the original development account or any other non-k6 user.
--
-- Usage:
--   psql -U postgres -d typing_db -f cleanup.sql
--
-- race_results has no user foreign key, so it must be deleted explicitly.
-- race_sessions is intentionally left in place; it has no user foreign key and
-- orphan sessions are documented as harmless historical rows.

\echo 'Deleting k6 race_results...'
DELETE FROM race_results
WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'k6.%@example.com');

\echo 'Deleting k6 oauth providers...'
DELETE FROM user_oauth_providers
WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'k6.%@example.com');

\echo 'Deleting k6 users (cascades typing_results and user_stats)...'
DELETE FROM users
WHERE email LIKE 'k6.%@example.com';

\echo 'Remaining k6 users:'
SELECT count(*) AS k6_users FROM users WHERE email LIKE 'k6.%@example.com';
