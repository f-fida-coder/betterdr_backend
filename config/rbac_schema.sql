-- ========================================
-- ROLE-BASED ACCESS CONTROL SCHEMA
-- Sports Gaming Platform
-- Database: MySQL 8.0+ / PostgreSQL 12+
-- ========================================

-- ========================================
-- 1. CORE USERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  phone VARCHAR(20),
  
  -- Role and Hierarchy
  role ENUM('ADMIN', 'AGENT', 'USER') NOT NULL DEFAULT 'USER',
  parent_id INT COMMENT 'References parent agent (NULL for ADMIN/Top-level AGENT)',
  
  -- Account Status
  status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED') DEFAULT 'ACTIVE',
  
  -- Financial & Limits
  balance DECIMAL(12, 2) DEFAULT 0.00 COMMENT 'Current wallet balance',
  total_wagered DECIMAL(15, 2) DEFAULT 0.00 COMMENT 'Lifetime total bets',
  lifetime_winnings DECIMAL(15, 2) DEFAULT 0.00 COMMENT 'Lifetime total winnings',
  
  -- Preferences & Settings
  preferred_language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50),
  notifications_enabled BOOLEAN DEFAULT TRUE,
  
  -- KYC & Verification
  kyc_status ENUM('PENDING', 'VERIFIED', 'REJECTED') DEFAULT 'PENDING',
  kyc_verified_at TIMESTAMP NULL,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL COMMENT 'Soft delete for audit compliance',
  
  -- Indexes for Query Performance
  KEY idx_role (role),
  KEY idx_parent_id (parent_id),
  KEY idx_email (email),
  KEY idx_status (status),
  KEY idx_created_at (created_at),
  KEY idx_role_status (role, status),
  KEY idx_parent_status (parent_id, status),
  
  -- Foreign Key for Hierarchy
  FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Core users table supporting role-based hierarchy';

-- ========================================
-- 2. ROLES & PERMISSIONS MAPPING
-- ========================================
CREATE TABLE IF NOT EXISTS roles_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role ENUM('ADMIN', 'AGENT', 'USER') NOT NULL,
  permission VARCHAR(100) NOT NULL COMMENT 'Permission identifier',
  description TEXT COMMENT 'Human-readable description',
  category VARCHAR(50) COMMENT 'Permission category',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_role_permission (role, permission),
  KEY idx_role (role),
  KEY idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Mapping of roles to permissions';

-- ========================================
-- 3. AUDIT LOGS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'Admin making the change',
  action VARCHAR(100) NOT NULL COMMENT 'Action performed',
  entity_type VARCHAR(50) COMMENT 'Type of entity modified',
  entity_id INT COMMENT 'ID of entity modified',
  old_values JSON COMMENT 'Previous values (before update)',
  new_values JSON COMMENT 'Updated values (after update)',
  ip_address VARCHAR(45) COMMENT 'IPv4 or IPv6 address',
  user_agent TEXT COMMENT 'User agent string',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_user_id (user_id),
  KEY idx_action (action),
  KEY idx_entity (entity_type, entity_id),
  KEY idx_created_at (created_at),
  KEY idx_action_time (action, created_at),
  
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Immutable audit trail for compliance and debugging'
PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p_2025 VALUES LESS THAN (2026),
  PARTITION p_2026 VALUES LESS THAN (2027),
  PARTITION p_2027 VALUES LESS THAN (2028),
  PARTITION pmax VALUES LESS THAN MAXVALUE
);

-- ========================================
-- 4. AGENT HIERARCHY TABLE (DENORMALIZED)
-- ========================================
CREATE TABLE IF NOT EXISTS agent_hierarchy (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id INT NOT NULL UNIQUE COMMENT 'References users table (agent)',
  parent_agent_id INT COMMENT 'Direct parent agent (NULL if under ADMIN)',
  agent_level INT COMMENT 'Depth: 1=Direct under ADMIN, 2+=Sub-agents',
  total_users INT DEFAULT 0 COMMENT 'Count of direct users (denormalized)',
  total_sub_agents INT DEFAULT 0 COMMENT 'Count of direct sub-agents',
  total_revenue DECIMAL(15, 2) DEFAULT 0.00 COMMENT 'Cached monthly revenue',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY idx_parent_agent (parent_agent_id),
  KEY idx_agent_level (agent_level),
  KEY idx_total_users (total_users),
  
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_agent_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Optimized agent hierarchy with cached counts';

-- ========================================
-- 5. AGENT COMMISSIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS agent_commissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id INT NOT NULL,
  period_start DATE NOT NULL COMMENT 'Commission period start',
  period_end DATE NOT NULL COMMENT 'Commission period end',
  
  users_wagered DECIMAL(15, 2) DEFAULT 0.00 COMMENT 'Sum of user bets',
  house_profit DECIMAL(15, 2) DEFAULT 0.00 COMMENT 'Platform profit from bets',
  agent_commission DECIMAL(15, 2) DEFAULT 0.00 COMMENT 'Calculated commission amount',
  commission_rate DECIMAL(5, 2) COMMENT 'Commission percentage',
  
  status ENUM('PENDING', 'APPROVED', 'PAID') DEFAULT 'PENDING',
  paid_at TIMESTAMP NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY idx_agent_id (agent_id),
  KEY idx_period (period_start, period_end),
  KEY idx_status (status),
  KEY idx_agent_period (agent_id, period_start),
  
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Commission tracking per agent per period';

-- ========================================
-- 6. BETS TABLE (GAMING CORE)
-- ========================================
CREATE TABLE IF NOT EXISTS bets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'User placing bet',
  agent_id INT NOT NULL COMMENT 'Denormalized: user agent for reporting',
  
  match_id INT NOT NULL COMMENT 'Sports match/event ID',
  bet_type VARCHAR(50) NOT NULL COMMENT 'WIN, DRAW, LOSE, OVER, UNDER, etc',
  
  stake DECIMAL(12, 2) NOT NULL COMMENT 'Bet amount',
  odds DECIMAL(10, 4) NOT NULL COMMENT 'Betting odds',
  potential_winnings DECIMAL(12, 2) COMMENT 'Potential payout if won',
  
  status ENUM('PENDING', 'WON', 'LOST', 'REFUNDED', 'CANCELLED') DEFAULT 'PENDING',
  settled_at TIMESTAMP NULL COMMENT 'When bet was settled',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY idx_user_id (user_id),
  KEY idx_agent_id (agent_id),
  KEY idx_match_id (match_id),
  KEY idx_status (status),
  KEY idx_created_at (created_at),
  KEY idx_user_created (user_id, created_at),
  KEY idx_agent_status (agent_id, status, created_at),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Betting records - HIGH VOLUME TABLE'
PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p_2025 VALUES LESS THAN (2026),
  PARTITION p_2026 VALUES LESS THAN (2027),
  PARTITION p_2027 VALUES LESS THAN (2028),
  PARTITION pmax VALUES LESS THAN MAXVALUE
);

-- ========================================
-- 7. TRANSACTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'User account owner',
  agent_id INT COMMENT 'Denormalized: user agent',
  
  transaction_type ENUM('DEPOSIT', 'WITHDRAWAL', 'BET_STAKE', 'BET_WINNINGS', 'BONUS', 'COMMISSION', 'REFUND', 'CHARGEBACK') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL COMMENT 'Transaction amount',
  balance_before DECIMAL(12, 2) COMMENT 'Balance before transaction',
  balance_after DECIMAL(12, 2) COMMENT 'Balance after transaction',
  
  reference_id VARCHAR(100) COMMENT 'Links to bets, deposits, etc',
  reference_type VARCHAR(50) COMMENT 'BET, DEPOSIT, COMMISSION, etc',
  
  status ENUM('PENDING', 'COMPLETED', 'FAILED', 'REVERSED') DEFAULT 'PENDING',
  description TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY idx_user_id (user_id),
  KEY idx_agent_id (agent_id),
  KEY idx_type (transaction_type),
  KEY idx_status (status),
  KEY idx_created_at (created_at),
  KEY idx_user_type (user_id, transaction_type),
  KEY idx_reference (reference_type, reference_id),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (agent_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='All user financial transactions'
PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p_2025 VALUES LESS THAN (2026),
  PARTITION p_2026 VALUES LESS THAN (2027),
  PARTITION p_2027 VALUES LESS THAN (2028),
  PARTITION pmax VALUES LESS THAN MAXVALUE
);

-- ========================================
-- 8. PERMISSIONS SEED DATA
-- ========================================
INSERT IGNORE INTO roles_permissions (role, permission, description, category) VALUES
-- ADMIN Permissions
('ADMIN', 'admin.create_agent', 'Create new agent accounts', 'user_management'),
('ADMIN', 'admin.create_user', 'Create new user accounts', 'user_management'),
('ADMIN', 'admin.view_all_users', 'View all users in system', 'user_management'),
('ADMIN', 'admin.view_all_agents', 'View all agents in system', 'user_management'),
('ADMIN', 'admin.edit_user', 'Edit any user profile', 'user_management'),
('ADMIN', 'admin.suspend_user', 'Suspend/ban any user', 'user_management'),
('ADMIN', 'admin.delete_user', 'Delete any user', 'user_management'),

('ADMIN', 'financial.approve_withdrawal', 'Approve user withdrawals', 'financial'),
('ADMIN', 'financial.view_all_transactions', 'View all transactions', 'financial'),
('ADMIN', 'financial.refund_bet', 'Refund bets to users', 'financial'),
('ADMIN', 'financial.approve_commission', 'Approve agent commissions', 'financial'),

('ADMIN', 'betting.settle_bets', 'Settle/finalize bets', 'betting'),
('ADMIN', 'betting.view_all_bets', 'View all bets in system', 'betting'),
('ADMIN', 'betting.manage_odds', 'Manage sports odds', 'betting'),

('ADMIN', 'reporting.view_analytics', 'View platform analytics', 'reporting'),
('ADMIN', 'reporting.view_audit_logs', 'View audit logs', 'reporting'),
('ADMIN', 'reporting.generate_reports', 'Generate system reports', 'reporting'),

('ADMIN', 'system.configure', 'System configuration', 'system'),
('ADMIN', 'system.manage_matches', 'Manage sports matches', 'system'),

-- AGENT Permissions
('AGENT', 'agent.create_user', 'Create users under self', 'user_management'),
('AGENT', 'agent.view_users', 'View own users', 'user_management'),
('AGENT', 'agent.edit_user', 'Edit own users', 'user_management'),
('AGENT', 'agent.suspend_user', 'Suspend/ban own users', 'user_management'),

('AGENT', 'financial.approve_withdrawal', 'Approve own user withdrawals', 'financial'),
('AGENT', 'financial.view_transactions', 'View own user transactions', 'financial'),
('AGENT', 'financial.deposit_user', 'Deposit to own users', 'financial'),

('AGENT', 'betting.view_bets', 'View own users bets', 'betting'),

('AGENT', 'reporting.view_commission', 'View own commission', 'reporting'),
('AGENT', 'reporting.generate_reports', 'Generate own reports', 'reporting'),

-- USER Permissions
('USER', 'user.edit_profile', 'Edit own profile', 'user_management'),
('USER', 'user.change_password', 'Change own password', 'user_management'),

('USER', 'financial.deposit', 'Deposit to own account', 'financial'),
('USER', 'financial.withdraw', 'Withdraw from own account', 'financial'),
('USER', 'financial.view_balance', 'View own balance', 'financial'),
('USER', 'financial.view_transactions', 'View own transactions', 'financial'),

('USER', 'betting.place_bet', 'Place bets', 'betting'),
('USER', 'betting.view_bets', 'View own bets', 'betting');

-- ========================================
-- 9. INITIAL ADMIN USER (OPTIONAL SEED)
-- ========================================
-- Uncomment to seed default admin
-- Password should be hashed using bcrypt (12 rounds)
-- Raw password example: "admin123" -> bcrypt hash
/*
INSERT IGNORE INTO users 
(username, email, password_hash, full_name, role, status, kyc_status)
VALUES 
('admin', 'admin@sports-gaming.local', '$2b$12$...bcrypt_hash_here...', 'System Administrator', 'ADMIN', 'ACTIVE', 'VERIFIED');
*/

-- ========================================
-- 10. VIEWS FOR COMMON QUERIES
-- ========================================

-- View: All agents with user counts
CREATE OR REPLACE VIEW v_agents_overview AS
SELECT 
  u.id,
  u.username,
  u.email,
  u.full_name,
  u.status,
  ah.total_users,
  ah.total_sub_agents,
  ah.agent_level,
  u.created_at
FROM users u
LEFT JOIN agent_hierarchy ah ON u.id = ah.agent_id
WHERE u.role = 'AGENT'
ORDER BY u.created_at DESC;

-- View: User hierarchy with agent info
CREATE OR REPLACE VIEW v_user_hierarchy AS
SELECT 
  u.id,
  u.username,
  u.email,
  u.role,
  u.status,
  u.created_at,
  parent.username AS parent_username,
  parent.id AS parent_id,
  parent.role AS parent_role
FROM users u
LEFT JOIN users parent ON u.parent_id = parent.id
WHERE u.role = 'USER'
ORDER BY u.parent_id, u.created_at;

-- View: Agent commission summary
CREATE OR REPLACE VIEW v_commission_summary AS
SELECT 
  a.agent_id,
  u.username,
  a.period_start,
  a.period_end,
  a.users_wagered,
  a.house_profit,
  a.agent_commission,
  a.commission_rate,
  a.status
FROM agent_commissions a
JOIN users u ON a.agent_id = u.id
ORDER BY a.agent_id, a.period_start DESC;

-- ========================================
-- 11. STORED PROCEDURES FOR COMMON OPERATIONS
-- ========================================

DELIMITER //

-- Procedure: Get all users under an agent (recursive)
CREATE PROCEDURE IF NOT EXISTS sp_get_agent_users(IN p_agent_id INT)
BEGIN
  WITH RECURSIVE agent_users AS (
    -- Direct users
    SELECT id, username, email, parent_id, 0 as depth
    FROM users
    WHERE parent_id = p_agent_id AND role = 'USER'
    
    UNION ALL
    
    -- Sub-agent users
    SELECT u.id, u.username, u.email, u.parent_id, au.depth + 1
    FROM users u
    INNER JOIN agent_users au ON u.parent_id = au.id
    WHERE u.role = 'USER'
  )
  SELECT * FROM agent_users
  ORDER BY depth, username;
END //

-- Procedure: Calculate agent commission for period
CREATE PROCEDURE IF NOT EXISTS sp_calculate_commission(
  IN p_agent_id INT,
  IN p_period_start DATE,
  IN p_period_end DATE,
  IN p_commission_rate DECIMAL(5,2)
)
BEGIN
  DECLARE v_total_wagered DECIMAL(15,2);
  DECLARE v_house_profit DECIMAL(15,2);
  DECLARE v_commission DECIMAL(15,2);
  
  -- Sum all user bets for period
  SELECT COALESCE(SUM(stake), 0)
  INTO v_total_wagered
  FROM bets
  WHERE agent_id = p_agent_id
    AND created_at BETWEEN p_period_start AND LAST_DAY(p_period_end);
  
  -- Calculate house profit (simplified: assume 5% margin on bets)
  SET v_house_profit = v_total_wagered * 0.05;
  
  -- Calculate commission
  SET v_commission = v_house_profit * (p_commission_rate / 100);
  
  -- Insert or update commission record
  INSERT INTO agent_commissions 
  (agent_id, period_start, period_end, users_wagered, house_profit, agent_commission, commission_rate)
  VALUES (p_agent_id, p_period_start, p_period_end, v_total_wagered, v_house_profit, v_commission, p_commission_rate)
  ON DUPLICATE KEY UPDATE
    users_wagered = v_total_wagered,
    house_profit = v_house_profit,
    agent_commission = v_commission,
    updated_at = CURRENT_TIMESTAMP;
  
  SELECT 'Commission calculated' as status, v_commission as amount;
END //

-- Procedure: Soft delete user and audit
CREATE PROCEDURE IF NOT EXISTS sp_delete_user(
  IN p_user_id INT,
  IN p_admin_id INT,
  IN p_reason TEXT
)
BEGIN
  DECLARE v_old_status VARCHAR(50);
  
  -- Get old status
  SELECT status INTO v_old_status FROM users WHERE id = p_user_id;
  
  -- Update user
  UPDATE users
  SET status = 'INACTIVE', deleted_at = NOW()
  WHERE id = p_user_id;
  
  -- Log to audit
  INSERT INTO audit_logs 
  (user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES 
  (p_admin_id, 'delete_user', 'users', p_user_id, 
   JSON_OBJECT('status', v_old_status),
   JSON_OBJECT('status', 'INACTIVE', 'deleted_at', NOW(), 'reason', p_reason));
  
  SELECT 'User deleted successfully' as status;
END //

DELIMITER ;

-- ========================================
-- 12. TRIGGERS FOR DATA CONSISTENCY
-- ========================================

DELIMITER //

-- Trigger: Update agent_hierarchy when new agent created
CREATE TRIGGER IF NOT EXISTS tr_agent_insert AFTER INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.role = 'AGENT' THEN
    INSERT INTO agent_hierarchy (agent_id, parent_agent_id, agent_level)
    VALUES (
      NEW.id,
      NEW.parent_id,
      CASE 
        WHEN NEW.parent_id IS NULL THEN 1
        ELSE (SELECT agent_level + 1 FROM agent_hierarchy WHERE agent_id = NEW.parent_id)
      END
    );
  END IF;
END //

-- Trigger: Update agent user counts when user created
CREATE TRIGGER IF NOT EXISTS tr_user_insert AFTER INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.role = 'USER' AND NEW.parent_id IS NOT NULL THEN
    UPDATE agent_hierarchy
    SET total_users = total_users + 1
    WHERE agent_id = NEW.parent_id;
  END IF;
END //

-- Trigger: Update agent user counts when user deleted
CREATE TRIGGER IF NOT EXISTS tr_user_delete AFTER DELETE ON users
FOR EACH ROW
BEGIN
  IF OLD.role = 'USER' AND OLD.parent_id IS NOT NULL THEN
    UPDATE agent_hierarchy
    SET total_users = total_users - 1
    WHERE agent_id = OLD.parent_id AND total_users > 0;
  END IF;
END //

-- Trigger: Prevent user from changing role
CREATE TRIGGER IF NOT EXISTS tr_prevent_role_change BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  IF OLD.role != NEW.role AND OLD.role != 'USER' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot change role for existing users. Create new user instead.';
  END IF;
END //

DELIMITER ;

-- ========================================
-- FINAL: Set up basic constraints
-- ========================================

-- Ensure ADMIN has no parent
ALTER TABLE users ADD CONSTRAINT chk_admin_no_parent 
CHECK (role != 'ADMIN' OR parent_id IS NULL);

-- Ensure USER cannot have children
ALTER TABLE users ADD CONSTRAINT chk_user_no_children
CHECK (role != 'USER' OR id NOT IN (SELECT parent_id FROM users WHERE parent_id IS NOT NULL));

COMMIT;
