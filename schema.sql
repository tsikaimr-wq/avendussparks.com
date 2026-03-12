CREATE DATABASE IF NOT EXISTS avendus_capital;
USE avendus_capital;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mobile VARCHAR(15) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    kyc VARCHAR(20) DEFAULT 'Pending',
    credit_score INT DEFAULT 100,
    vip INT DEFAULT 0,
    balance DECIMAL(20, 2) DEFAULT 0.00,
    invested DECIMAL(20, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS withdrawals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    bank_name VARCHAR(100),
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    sender ENUM('User', 'Admin') DEFAULT 'User',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insert default admin
INSERT INTO admins (username, password) VALUES ('admin', 'admin123')
ON DUPLICATE KEY UPDATE username=username;

-- Insert default user
INSERT INTO users (id, mobile, password, username, kyc, credit_score, vip, balance, invested)
VALUES (1, '918108038029', 'password123', 'Sharad Madhukar Mali', 'Approved', 100, 0, 0.00, 46410128.48)
ON DUPLICATE KEY UPDATE mobile=mobile;

-- Insert some dummy data for the default user (id=1)
INSERT INTO deposits (user_id, amount, status, created_at) VALUES
(1, 3774250.00, 'Approved', '2026-01-01 10:23:00'),
(1, 8000.00, 'Approved', '2025-12-26 14:37:00'),
(1, 150000.00, 'Pending', '2026-02-02 09:15:00');

INSERT INTO withdrawals (user_id, amount, bank_name, status, created_at) VALUES
(1, 5000000.00, 'SBI', 'Rejected', '2026-01-01 10:41:00'),
(1, 50000.00, 'SBI', 'Approved', '2025-12-19 14:56:00');

CREATE TABLE IF NOT EXISTS loans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    reason TEXT,
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
