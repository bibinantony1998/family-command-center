import { supabase } from './supabase';
import _sodium from 'libsodium-wrappers';

const PRIVATE_KEY_STORAGE_KEY = 'chat_private_key_sodium';
const PUBLIC_KEY_STORAGE_KEY = 'chat_public_key_sodium';

let sodiumReady = false;
let memoryPrivateKey: Uint8Array | null = null;
let memoryPublicKey: Uint8Array | null = null;

// Helper: Uint8Array to Base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Helper: Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

export const KeyManager = {
    /**
     * Initialize keys:
     * 1. Check localStorage for existing keys.
     * 2. If none, generate new X25519 pair using libsodium.
     * 3. Upload public key to Supabase.
     */
    initialize: async (userId: string) => {
        try {
            await _sodium.ready;
            const sodium = _sodium;
            sodiumReady = true;

            const storedPriv = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
            const storedPub = localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);

            if (storedPriv && storedPub) {
                memoryPrivateKey = base64ToUint8Array(storedPriv);
                memoryPublicKey = base64ToUint8Array(storedPub);
            } else {
                // Generate X25519 keypair using libsodium
                // Compatible with tweetnacl's nacl.box.keyPair()
                const keyPair = sodium.crypto_box_keypair();
                memoryPrivateKey = keyPair.privateKey;
                memoryPublicKey = keyPair.publicKey;

                localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, uint8ArrayToBase64(memoryPrivateKey));
                localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, uint8ArrayToBase64(memoryPublicKey));
            }

            // Sync public key to profile
            if (memoryPublicKey) {
                const pubKeyBase64 = uint8ArrayToBase64(memoryPublicKey);

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
        return memoryPublicKey ? uint8ArrayToBase64(memoryPublicKey) : null;
    },

    /**
     * Encrypt using NaCl crypto_box_easy (X25519 + XSalsa20-Poly1305)
     * Compatible with tweetnacl's nacl.box on mobile
     */
    encryptMessage: async (message: string, recipientPublicKeyBase64: string) => {
        if (!memoryPrivateKey || !sodiumReady) throw new Error('Not initialized');
        const sodium = _sodium;

        const otherPub = base64ToUint8Array(recipientPublicKeyBase64);

        // Generate 24-byte nonce
        const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);

        // Encrypt using NaCl box (same algorithm as tweetnacl's nacl.box)
        const messageBytes = new TextEncoder().encode(message);
        const encrypted = sodium.crypto_box_easy(messageBytes, nonce, otherPub, memoryPrivateKey);

        return JSON.stringify({
            n: uint8ArrayToBase64(nonce),
            c: uint8ArrayToBase64(encrypted)
        });
    },

    /**
     * Decrypt using NaCl crypto_box_open_easy
     * Compatible with tweetnacl's nacl.box.open on mobile
     */
    decryptMessage: async (encryptedPackageStr: string, senderPublicKeyBase64: string) => {
        if (!memoryPrivateKey || !sodiumReady) throw new Error('Not initialized');
        const sodium = _sodium;

        try {
            const pkg = JSON.parse(encryptedPackageStr);
            const { n, c } = pkg;

            const nonce = base64ToUint8Array(n);
            const ciphertext = base64ToUint8Array(c);
            const otherPub = base64ToUint8Array(senderPublicKeyBase64);

            const decrypted = sodium.crypto_box_open_easy(ciphertext, nonce, otherPub, memoryPrivateKey);

            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error('Decryption failed:', e);
            return '🔒 Decryption Error';
        }
    }
};
