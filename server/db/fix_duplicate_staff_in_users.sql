-- Removes staff accounts that were accidentally duplicated into the residents (`users`) table.
-- Only deletes a users row when the SAME id also exists in `staff` (the real account is kept),
-- and only if no request points at it. Safe to re-run.
--
-- Run in HeidiSQL (or: mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < db/fix_duplicate_staff_in_users.sql)

-- 1. Preview what will be removed.
SELECT id, first_name, last_name, email FROM users
WHERE id LIKE 'S-ID-%' AND id IN (SELECT id FROM staff);

-- 2. Back up those rows into a separate table first.
CREATE TABLE IF NOT EXISTS backup_users_staff_duplicates LIKE users;
INSERT IGNORE INTO backup_users_staff_duplicates
SELECT * FROM users WHERE id LIKE 'S-ID-%' AND id IN (SELECT id FROM staff);

-- 3. Delete the duplicates (skips any row that a request still references).
DELETE FROM users
WHERE id LIKE 'S-ID-%'
  AND id IN (SELECT id FROM (SELECT id FROM staff) AS s)
  AND id NOT IN (SELECT resident_id FROM (SELECT resident_id FROM requests) AS r);

-- 4. Verify: should return no rows.
SELECT id, first_name, last_name FROM users WHERE id LIKE 'S-ID-%';

-- Once you've confirmed everything works, you can drop the backup:
--   DROP TABLE backup_users_staff_duplicates;
