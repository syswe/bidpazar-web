-- init.sql - PostgreSQL initialization script for BidPazar

-- Create the main database if it doesn't exist
-- CREATE DATABASE bidpazar;

-- Connect to the bidpazar database
\c bidpazar;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Set timezone
SET timezone = 'Europe/Istanbul';

-- Create indexes for better performance (these will be created by Prisma migrations)
-- This file mainly serves as a placeholder for any custom database setup

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE bidpazar TO "user";
GRANT ALL PRIVILEGES ON SCHEMA public TO "user";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "user";

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO "user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO "user";

-- Ensure UTF-8 encoding
ALTER DATABASE bidpazar SET client_encoding TO 'utf8';
ALTER DATABASE bidpazar SET default_transaction_isolation TO 'read committed';
ALTER DATABASE bidpazar SET timezone TO 'Europe/Istanbul'; 