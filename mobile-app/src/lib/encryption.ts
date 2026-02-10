import nacl from 'tweetnacl';
import crypto from 'react-native-quick-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { Buffer } from 'buffer';

const PRIVATE_KEY_STORAGE_KEY = 'chat_private_key';
const PUBLIC_KEY_STORAGE_KEY = 'chat_public_key';

let memoryPrivateKey: Uint8Array | null = null;
let memoryPublicKey: Uint8Array | null = null;

export const KeyManager = {
    /**
     * Initialize keys:
     * 1. Check storage for existing keys.
     * 2. If none, generate new X25519 pair.
     * 3. Upload public key to Supabase.
     */
    initialize: async (userId: string) => {
        try {
            const storedPriv = await AsyncStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
            const storedPub = await AsyncStorage.getItem(PUBLIC_KEY_STORAGE_KEY);

            if (storedPriv && storedPub) {
                memoryPrivateKey = new Uint8Array(Buffer.from(storedPriv, 'base64'));
                memoryPublicKey = new Uint8Array(Buffer.from(storedPub, 'base64'));
            } else {
                // Generate random 32 bytes using quick-crypto's native PRNG
                // then derive X25519 keypair deterministically via tweetnacl
                const randomSecret = new Uint8Array(crypto.randomBytes(32));
                const keyPair = nacl.box.keyPair.fromSecretKey(randomSecret);
                memoryPrivateKey = keyPair.secretKey;
                memoryPublicKey = keyPair.publicKey;

                await AsyncStorage.setItem(
                    PUBLIC_KEY_STORAGE_KEY,
                    Buffer.from(memoryPublicKey).toString('base64')
                );
                await AsyncStorage.setItem(
                    PRIVATE_KEY_STORAGE_KEY,
                    Buffer.from(memoryPrivateKey).toString('base64')
                );
            }

            // Sync public key to profile
            if (memoryPublicKey) {
                const pubKeyBase64 = Buffer.from(memoryPublicKey).toString('base64');
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
        return memoryPublicKey ? Buffer.from(memoryPublicKey).toString('base64') : null;
    },

    /**
     * Encrypt using NaCl box (X25519 + XSalsa20-Poly1305)
     * Compatible with libsodium's crypto_box_easy on web
     */
    encryptMessage: async (message: string, recipientPublicKeyBase64: string) => {
        if (!memoryPrivateKey) throw new Error('Private key not initialized');

        const otherPub = new Uint8Array(Buffer.from(recipientPublicKeyBase64, 'base64'));

        // Generate 24-byte nonce using quick-crypto's native PRNG
        const nonce = new Uint8Array(crypto.randomBytes(nacl.box.nonceLength));

        // Encrypt using NaCl box
        const messageBytes = new Uint8Array(Buffer.from(message, 'utf8'));
        const encrypted = nacl.box(messageBytes, nonce, otherPub, memoryPrivateKey);

        if (!encrypted) throw new Error('Encryption failed');

        return JSON.stringify({
            n: Buffer.from(nonce).toString('base64'),
            c: Buffer.from(encrypted).toString('base64')
        });
    },

    /**
     * Decrypt using NaCl box.open
     * Compatible with libsodium's crypto_box_open_easy on web
     */
    decryptMessage: async (encryptedPackageStr: string, senderPublicKeyBase64: string) => {
        if (!memoryPrivateKey) throw new Error('Private key not initialized');

        try {
            if (!encryptedPackageStr || typeof encryptedPackageStr !== 'string') {
                return encryptedPackageStr; // Return as-is if not a string
            }

            const pkg = JSON.parse(encryptedPackageStr);
            const { n, c } = pkg;

            // Validate required fields exist
            if (!n || !c) {
                console.warn('Invalid encrypted package format, missing n or c');
                return '🔒 Old encrypted format';
            }

            if (!senderPublicKeyBase64) {
                return '🔒 Missing sender key';
            }

            const nonce = new Uint8Array(Buffer.from(n, 'base64'));
            const ciphertext = new Uint8Array(Buffer.from(c, 'base64'));
            const otherPub = new Uint8Array(Buffer.from(senderPublicKeyBase64, 'base64'));

            const decrypted = nacl.box.open(ciphertext, nonce, otherPub, memoryPrivateKey);

            if (!decrypted) throw new Error('Decryption returned null - wrong key or tampered');

            return Buffer.from(decrypted).toString('utf8');
        } catch (e) {
            console.error('Decryption failed:', e);
            return '🔒 Decryption Error';
        }
    }
};
