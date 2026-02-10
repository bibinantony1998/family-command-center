import { supabase } from './supabase';
import _sodium from 'libsodium-wrappers';

const PRIVATE_KEY_STORAGE_KEY = 'chat_private_key_sodium';
const PUBLIC_KEY_STORAGE_KEY = 'chat_public_key_sodium';

// Keep keys in memory
let sodiumReady = false;
let memoryPrivateKey: Uint8Array | null = null; // Raw 32 bytes
let memoryPublicKey: Uint8Array | null = null; // Raw 32 bytes

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
    initialize: async (userId: string) => {
        try {
            if (!sodiumReady) {
                await _sodium.ready;
                sodiumReady = true;
            }
            const sodium = _sodium;

            const storedPriv = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
            const storedPub = localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);

            if (storedPriv && storedPub) {
                memoryPrivateKey = base64ToUint8Array(storedPriv);
                memoryPublicKey = base64ToUint8Array(storedPub);
            } else {
                // Generate new pair using sodium's X25519 (compatible with Node crypto.createECDH('curve25519'))
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

    encryptMessage: async (message: string, recipientPublicKeyBase64: string) => {
        if (!memoryPrivateKey) throw new Error('Private key not initialized');
        if (!sodiumReady) await _sodium.ready;
        const sodium = _sodium;

        // Decode recipient public key
        const recipientKey = base64ToUint8Array(recipientPublicKeyBase64);

        // Derive Shared Secret using X25519 (crypto_scalarmult)
        // This matches Node's ecdh.computeSecret()
        const sharedSecret = sodium.crypto_scalarmult(memoryPrivateKey, recipientKey);

        // Now use Web Crypto for AES-GCM (same as mobile uses standard AES-GCM)
        // Import the raw shared secret as an AES-GCM key
        const importedKey = await window.crypto.subtle.importKey(
            'raw',
            sharedSecret.buffer as ArrayBuffer,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        // Encrypt
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Standard 12 bytes IV
        const encodedMessage = new TextEncoder().encode(message);

        const encryptedBuffer = await window.crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            importedKey,
            encodedMessage
        );

        // Web Crypto AES-GCM *includes* the auth tag in the output (Ciphertext || Tag). 
        // Node's crypto usually separates them or allows getAuthTag().
        // Mobile implementation does: encrypted + tag (separately in JSON).
        // WE NEED TO MATCH PACKAGING.

        // Web Crypto output: [Ciphertext (Variable)][Tag (16 bytes)]
        const encryptedBytes = new Uint8Array(encryptedBuffer);
        const tagLength = 16;
        const ciphertextLength = encryptedBytes.length - tagLength;

        const ciphertext = encryptedBytes.slice(0, ciphertextLength);
        const tag = encryptedBytes.slice(ciphertextLength); // Last 16 bytes

        return JSON.stringify({
            iv: uint8ArrayToBase64(iv),
            tag: uint8ArrayToBase64(tag),
            content: uint8ArrayToBase64(ciphertext)
        });
    },

    decryptMessage: async (encryptedPackageStr: string, senderPublicKeyBase64: string) => {
        if (!memoryPrivateKey) throw new Error('Private key not initialized');
        if (!sodiumReady) await _sodium.ready;
        const sodium = _sodium;

        try {
            const pkg = JSON.parse(encryptedPackageStr);
            const { iv, tag, content } = pkg;

            // Decode parts
            const ivBytes = base64ToUint8Array(iv);
            const tagBytes = base64ToUint8Array(tag);
            const contentBytes = base64ToUint8Array(content);
            const senderKey = base64ToUint8Array(senderPublicKeyBase64);

            // Derive Shared Secret
            const sharedSecret = sodium.crypto_scalarmult(memoryPrivateKey, senderKey);

            // Import Key
            const importedKey = await window.crypto.subtle.importKey(
                'raw',
                sharedSecret.buffer as ArrayBuffer,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt']
            );

            // Reconstruct Web Crypto Ciphertext format: [Ciphertext || Tag]
            const encryptedBuffer = new Uint8Array(contentBytes.length + tagBytes.length);
            encryptedBuffer.set(contentBytes, 0);
            encryptedBuffer.set(tagBytes, contentBytes.length);

            // Decrypt
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: ivBytes.buffer as ArrayBuffer
                },
                importedKey,
                encryptedBuffer
            );

            return new TextDecoder().decode(decryptedBuffer);
        } catch (e) {
            console.error('Decryption failed:', e);
            return 'Decryption Error';
        }
    }
};
