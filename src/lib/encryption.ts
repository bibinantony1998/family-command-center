import { supabase } from './supabase';
import _sodium from 'libsodium-wrappers';

const PRIVATE_KEY_STORAGE_KEY = 'chat_private_key_sodium';
const PUBLIC_KEY_STORAGE_KEY = 'chat_public_key_sodium';
const DEVICE_ID_STORAGE_KEY = 'chat_device_id';

let sodiumReady = false;
let memoryPrivateKey: Uint8Array | null = null;
let memoryPublicKey: Uint8Array | null = null;
let currentDeviceId: string | null = null;

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

// Generate a UUID v4 for device identification
function generateDeviceId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Detect the device/browser name
function getDeviceName(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome Web';
    if (ua.includes('Firefox')) return 'Firefox Web';
    if (ua.includes('Safari')) return 'Safari Web';
    if (ua.includes('Edge')) return 'Edge Web';
    return 'Web Browser';
}

export interface DeviceKey {
    device_id: string;
    public_key: string;
    user_id: string;
}

export const KeyManager = {
    /**
     * Initialize multi-device keys:
     * 1. Get or generate a device ID for this browser
     * 2. Get or generate X25519 keypair for this device
     * 3. Register this device in user_devices table (upsert)
     */
    initialize: async (userId: string) => {
        try {
            await _sodium.ready;
            const sodium = _sodium;
            sodiumReady = true;

            // Get or create device ID
            let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
            if (!deviceId) {
                deviceId = generateDeviceId();
                localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
            }
            currentDeviceId = deviceId;

            // Get or create keypair
            const storedPriv = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
            const storedPub = localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);

            if (storedPriv && storedPub) {
                memoryPrivateKey = base64ToUint8Array(storedPriv);
                memoryPublicKey = base64ToUint8Array(storedPub);
            } else {
                const keyPair = sodium.crypto_box_keypair();
                memoryPrivateKey = keyPair.privateKey;
                memoryPublicKey = keyPair.publicKey;

                localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, uint8ArrayToBase64(memoryPrivateKey));
                localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, uint8ArrayToBase64(memoryPublicKey));
            }

            // Register this device in user_devices (upsert)
            if (memoryPublicKey) {
                const pubKeyBase64 = uint8ArrayToBase64(memoryPublicKey);

                const { error } = await supabase
                    .from('user_devices')
                    .upsert({
                        user_id: userId,
                        device_id: deviceId,
                        device_name: getDeviceName(),
                        public_key: pubKeyBase64,
                        last_active: new Date().toISOString()
                    }, {
                        onConflict: 'user_id,device_id'
                    });

                if (error) console.error('Failed to register device:', error);
            }

            return true;
        } catch (e) {
            console.error('KeyManager init error:', e);
            return false;
        }
    },

    getDeviceId: () => currentDeviceId,

    getPublicKey: () => {
        return memoryPublicKey ? uint8ArrayToBase64(memoryPublicKey) : null;
    },

    /**
     * Fetch all device public keys for a given user from user_devices table.
     */
    fetchDeviceKeys: async (userId: string): Promise<DeviceKey[]> => {
        const { data, error } = await supabase
            .from('user_devices')
            .select('device_id, public_key, user_id')
            .eq('user_id', userId);

        if (error) {
            console.error('Failed to fetch device keys:', error);
            return [];
        }
        return (data || []) as DeviceKey[];
    },

    /**
     * Multi-device encrypt:
     * 1. Generate a random symmetric key (32 bytes)
     * 2. Encrypt the message with secretbox (symmetric)
     * 3. For each device, encrypt the symmetric key with NaCl box (asymmetric)
     * 
     * @param message - plaintext message
     * @param recipientDeviceKeys - all devices of all recipients (including sender's own devices)
     * @returns { content: string, encrypted_keys: Record<string, string> }
     */
    encryptForDevices: async (
        message: string,
        recipientDeviceKeys: DeviceKey[]
    ): Promise<{ content: string; encrypted_keys: Record<string, string> }> => {
        if (!memoryPrivateKey || !sodiumReady) throw new Error('Not initialized');
        const sodium = _sodium;

        // 1. Generate random symmetric key (32 bytes)
        const messageKey = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES); // 32 bytes

        // 2. Encrypt message with secretbox (symmetric)
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES); // 24 bytes
        const messageBytes = new TextEncoder().encode(message);
        const ciphertext = sodium.crypto_secretbox_easy(messageBytes, nonce, messageKey);

        const content = JSON.stringify({
            n: uint8ArrayToBase64(nonce),
            c: uint8ArrayToBase64(ciphertext)
        });

        // 3. Encrypt the symmetric key for each device using NaCl box
        const encrypted_keys: Record<string, string> = {};

        for (const device of recipientDeviceKeys) {
            try {
                const devicePubKey = base64ToUint8Array(device.public_key);
                const keyNonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
                const encryptedKey = sodium.crypto_box_easy(messageKey, keyNonce, devicePubKey, memoryPrivateKey);

                // Store both nonce and encrypted key
                encrypted_keys[device.device_id] = JSON.stringify({
                    n: uint8ArrayToBase64(keyNonce),
                    k: uint8ArrayToBase64(encryptedKey)
                });
            } catch (e) {
                console.error(`Failed to encrypt key for device ${device.device_id}:`, e);
            }
        }

        return { content, encrypted_keys };
    },

    /**
     * Multi-device decrypt:
     * 1. Find this device's encrypted key in encrypted_keys map
     * 2. Decrypt the symmetric key using NaCl box
     * 3. Decrypt the message with secretbox
     * 
     * @param encryptedContent - the encrypted content string (JSON with n, c)
     * @param encryptedKeys - the encrypted_keys map from the message
     * @param senderPublicKeyBase64 - the sender device's public key
     */
    decryptMultiDevice: async (
        encryptedContent: string,
        encryptedKeys: Record<string, string>,
        senderPublicKeyBase64: string
    ): Promise<string> => {
        if (!memoryPrivateKey || !sodiumReady || !currentDeviceId) {
            throw new Error('Not initialized');
        }
        const sodium = _sodium;

        // 1. Find this device's encrypted symmetric key
        const myEncryptedKeyStr = encryptedKeys[currentDeviceId];
        if (!myEncryptedKeyStr) {
            return '🔒 Encrypted on another device';
        }

        try {
            // 2. Decrypt the symmetric key
            const keyPkg = JSON.parse(myEncryptedKeyStr);
            const keyNonce = base64ToUint8Array(keyPkg.n);
            const encryptedKey = base64ToUint8Array(keyPkg.k);
            const senderPubKey = base64ToUint8Array(senderPublicKeyBase64);

            const messageKey = sodium.crypto_box_open_easy(encryptedKey, keyNonce, senderPubKey, memoryPrivateKey);

            // 3. Decrypt the message content
            const contentPkg = JSON.parse(encryptedContent);
            const msgNonce = base64ToUint8Array(contentPkg.n);
            const ciphertext = base64ToUint8Array(contentPkg.c);

            const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, msgNonce, messageKey);
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error('Multi-device decryption failed:', e);
            return '🔒 Decryption Error';
        }
    },

    /**
     * Legacy single-key decrypt (backward compat for old messages without encrypted_keys)
     */
    decryptLegacy: async (encryptedPackageStr: string, senderPublicKeyBase64: string): Promise<string> => {
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
            console.error('Legacy decryption failed:', e);
            return '🔒 Encrypted on another device';
        }
    }
};
