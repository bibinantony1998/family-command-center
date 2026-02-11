import nacl from 'tweetnacl';
import crypto from 'react-native-quick-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';

const PRIVATE_KEY_STORAGE_KEY = 'chat_private_key';
const PUBLIC_KEY_STORAGE_KEY = 'chat_public_key';
const DEVICE_ID_STORAGE_KEY = 'chat_device_id';

let memoryPrivateKey: Uint8Array | null = null;
let memoryPublicKey: Uint8Array | null = null;
let currentDeviceId: string | null = null;

// Generate a UUID v4 for device identification
function generateDeviceId(): string {
    const bytes = new Uint8Array(crypto.randomBytes(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Buffer.from(bytes).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Detect device name
function getDeviceName(): string {
    return Platform.OS === 'ios' ? 'iPhone App' : 'Android App';
}

export interface DeviceKey {
    device_id: string;
    public_key: string;
    user_id: string;
}

export const KeyManager = {
    /**
     * Initialize multi-device keys:
     * 1. Get or generate a device ID for this device
     * 2. Get or generate X25519 keypair
     * 3. Register this device in user_devices table (upsert)
     */
    initialize: async (userId: string) => {
        try {
            // Get or create device ID
            let deviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
            if (!deviceId) {
                deviceId = generateDeviceId();
                await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
            }
            currentDeviceId = deviceId;

            // Get or create keypair
            const storedPriv = await AsyncStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
            const storedPub = await AsyncStorage.getItem(PUBLIC_KEY_STORAGE_KEY);

            if (storedPriv && storedPub) {
                memoryPrivateKey = new Uint8Array(Buffer.from(storedPriv, 'base64'));
                memoryPublicKey = new Uint8Array(Buffer.from(storedPub, 'base64'));
            } else {
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

            // Register this device in user_devices (upsert)
            if (memoryPublicKey) {
                const pubKeyBase64 = Buffer.from(memoryPublicKey).toString('base64');

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
        return memoryPublicKey ? Buffer.from(memoryPublicKey).toString('base64') : null;
    },

    /**
     * Fetch all device public keys for a given user.
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
     * 2. Encrypt message with nacl.secretbox (symmetric)
     * 3. For each device, encrypt the symmetric key with nacl.box (asymmetric)
     */
    encryptForDevices: async (
        message: string,
        recipientDeviceKeys: DeviceKey[]
    ): Promise<{ content: string; encrypted_keys: Record<string, string> }> => {
        if (!memoryPrivateKey) throw new Error('Not initialized');

        // 1. Generate random symmetric key (32 bytes)
        const messageKey = new Uint8Array(crypto.randomBytes(nacl.secretbox.keyLength));

        // 2. Encrypt message with secretbox (symmetric)
        const nonce = new Uint8Array(crypto.randomBytes(nacl.secretbox.nonceLength));
        const messageBytes = new Uint8Array(Buffer.from(message, 'utf8'));
        const ciphertext = nacl.secretbox(messageBytes, nonce, messageKey);

        if (!ciphertext) throw new Error('Symmetric encryption failed');

        const content = JSON.stringify({
            n: Buffer.from(nonce).toString('base64'),
            c: Buffer.from(ciphertext).toString('base64')
        });

        // 3. Encrypt the symmetric key for each device
        const encrypted_keys: Record<string, string> = {};

        for (const device of recipientDeviceKeys) {
            try {
                const devicePubKey = new Uint8Array(Buffer.from(device.public_key, 'base64'));
                const keyNonce = new Uint8Array(crypto.randomBytes(nacl.box.nonceLength));
                const encryptedKey = nacl.box(messageKey, keyNonce, devicePubKey, memoryPrivateKey);

                if (!encryptedKey) {
                    console.error(`Box encryption failed for device ${device.device_id}`);
                    continue;
                }

                encrypted_keys[device.device_id] = JSON.stringify({
                    n: Buffer.from(keyNonce).toString('base64'),
                    k: Buffer.from(encryptedKey).toString('base64')
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
     * 2. Decrypt the symmetric key using nacl.box.open
     * 3. Decrypt the message with nacl.secretbox.open
     */
    decryptMultiDevice: async (
        encryptedContent: string,
        encryptedKeys: Record<string, string>,
        senderPublicKeyBase64: string
    ): Promise<string> => {
        if (!memoryPrivateKey || !currentDeviceId) {
            throw new Error('Not initialized');
        }

        // 1. Find this device's encrypted symmetric key
        const myEncryptedKeyStr = encryptedKeys[currentDeviceId];
        if (!myEncryptedKeyStr) {
            return '🔒 Encrypted on another device';
        }

        try {
            // 2. Decrypt the symmetric key
            const keyPkg = JSON.parse(myEncryptedKeyStr);
            const keyNonce = new Uint8Array(Buffer.from(keyPkg.n, 'base64'));
            const encryptedKey = new Uint8Array(Buffer.from(keyPkg.k, 'base64'));
            const senderPubKey = new Uint8Array(Buffer.from(senderPublicKeyBase64, 'base64'));

            const messageKey = nacl.box.open(encryptedKey, keyNonce, senderPubKey, memoryPrivateKey);
            if (!messageKey) throw new Error('Failed to decrypt symmetric key');

            // 3. Decrypt the message content
            const contentPkg = JSON.parse(encryptedContent);
            const msgNonce = new Uint8Array(Buffer.from(contentPkg.n, 'base64'));
            const ciphertext = new Uint8Array(Buffer.from(contentPkg.c, 'base64'));

            const decrypted = nacl.secretbox.open(ciphertext, msgNonce, messageKey);
            if (!decrypted) throw new Error('Failed to decrypt message');

            return Buffer.from(decrypted).toString('utf8');
        } catch (e) {
            console.error('Multi-device decryption failed:', e);
            return '🔒 Decryption Error';
        }
    },

    /**
     * Legacy single-key decrypt (backward compat for old messages without encrypted_keys)
     */
    decryptLegacy: async (encryptedPackageStr: string, senderPublicKeyBase64: string): Promise<string> => {
        if (!memoryPrivateKey) throw new Error('Not initialized');

        try {
            if (!encryptedPackageStr || typeof encryptedPackageStr !== 'string') {
                return encryptedPackageStr as string;
            }

            const pkg = JSON.parse(encryptedPackageStr);
            const { n, c } = pkg;

            if (!n || !c) {
                console.warn('Invalid encrypted package format');
                return '🔒 Old encrypted format';
            }

            if (!senderPublicKeyBase64) {
                return '🔒 Missing sender key';
            }

            const nonce = new Uint8Array(Buffer.from(n, 'base64'));
            const ciphertext = new Uint8Array(Buffer.from(c, 'base64'));
            const otherPub = new Uint8Array(Buffer.from(senderPublicKeyBase64, 'base64'));

            const decrypted = nacl.box.open(ciphertext, nonce, otherPub, memoryPrivateKey);
            if (!decrypted) throw new Error('Decryption returned null');

            return Buffer.from(decrypted).toString('utf8');
        } catch (e) {
            console.error('Legacy decryption failed:', e);
            return '🔒 Encrypted on another device';
        }
    }
};
