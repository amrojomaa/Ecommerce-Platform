-- Migration script to add last_updated_by column to tickets table
-- Run this script in your PostgreSQL database

ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS last_updated_by INTEGER;

-- Add foreign key constraint
ALTER TABLE tickets
ADD CONSTRAINT fk_tickets_last_updated_by 
FOREIGN KEY (last_updated_by) 
REFERENCES users(id) 
ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN tickets.last_updated_by IS 'Tracks which user last updated the ticket (for notification purposes)';
