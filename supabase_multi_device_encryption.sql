-- =====================================================
-- Multi-Device E2E Encryption — Database Migration
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. Create user_devices table
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,           -- Unique per-device identifier (UUID generated client-side)
    device_name TEXT NOT NULL,         -- "Chrome Web", "iPhone", "Android", etc.
    public_key TEXT NOT NULL,          -- Base64-encoded X25519 public key
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

-- 2. Enable RLS
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Family members can view device keys (needed to encrypt FOR them)
CREATE POLICY "Family members can view device keys" ON user_devices
    FOR SELECT USING (
        user_id IN (
            SELECT p2.id FROM profiles p1
            JOIN profiles p2 ON p1.family_id = p2.family_id
            WHERE p1.id = auth.uid()
        )
        OR user_id = auth.uid()
    );

-- Users can manage their own devices
CREATE POLICY "Users can insert own devices" ON user_devices
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own devices" ON user_devices
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own devices" ON user_devices
    FOR DELETE USING (user_id = auth.uid());

-- 4. Auto-remove oldest device when limit (5) is exceeded
CREATE OR REPLACE FUNCTION check_device_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM user_devices WHERE user_id = NEW.user_id) >= 5 THEN
        DELETE FROM user_devices
        WHERE id = (
            SELECT id FROM user_devices
            WHERE user_id = NEW.user_id
            ORDER BY last_active ASC
            LIMIT 1
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_device_limit
    BEFORE INSERT ON user_devices
    FOR EACH ROW
    EXECUTE FUNCTION check_device_limit();

-- 5. Add columns to chat_messages for multi-device encryption
ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS encrypted_keys JSONB DEFAULT NULL;
-- Format: { "device_id_1": "base64_encrypted_msg_key", "device_id_2": "..." }

ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS sender_device_id TEXT DEFAULT NULL;
