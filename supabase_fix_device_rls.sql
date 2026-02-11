-- =====================================================
-- FIX: Update RLS policy on user_devices
-- Public keys are MEANT to be public (that's the whole
-- point of public-key crypto). Any authenticated user
-- should be able to read device keys.
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Family members can view device keys" ON user_devices;

-- Replace with a simple authenticated-user policy
CREATE POLICY "Authenticated users can view device keys" ON user_devices
    FOR SELECT USING (auth.uid() IS NOT NULL);
