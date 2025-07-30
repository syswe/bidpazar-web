-- Create test users for development
-- This script creates the same test users as the TypeScript version
-- Passwords: streamer1=password1, watcher1=password2, watcher2=password3

-- Insert test users with bcrypt hashed passwords
-- Using INSERT ... ON CONFLICT DO NOTHING to avoid duplicate entries

INSERT INTO "User" (
    email,
    username,
    password,
    name,
    "isVerified",
    "userType"
) VALUES 
    (
        'streamer1@test.com',
        'streamer1',
        '$2a$10$PTZIYRUf0x394y492uc0fe/VsxM.tOmUl0sgvELIkzrTxwjCyFwKy',
        'streamer1',
        true,
        'MEMBER'
    ),
    (
        'watcher1@test.com',
        'watcher1',
        '$2a$10$6s1CzNKizqqh3QSd/xCFVevKana1H1dpv41b4XU/j9yld53UrJ5LW',
        'watcher1',
        true,
        'MEMBER'
    ),
    (
        'watcher2@test.com',
        'watcher2',
        '$2a$10$zr8zZs4F1lI.D6NgygWG5uZ2..2L7AQ.quB0pqxD2DCsatqOOQVue',
        'watcher2',
        true,
        'MEMBER'
    )
ON CONFLICT (email) DO NOTHING;

-- Print completion message
SELECT 'Test users created successfully!' as message;

-- Show created users
SELECT 
    username,
    email,
    name,
    "isVerified",
    "userType",
    "createdAt"
FROM "User" 
WHERE email LIKE '%@test.com'
ORDER BY username; 