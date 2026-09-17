-- Barangay System - split staff out of `users` into their own `staff` table
-- One-time, non-destructive migration for an EXISTING (live) database. It does not drop or
-- recreate anything -- unlike schema.sql, which wipes the database, this only moves rows and
-- makes small, reversible structural adjustments.
--
-- Back up your database before running this on a live/production instance:
--   mysqldump -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p <DB_NAME> > backup_before_staff_split.sql
--
-- Then run this migration:
--   mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p <DB_NAME> < db/migrate_split_staff.sql
--
-- Safe to re-run: every step below is guarded so running it twice does not duplicate rows or error.

-- 1. Create the staff table (same shape as users, minus the role column -- the table itself
--    is the role now). No-op if it already exists.
CREATE TABLE IF NOT EXISTS staff (
  id             VARCHAR(20)  PRIMARY KEY,
  first_name     VARCHAR(100) NOT NULL,
  middle_name    VARCHAR(100) NOT NULL DEFAULT '',
  last_name      VARCHAR(100) NOT NULL,
  gender         ENUM('Male','Female','Other') NOT NULL,
  civil_status   ENUM('Single','Married','Widowed','Separated','Divorced') NOT NULL DEFAULT 'Single',
  date_of_birth  DATE NOT NULL,
  email          VARCHAR(150) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  temp_password  VARCHAR(255) DEFAULT NULL,
  address        VARCHAR(255) NOT NULL DEFAULT '',
  contact_no     VARCHAR(30)  NOT NULL DEFAULT '',
  status         ENUM('Pending','Denied','Approved') NOT NULL DEFAULT 'Pending',
  joined         DATE NOT NULL,
  last_login_at  DATETIME DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_email (email)
) ENGINE=InnoDB;

-- 2. Copy any existing staff rows out of users into staff. Only runs while users.role still
--    exists (a re-run after step 5 has already dropped it is a no-op via the IF below), and
--    skips rows already copied so it's safe to run more than once.
SET @users_has_role := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
);
SET @copy_sql := IF(@users_has_role > 0,
  'INSERT INTO staff (id, first_name, middle_name, last_name, gender, civil_status, date_of_birth, email, password_hash, temp_password, address, contact_no, status, joined, last_login_at, created_at)
   SELECT id, first_name, middle_name, last_name, gender, civil_status, date_of_birth, email, password_hash, temp_password, address, contact_no, status, joined, last_login_at, created_at
   FROM users
   WHERE role = ''staff'' AND id NOT IN (SELECT id FROM staff)',
  'SELECT 1'
);
PREPARE stmt FROM @copy_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Remove the migrated rows from users.
SET @delete_sql := IF(@users_has_role > 0, 'DELETE FROM users WHERE role = ''staff''', 'SELECT 1');
PREPARE stmt FROM @delete_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Drop the FK from notifications.user_id -> users(id): staff-targeted notifications (e.g. a
--    staff account being approved) now reference the staff table too, so the column can no
--    longer be pinned to just one table. Constraint name varies by install, so it's looked up
--    dynamically; no-op if it's already gone.
SET @fk := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'user_id'
    AND REFERENCED_TABLE_NAME = 'users' LIMIT 1
);
SET @drop_fk_sql := IF(@fk IS NOT NULL, CONCAT('ALTER TABLE notifications DROP FOREIGN KEY ', @fk), 'SELECT 1');
PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Drop the now-unused role column from users (every remaining row is a resident; the table
--    itself says so from here on).
SET @drop_role_sql := IF(@users_has_role > 0, 'ALTER TABLE users DROP COLUMN role', 'SELECT 1');
PREPARE stmt FROM @drop_role_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify afterwards:
--   SELECT COUNT(*) FROM users;   -- residents only
--   SELECT COUNT(*) FROM staff;   -- staff, moved over
--   DESCRIBE users;               -- no role column
