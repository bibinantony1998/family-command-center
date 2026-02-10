import crypto from 'react-native-quick-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { Buffer } from 'buffer';

const PRIVATE_KEY_STORAGE_KEY = 'chat_private_key';
const PUBLIC_KEY_STORAGE_KEY = 'chat_public_key';

// Keep keys in memory for session duration to avoid frequent async reads
// Using 'any' to avoid strict Buffer type conflicts between quick-crypto and standard buffer
let memoryPrivateKey: any = null;
let memoryPublicKey: any = null;

export const KeyManager = {
    /**
     * Initialize keys:
     * 1. Check storage for existing keys.
     * 2. If none, generate new pair.
     * 3. Upload public key to Supabase if strict valid.
     */
    initialize: async (userId: string) => {
        try {
            const storedPriv = await AsyncStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
            const storedPub = await AsyncStorage.getItem(PUBLIC_KEY_STORAGE_KEY);

            if (storedPriv && storedPub) {
                memoryPrivateKey = Buffer.from(storedPriv, 'base64');
                memoryPublicKey = Buffer.from(storedPub, 'base64');
            } else {
                // Generate new pair using ECDH (curve25519)
                // @ts-ignore - createECDH exists at runtime in quick-crypto
                const ecdh = crypto.createECDH('curve25519');
                ecdh.generateKeys();

                memoryPublicKey = ecdh.getPublicKey();
                memoryPrivateKey = ecdh.getPrivateKey();

                if (memoryPublicKey && memoryPrivateKey) {
                    await AsyncStorage.setItem(PUBLIC_KEY_STORAGE_KEY, memoryPublicKey.toString('base64'));
                    await AsyncStorage.setItem(PRIVATE_KEY_STORAGE_KEY, memoryPrivateKey.toString('base64'));
                }
            }

            // Sync public key to profile
            if (memoryPublicKey) {
                const pubKeyBase64 = memoryPublicKey.toString('base64');
                // Check if already synced to avoid redundant updates?
                // For now just update ensuring it is there.

                const { error } = await supabase
                    .from('profiles')
                    .update({ public_key: pubKeyBase64 })
                    .eq('id', userId);

                if (error) console.error('Failed to upload public key:', error);
            }

            return true;
        } catch (e) {
            console.error('KeyManager init error:', e);
            return false;
        }
    },

    getPublicKey: () => {
        return memoryPublicKey ? memoryPublicKey.toString('base64') : null;
    },

    /**
     * Encrypt message for a recipient
     */
    encryptMessage: async (message: string, recipientPublicKeyBase64: string) => {
        if (!memoryPrivateKey) throw new Error('Private key not initialized');

        // Decode recipient public key
        const otherPub = Buffer.from(recipientPublicKeyBase64, 'base64');

        // Derive Shared Secret using my Private Key and Recipient's Public Key
        // @ts-ignore - createECDH exists at runtime in quick-crypto
        const ecdh = crypto.createECDH('curve25519');
        ecdh.setPrivateKey(memoryPrivateKey);
        // @ts-ignore
        const sharedSecret = ecdh.computeSecret(otherPub);

        // Encrypt using AES-256-GCM with the derived secret
        // Note: sharedSecret length for curve25519 is 32 bytes, perfect for AES-256 key.

        const iv = crypto.randomBytes(12); // standard IV length for GCM
        // @ts-ignore
        const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecret, iv);

        let encrypted = cipher.update(message, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag().toString('base64');

        // We pack IV + AuthTag + Encrypted Content
        // Simple format: JSON stringified
        return JSON.stringify({
            iv: iv.toString('base64'),
            tag: authTag,
            content: encrypted
        });
    },

    /**
     * Decrypt message from a sender
     */
    decryptMessage: async (encryptedPackageStr: string, senderPublicKeyBase64: string) => {
        if (!memoryPrivateKey) throw new Error('Private key not initialized');

        try {
            const pkg = JSON.parse(encryptedPackageStr);
            const { iv, tag, content } = pkg;

            const otherPub = Buffer.from(senderPublicKeyBase64, 'base64');

            // @ts-ignore - createECDH exists at runtime in quick-crypto
            const ecdh = crypto.createECDH('curve25519');
            ecdh.setPrivateKey(memoryPrivateKey);
            // @ts-ignore
            const sharedSecret = ecdh.computeSecret(otherPub);

            // @ts-ignore
            const decipher = crypto.createDecipheriv('aes-256-gcm', sharedSecret, Buffer.from(iv, 'base64'));
            decipher.setAuthTag(Buffer.from(tag, 'base64') as any);

            let decrypted = decipher.update(content, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (e) {
            console.error('Decryption failed:', e);
            return 'Decryption Error'; // Or original text if fallback
        }
    }
};
