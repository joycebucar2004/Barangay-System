-- Barangay System - full relational schema + stored procedures
-- Target: MySQL 5.7 (matches the connected server; no JSON_TABLE, no CTEs, no window functions)
-- Run with: mysql -u bsdb -p barangay < db/schema.sql

CREATE DATABASE IF NOT EXISTS barangay CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE barangay;

-- ============================================================
-- TABLES
-- ============================================================

DROP TABLE IF EXISTS request_files;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS document_type_requirements;
DROP TABLE IF EXISTS document_types;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS admin;
DROP TABLE IF EXISTS counters;

-- Residents only -- staff accounts live in their own `staff` table below, and admin in `admin`.
-- No role column: which table a row is in *is* the role. id is human-readable (R-ID-NNN,
-- see counters 'resident' below), assigned at creation time and never reused.
CREATE TABLE users (
  id             VARCHAR(20)  PRIMARY KEY,
  first_name     VARCHAR(100) NOT NULL,
  middle_name    VARCHAR(100) NOT NULL DEFAULT '',
  last_name      VARCHAR(100) NOT NULL,
  gender         ENUM('Male','Female','Other') NOT NULL,
  civil_status   ENUM('Single','Married','Widowed','Separated','Divorced') NOT NULL DEFAULT 'Single',
  date_of_birth  DATE NOT NULL,
  email          VARCHAR(150) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  temp_password  VARCHAR(255) DEFAULT NULL, -- plaintext; set on creation, cleared once the user sets their own password
  address        VARCHAR(255) NOT NULL DEFAULT '',
  contact_no     VARCHAR(30)  NOT NULL DEFAULT '',
  status         ENUM('Pending','Denied','Approved') NOT NULL DEFAULT 'Pending',
  joined         DATE NOT NULL,
  last_login_at  DATETIME DEFAULT NULL, -- drives the Active/Inactive display once Approved (Inactive after 1 year with no login)
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- Staff accounts, same shape as users but kept in their own table (ids get S-ID-NNN, see
-- counters 'staff' below) so the User Accounts screen -- and any future staff-only tooling --
-- can't accidentally mix the two up.
CREATE TABLE staff (
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

-- Admin accounts are kept fully separate from residents/staff: no profile fields,
-- no approval workflow, not manageable from the User Accounts screen.
CREATE TABLE admin (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  email          VARCHAR(150) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_email (email)
) ENGINE=InnoDB;

CREATE TABLE document_types (
  name  VARCHAR(100) PRIMARY KEY,
  fee   DECIMAL(10,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE document_type_requirements (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  document_type_name  VARCHAR(100) NOT NULL,
  requirement         VARCHAR(255) NOT NULL,
  required            TINYINT(1) NOT NULL DEFAULT 1, -- resident must attach a file for this before submitting; optional ones can be skipped
  sort_order          INT NOT NULL DEFAULT 0,
  FOREIGN KEY (document_type_name) REFERENCES document_types(name)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE requests (
  id             VARCHAR(20) PRIMARY KEY,     -- e.g. BR-2026-001
  resident_id    VARCHAR(20) NOT NULL,
  doc_type       VARCHAR(100) NOT NULL,
  status         ENUM('Pending','Verified','Approved','Ready for Pickup','Released','Rejected','Cancelled')
                 NOT NULL DEFAULT 'Pending',
  purpose        VARCHAR(255) NOT NULL,
  submitted_at   DATE NOT NULL,
  updated_at     DATE NOT NULL,
  fee            DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid           TINYINT(1) NOT NULL DEFAULT 0,
  printed_at     DATETIME DEFAULT NULL,        -- set when admin prints the official certificate; gates Mark as Paid
  address        VARCHAR(255) NOT NULL DEFAULT '',
  contact_no     VARCHAR(30)  NOT NULL DEFAULT '',
  date_of_birth  DATE DEFAULT NULL,           -- snapshot from the resident, for printed certificates
  civil_status   VARCHAR(20) DEFAULT NULL,    -- snapshot from the resident, for printed certificates
  remarks        VARCHAR(500) DEFAULT NULL,
  FOREIGN KEY (resident_id) REFERENCES users(id),
  FOREIGN KEY (doc_type) REFERENCES document_types(name),
  KEY idx_requests_resident (resident_id),
  KEY idx_requests_status (status),
  KEY idx_requests_submitted (submitted_at)
) ENGINE=InnoDB;

CREATE TABLE request_files (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  request_id     VARCHAR(20) NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  requirement    VARCHAR(255) DEFAULT NULL, -- which checklist requirement this file satisfies
  stored_name    VARCHAR(255) NOT NULL,
  uploaded_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id        VARCHAR(20) PRIMARY KEY,          -- e.g. n1
  user_id   VARCHAR(20) DEFAULT NULL,          -- set when targeted at one resident or staff account (no FK: can point into either users or staff)
  for_role  ENUM('resident','staff','admin') DEFAULT NULL, -- set when broadcast to a role
  message   VARCHAR(500) NOT NULL,
  time      DATETIME NOT NULL,
  is_read   TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_notifications_user (user_id),
  KEY idx_notifications_role (for_role)
) ENGINE=InnoDB;

CREATE TABLE announcements (
  id      VARCHAR(20) PRIMARY KEY,   -- e.g. a1
  tag     ENUM('Advisory','Announcement','Event','Notice') NOT NULL DEFAULT 'Announcement',
  title   VARCHAR(255) NOT NULL,
  body    VARCHAR(1000) NOT NULL,
  date    DATE NOT NULL,
  KEY idx_announcements_date (date)
) ENGINE=InnoDB;

-- backs the human-readable id generation (R-ID-003, S-ID-002, BR-2026-009, n4, a5, ...)
CREATE TABLE counters (
  name   VARCHAR(30) PRIMARY KEY,
  value  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

INSERT INTO counters (name, value) VALUES ('resident', 2), ('staff', 2), ('request', 8), ('notification', 3), ('announcement', 4);

-- ============================================================
-- SEED DATA (mirrors server/src/db.js seed())
-- ============================================================

INSERT INTO users (id, first_name, middle_name, last_name, gender, date_of_birth, email, password_hash, address, contact_no, status, joined) VALUES
('R-ID-001','Maria','Lopez','Santos','Female','1990-04-12','maria.santos@email.com','$2a$10$BVJD5Z2zdHsLA0IIHSNSju0KbHUCdKyNJBBXszoTizneCQI4lFC3y','123 Sampaguita St., Brgy. Campagao','09171234567','Approved','2025-01-12'),
('R-ID-002','Juan','Reyes','dela Cruz','Male','1988-11-03','juan.delacruz@email.com','$2a$10$BVJD5Z2zdHsLA0IIHSNSju0KbHUCdKyNJBBXszoTizneCQI4lFC3y','45 Rosal Ave., Brgy. Campagao','09281234567','Approved','2025-02-08');
-- demo password: resident123

INSERT INTO staff (id, first_name, middle_name, last_name, gender, date_of_birth, email, password_hash, address, contact_no, status, joined) VALUES
('S-ID-001','Ramon','Cruz','Reyes','Male','1985-02-20','reyes@brgycampagao.gov.ph','$2a$10$NqySL2W6IxDZfXmCecZ4SeRH3ZOu/zm1f7ASrWoZDZH91w5Pn01cu','Barangay Hall, Campagao','09170000001','Approved','2024-06-01'),
('S-ID-002','Liza','Ortega','Flores','Female','1987-09-15','flores@brgycampagao.gov.ph','$2a$10$NqySL2W6IxDZfXmCecZ4SeRH3ZOu/zm1f7ASrWoZDZH91w5Pn01cu','Barangay Hall, Campagao','09170000002','Approved','2024-06-01');
-- demo password: staff123

INSERT INTO admin (email, password_hash) VALUES
('bautista@brgycampagao.gov.ph','$2a$10$goPxRpLvpG7./R9nvu0lEeKiu5xsKeUUUGL4MuSQJ1vn.EkTHW6ti');
-- demo password: admin123

INSERT INTO document_types (name, fee) VALUES
('Barangay Clearance', 50),
('Indigency Certificate', 0),
('Residency Certificate', 50),
('Business Permit', 200),
('Good Moral Certificate', 50),
('First-Time Job Seeker Certificate', 0),
('Certificate of Cohabitation', 50);

-- required=1 items are enforced at submission time (resident must attach a file per one);
-- required=0 items are informational / situational and can be skipped. See db.js createRequest().
INSERT INTO document_type_requirements (document_type_name, requirement, required, sort_order) VALUES
('Barangay Clearance','Valid Government ID (original + photocopy)',1,1),
('Barangay Clearance','Proof of Residency (utility bill)',1,2),
('Barangay Clearance','1 piece 2x2 ID photo',0,3),
('Barangay Clearance','Accomplished application form',0,4),
('Indigency Certificate','Valid Government ID (original + photocopy)',1,1),
('Indigency Certificate','Proof of Residency',0,2),
('Indigency Certificate','Certificate of No Income (if applicable)',0,3),
('Indigency Certificate','Accomplished application form',0,4),
('Residency Certificate','Valid Government ID (original + photocopy)',1,1),
('Residency Certificate','Proof of Residency (at least 6 months)',1,2),
('Residency Certificate','1 piece 2x2 ID photo',0,3),
('Residency Certificate','Accomplished application form',0,4),
('Business Permit','DTI/SEC Registration',1,1),
('Business Permit','Lease Contract or TCT (if owned)',1,2),
('Business Permit','Valid Government ID',1,3),
('Business Permit',"Previous year's tax clearance",0,4),
('Business Permit','Accomplished application form',0,5),
('Good Moral Certificate','Valid Government ID (original + photocopy)',1,1),
('Good Moral Certificate','School ID or Enrollment Form',1,2),
('Good Moral Certificate','1 piece 2x2 ID photo',0,3),
('Good Moral Certificate','Accomplished application form',0,4),
('First-Time Job Seeker Certificate','Valid Government ID (original + photocopy)',1,1),
('First-Time Job Seeker Certificate','Proof of Residency (at least 6 months)',1,2),
('First-Time Job Seeker Certificate','Accomplished application form',0,3),
('Certificate of Cohabitation','Valid Government ID of both partners (original + photocopy)',1,1),
('Certificate of Cohabitation','Proof of Cohabitation (joint utility bill, lease, or similar)',1,2),
('Certificate of Cohabitation','Sworn statement of neighbors/community members',0,3),
('Certificate of Cohabitation','Accomplished application form',0,4);

INSERT INTO requests (id, resident_id, doc_type, status, purpose, submitted_at, updated_at, fee, paid, address, contact_no, remarks) VALUES
('BR-2025-001','R-ID-001','Barangay Clearance','Pending','Employment','2025-07-18','2025-07-18',50,0,'123 Sampaguita St., Brgy. Campagao','09171234567',NULL),
('BR-2025-002','R-ID-002','Indigency Certificate','Verified','Scholarship Application','2025-07-17','2025-07-18',0,1,'45 Rosal Ave., Brgy. Campagao','09281234567',NULL),
('BR-2025-003','R-ID-001','Residency Certificate','Approved','Bank Requirement','2025-07-16','2025-07-19',50,1,'123 Sampaguita St., Brgy. Campagao','09171234567',NULL),
('BR-2025-004','R-ID-002','Business Permit','Ready for Pickup','Business Renewal','2025-07-14','2025-07-19',200,1,'45 Rosal Ave., Brgy. Campagao','09281234567',NULL),
('BR-2025-005','R-ID-001','Good Moral Certificate','Released','College Enrollment','2025-07-10','2025-07-15',50,1,'123 Sampaguita St., Brgy. Campagao','09171234567',NULL),
('BR-2025-006','R-ID-002','Barangay Clearance','Rejected','Loan Application','2025-07-12','2025-07-14',50,0,'45 Rosal Ave., Brgy. Campagao','09281234567','Incomplete documents submitted. Please resubmit with valid ID.'),
('BR-2025-007','R-ID-001','Indigency Certificate','Pending','Medical Assistance','2025-07-19','2025-07-19',0,1,'123 Sampaguita St., Brgy. Campagao','09171234567',NULL),
('BR-2025-008','R-ID-002','Barangay Clearance','Verified','Travel Requirements','2025-07-18','2025-07-19',50,1,'45 Rosal Ave., Brgy. Campagao','09281234567',NULL);

INSERT INTO notifications (id, user_id, for_role, message, time, is_read) VALUES
('n1','R-ID-001',NULL,'Your Barangay Clearance (BR-2025-001) has been received and is now under review.', NOW(), 0),
('n2','R-ID-001',NULL,'Reminder: Your Residency Certificate request is ready for pickup at the Barangay Hall.', NOW(), 1),
('n3','R-ID-002',NULL,'Request BR-2025-004 status updated to Ready for Pickup. You may now claim your document.', NOW(), 0);

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

DELIMITER $$

-- ---------- USERS / AUTH ----------

-- Residents and staff are separate tables now (see users / staff above) -- these procedures
-- route to the right one by p_role (on create) or by the id's R-ID-/S-ID- prefix (everywhere
-- else), and sp_get_user_by_email / sp_list_users check both since the caller doesn't know
-- which table an email or the full list spans.

DROP PROCEDURE IF EXISTS sp_create_user $$
CREATE PROCEDURE sp_create_user(
  IN p_first_name    VARCHAR(100),
  IN p_middle_name   VARCHAR(100),
  IN p_last_name     VARCHAR(100),
  IN p_gender        VARCHAR(10),
  IN p_date_of_birth DATE,
  IN p_email         VARCHAR(150),
  IN p_password_hash VARCHAR(255),
  IN p_role          VARCHAR(10),
  IN p_address       VARCHAR(255),
  IN p_contact_no    VARCHAR(30),
  OUT p_user_id      VARCHAR(20),
  OUT p_error        VARCHAR(255)
)
BEGIN
  DECLARE v_seq INT;
  DECLARE v_counter VARCHAR(30);
  SET p_error = NULL;

  IF EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER(p_email))
     OR EXISTS (SELECT 1 FROM staff WHERE LOWER(email) = LOWER(p_email)) THEN
    SET p_error = 'An account with this email already exists';
  ELSE
    SET v_counter = IF(p_role = 'staff', 'staff', 'resident');
    UPDATE counters SET value = value + 1 WHERE name = v_counter;
    SELECT value INTO v_seq FROM counters WHERE name = v_counter;
    SET p_user_id = CONCAT(IF(p_role = 'staff', 'S-ID-', 'R-ID-'), LPAD(v_seq, 3, '0'));

    IF p_role = 'staff' THEN
      INSERT INTO staff (id, first_name, middle_name, last_name, gender, date_of_birth, email, password_hash, address, contact_no, status, joined)
      VALUES (p_user_id, p_first_name, IFNULL(p_middle_name,''), p_last_name, p_gender, p_date_of_birth, p_email, p_password_hash, IFNULL(p_address,''), IFNULL(p_contact_no,''), 'Approved', CURDATE());
    ELSE
      INSERT INTO users (id, first_name, middle_name, last_name, gender, date_of_birth, email, password_hash, address, contact_no, status, joined)
      VALUES (p_user_id, p_first_name, IFNULL(p_middle_name,''), p_last_name, p_gender, p_date_of_birth, p_email, p_password_hash, IFNULL(p_address,''), IFNULL(p_contact_no,''), 'Approved', CURDATE());
    END IF;
  END IF;
END $$

DROP PROCEDURE IF EXISTS sp_get_user_by_email $$
CREATE PROCEDURE sp_get_user_by_email(IN p_email VARCHAR(150))
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER(p_email)) THEN
    SELECT *, 'resident' AS role FROM users WHERE LOWER(email) = LOWER(p_email) LIMIT 1;
  ELSE
    SELECT *, 'staff' AS role FROM staff WHERE LOWER(email) = LOWER(p_email) LIMIT 1;
  END IF;
END $$

DROP PROCEDURE IF EXISTS sp_get_user_by_id $$
CREATE PROCEDURE sp_get_user_by_id(IN p_user_id VARCHAR(20))
BEGIN
  IF p_user_id LIKE 'S-ID-%' THEN
    SELECT *, 'staff' AS role FROM staff WHERE id = p_user_id LIMIT 1;
  ELSE
    SELECT *, 'resident' AS role FROM users WHERE id = p_user_id LIMIT 1;
  END IF;
END $$

DROP PROCEDURE IF EXISTS sp_list_users $$
CREATE PROCEDURE sp_list_users()
BEGIN
  SELECT *, 'resident' AS role FROM users
  UNION ALL
  SELECT *, 'staff' AS role FROM staff
  ORDER BY joined DESC;
END $$

DROP PROCEDURE IF EXISTS sp_update_user_status $$
CREATE PROCEDURE sp_update_user_status(IN p_user_id VARCHAR(20), IN p_status VARCHAR(10))
BEGIN
  IF p_user_id LIKE 'S-ID-%' THEN
    UPDATE staff SET status = p_status WHERE id = p_user_id;
    SELECT *, 'staff' AS role FROM staff WHERE id = p_user_id;
  ELSE
    UPDATE users SET status = p_status WHERE id = p_user_id;
    SELECT *, 'resident' AS role FROM users WHERE id = p_user_id;
  END IF;
END $$

-- ---------- ADMIN / AUTH ----------
-- Used by server/src/db.js getAdminByEmail() / getAdminById() (login + session restore for the admin role).
-- Both are plain SELECTs with no OUT params, so they're safe to CALL through a pooled connection.

DROP PROCEDURE IF EXISTS sp_get_admin_by_email $$
CREATE PROCEDURE sp_get_admin_by_email(IN p_email VARCHAR(150))
BEGIN
  SELECT * FROM admin WHERE LOWER(email) = LOWER(p_email) LIMIT 1;
END $$

DROP PROCEDURE IF EXISTS sp_get_admin_by_id $$
CREATE PROCEDURE sp_get_admin_by_id(IN p_admin_id INT)
BEGIN
  SELECT * FROM admin WHERE id = p_admin_id LIMIT 1;
END $$

-- ---------- DOCUMENT TYPES ----------

DROP PROCEDURE IF EXISTS sp_list_document_types $$
CREATE PROCEDURE sp_list_document_types()
BEGIN
  SELECT dt.name, dt.fee, GROUP_CONCAT(dtr.requirement ORDER BY dtr.sort_order SEPARATOR '||') AS requirements
  FROM document_types dt
  LEFT JOIN document_type_requirements dtr ON dtr.document_type_name = dt.name
  GROUP BY dt.name, dt.fee;
END $$

DROP PROCEDURE IF EXISTS sp_add_document_type $$
CREATE PROCEDURE sp_add_document_type(
  IN p_name VARCHAR(100),
  IN p_fee  DECIMAL(10,2),
  OUT p_error VARCHAR(255)
)
BEGIN
  SET p_error = NULL;
  IF EXISTS (SELECT 1 FROM document_types WHERE name = p_name) THEN
    SET p_error = 'Document type already exists';
  ELSE
    INSERT INTO document_types (name, fee) VALUES (p_name, p_fee);
  END IF;
END $$

DROP PROCEDURE IF EXISTS sp_add_document_type_requirement $$
CREATE PROCEDURE sp_add_document_type_requirement(
  IN p_document_type_name VARCHAR(100),
  IN p_requirement        VARCHAR(255),
  IN p_sort_order         INT
)
BEGIN
  INSERT INTO document_type_requirements (document_type_name, requirement, sort_order)
  VALUES (p_document_type_name, p_requirement, p_sort_order);
END $$

DROP PROCEDURE IF EXISTS sp_update_document_type_fee $$
CREATE PROCEDURE sp_update_document_type_fee(IN p_name VARCHAR(100), IN p_fee DECIMAL(10,2))
BEGIN
  UPDATE document_types SET fee = p_fee WHERE name = p_name;
END $$

DROP PROCEDURE IF EXISTS sp_replace_document_type_requirements $$
CREATE PROCEDURE sp_replace_document_type_requirements(IN p_document_type_name VARCHAR(100))
BEGIN
  DELETE FROM document_type_requirements WHERE document_type_name = p_document_type_name;
END $$

-- ---------- REQUESTS ----------

DROP PROCEDURE IF EXISTS sp_create_request $$
CREATE PROCEDURE sp_create_request(
  IN p_resident_id VARCHAR(20),
  IN p_doc_type    VARCHAR(100),
  IN p_purpose     VARCHAR(255),
  OUT p_request_id VARCHAR(20),
  OUT p_error      VARCHAR(255)
)
BEGIN
  DECLARE v_seq INT;
  DECLARE v_fee DECIMAL(10,2);
  DECLARE v_address VARCHAR(255);
  DECLARE v_contact_no VARCHAR(30);
  SET p_error = NULL;

  IF NOT EXISTS (SELECT 1 FROM document_types WHERE name = p_doc_type) THEN
    SET p_error = 'Unknown document type';
  ELSE
    SELECT fee INTO v_fee FROM document_types WHERE name = p_doc_type;
    SELECT address, contact_no INTO v_address, v_contact_no FROM users WHERE id = p_resident_id;

    UPDATE counters SET value = value + 1 WHERE name = 'request';
    SELECT value INTO v_seq FROM counters WHERE name = 'request';
    SET p_request_id = CONCAT('BR-', YEAR(CURDATE()), '-', LPAD(v_seq, 3, '0'));

    INSERT INTO requests (id, resident_id, doc_type, status, purpose, submitted_at, updated_at, fee, paid, address, contact_no)
    VALUES (p_request_id, p_resident_id, p_doc_type, 'Pending', p_purpose, CURDATE(), CURDATE(), v_fee, (v_fee = 0), v_address, v_contact_no);
  END IF;
END $$

DROP PROCEDURE IF EXISTS sp_add_request_file $$
CREATE PROCEDURE sp_add_request_file(
  IN p_request_id    VARCHAR(20),
  IN p_original_name VARCHAR(255),
  IN p_stored_name   VARCHAR(255)
)
BEGIN
  INSERT INTO request_files (request_id, original_name, stored_name) VALUES (p_request_id, p_original_name, p_stored_name);
END $$

DROP PROCEDURE IF EXISTS sp_list_requests_for_resident $$
CREATE PROCEDURE sp_list_requests_for_resident(IN p_resident_id VARCHAR(20))
BEGIN
  SELECT * FROM requests WHERE resident_id = p_resident_id ORDER BY submitted_at DESC;
END $$

DROP PROCEDURE IF EXISTS sp_list_all_requests $$
CREATE PROCEDURE sp_list_all_requests()
BEGIN
  SELECT * FROM requests ORDER BY submitted_at DESC;
END $$

DROP PROCEDURE IF EXISTS sp_get_request $$
CREATE PROCEDURE sp_get_request(IN p_request_id VARCHAR(20))
BEGIN
  SELECT * FROM requests WHERE id = p_request_id;
  SELECT * FROM request_files WHERE request_id = p_request_id;
END $$

DROP PROCEDURE IF EXISTS sp_update_request_status $$
CREATE PROCEDURE sp_update_request_status(
  IN p_request_id VARCHAR(20),
  IN p_new_status VARCHAR(20),
  IN p_remarks    VARCHAR(500),
  IN p_actor_role VARCHAR(10),
  OUT p_error     VARCHAR(255)
)
BEGIN
  DECLARE v_current_status VARCHAR(20);
  DECLARE v_fee DECIMAL(10,2);
  SET p_error = NULL;

  SELECT status, fee INTO v_current_status, v_fee FROM requests WHERE id = p_request_id;

  IF v_current_status IS NULL THEN
    SET p_error = 'Request not found';
  ELSEIF NOT (
       (v_current_status = 'Pending' AND p_new_status IN ('Verified','Rejected'))
    OR (v_current_status = 'Verified' AND p_new_status = 'Approved' AND p_actor_role = 'admin')
    OR (v_current_status = 'Approved' AND p_new_status = 'Ready for Pickup')
    OR (v_current_status = 'Ready for Pickup' AND p_new_status = 'Released')
  ) THEN
    SET p_error = CONCAT('Cannot change status from ', v_current_status, ' to ', p_new_status);
  ELSE
    UPDATE requests
    SET status = p_new_status,
        updated_at = CURDATE(),
        remarks = IFNULL(p_remarks, remarks),
        paid = IF(p_new_status IN ('Verified','Approved'), (paid = 1 OR fee = 0), paid)
    WHERE id = p_request_id;
  END IF;
END $$

-- ---------- NOTIFICATIONS ----------

DROP PROCEDURE IF EXISTS sp_notify_user $$
CREATE PROCEDURE sp_notify_user(
  IN p_user_id VARCHAR(20),
  IN p_message VARCHAR(500),
  OUT p_notification_id VARCHAR(20)
)
BEGIN
  DECLARE v_seq INT;
  UPDATE counters SET value = value + 1 WHERE name = 'notification';
  SELECT value INTO v_seq FROM counters WHERE name = 'notification';
  SET p_notification_id = CONCAT('n', v_seq);
  INSERT INTO notifications (id, user_id, for_role, message, time, is_read)
  VALUES (p_notification_id, p_user_id, NULL, p_message, NOW(), 0);
END $$

DROP PROCEDURE IF EXISTS sp_notify_role $$
CREATE PROCEDURE sp_notify_role(
  IN p_role VARCHAR(10),
  IN p_message VARCHAR(500),
  OUT p_notification_id VARCHAR(20)
)
BEGIN
  DECLARE v_seq INT;
  UPDATE counters SET value = value + 1 WHERE name = 'notification';
  SELECT value INTO v_seq FROM counters WHERE name = 'notification';
  SET p_notification_id = CONCAT('n', v_seq);
  INSERT INTO notifications (id, user_id, for_role, message, time, is_read)
  VALUES (p_notification_id, NULL, p_role, p_message, NOW(), 0);
END $$

DROP PROCEDURE IF EXISTS sp_list_notifications_for_user $$
CREATE PROCEDURE sp_list_notifications_for_user(IN p_user_id VARCHAR(20))
BEGIN
  SELECT * FROM notifications WHERE user_id = p_user_id ORDER BY time DESC;
END $$

DROP PROCEDURE IF EXISTS sp_list_notifications_for_role $$
CREATE PROCEDURE sp_list_notifications_for_role(IN p_role VARCHAR(10))
BEGIN
  SELECT * FROM notifications WHERE for_role = p_role ORDER BY time DESC;
END $$

DROP PROCEDURE IF EXISTS sp_mark_notification_read $$
CREATE PROCEDURE sp_mark_notification_read(IN p_notification_id VARCHAR(20))
BEGIN
  UPDATE notifications SET is_read = 1 WHERE id = p_notification_id;
  SELECT * FROM notifications WHERE id = p_notification_id;
END $$

-- ---------- REPORTS ----------

DROP PROCEDURE IF EXISTS sp_report_monthly_requests $$
CREATE PROCEDURE sp_report_monthly_requests()
BEGIN
  DECLARE i INT DEFAULT 5;
  DROP TEMPORARY TABLE IF EXISTS tmp_months;
  CREATE TEMPORARY TABLE tmp_months (month_start DATE, month_label VARCHAR(3));

  WHILE i >= 0 DO
    INSERT INTO tmp_months (month_start, month_label)
    VALUES (
      DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL i MONTH),
      DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL i MONTH), '%b')
    );
    SET i = i - 1;
  END WHILE;

  SELECT tm.month_label AS month, COUNT(r.id) AS requests
  FROM tmp_months tm
  LEFT JOIN requests r
    ON DATE_FORMAT(r.submitted_at, '%Y-%m-01') = tm.month_start
  GROUP BY tm.month_start, tm.month_label
  ORDER BY tm.month_start;

  DROP TEMPORARY TABLE IF EXISTS tmp_months;
END $$

DROP PROCEDURE IF EXISTS sp_report_document_distribution $$
CREATE PROCEDURE sp_report_document_distribution()
BEGIN
  SELECT dt.name, COUNT(r.id) AS value
  FROM document_types dt
  LEFT JOIN requests r ON r.doc_type = dt.name
  GROUP BY dt.name;
END $$

DROP PROCEDURE IF EXISTS sp_report_status_counts $$
CREATE PROCEDURE sp_report_status_counts()
BEGIN
  SELECT status, COUNT(*) AS count FROM requests GROUP BY status;
END $$

DROP PROCEDURE IF EXISTS sp_report_revenue_summary $$
CREATE PROCEDURE sp_report_revenue_summary()
BEGIN
  SELECT
    (SELECT COUNT(*) FROM requests WHERE YEAR(submitted_at) = YEAR(CURDATE()) AND MONTH(submitted_at) = MONTH(CURDATE())) AS total_this_month,
    (SELECT COUNT(*) FROM requests WHERE status = 'Released' AND YEAR(submitted_at) = YEAR(CURDATE()) AND MONTH(submitted_at) = MONTH(CURDATE())) AS released_this_month,
    (SELECT IFNULL(SUM(fee), 0) FROM requests WHERE paid = 1) AS revenue;
END $$

DELIMITER ;
