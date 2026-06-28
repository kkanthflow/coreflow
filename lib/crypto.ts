import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const PRIVATE_KEY_STORE_KEY = 'cf_e2ee_private_key';
const PUBLIC_KEY_STORE_KEY = 'cf_e2ee_public_key';

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// 1. Initialize E2EE Key Pair
export async function initializeUserKeys(userId: string): Promise<string> {
  try {
    // Check if we already have keys stored locally
    const storedPubKey = await SecureStore.getItemAsync(PUBLIC_KEY_STORE_KEY);
    const storedPrivKey = await SecureStore.getItemAsync(PRIVATE_KEY_STORE_KEY);

    if (storedPubKey && storedPrivKey) {
      // Keys exist locally, upload public key to server just in case it is missing
      await uploadPublicKey(userId, storedPubKey);
      return storedPubKey;
    }

    // Generate P-256 ECDH Key Pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    // Export keys to JWK format
    const pubKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    const pubKeyStr = JSON.stringify(pubKeyJwk);
    const privKeyStr = JSON.stringify(privKeyJwk);

    // Store keys securely on the device
    await SecureStore.setItemAsync(PUBLIC_KEY_STORE_KEY, pubKeyStr);
    await SecureStore.setItemAsync(PRIVATE_KEY_STORE_KEY, privKeyStr);

    // Upload public key to database
    await uploadPublicKey(userId, pubKeyStr);

    return pubKeyStr;
  } catch (err) {
    console.error('Failed to initialize E2EE keys:', err);
    throw err;
  }
}

async function uploadPublicKey(userId: string, publicKeyStr: string) {
  const { error } = await supabase
    .from('user_public_keys')
    .upsert({ user_id: userId, public_key: publicKeyStr, updated_at: new Date().toISOString() });
  if (error) {
    console.error('Error uploading E2EE public key:', error);
  }
}

// Get user private key from Secure Store
async function getPrivateKey(): Promise<CryptoKey> {
  const privKeyStr = await SecureStore.getItemAsync(PRIVATE_KEY_STORE_KEY);
  if (!privKeyStr) throw new Error('E2EE private key not found on device.');
  const jwk = JSON.parse(privKeyStr);
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// 2. Derive Symmetric Key from Private Key and other User's Public Key (ECDH)
export async function deriveSharedSymmetricKey(otherUserPublicKeyStr: string): Promise<CryptoKey> {
  const privateKey = await getPrivateKey();
  
  const otherPubKeyJwk = JSON.parse(otherUserPublicKeyStr);
  const otherPublicKey = await crypto.subtle.importKey(
    'jwk',
    otherPubKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: otherPublicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// 3. Encrypt Symmetric Key for a recipient using ECDH key derivation
export async function encryptKeyForRecipient(channelSymmetricKeyBase64: string, recipientPubKeyStr: string): Promise<string> {
  const sharedKey = await deriveSharedSymmetricKey(recipientPubKeyStr);
  const rawKeyData = base64ToArrayBuffer(channelSymmetricKeyBase64);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    rawKeyData
  );

  // Combine IV and Ciphertext
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

// 4. Decrypt Symmetric Key using ECDH key derivation
export async function decryptKeyWithSender(encryptedSymmetricKeyBase64: string, senderPubKeyStr: string): Promise<string> {
  const sharedKey = await deriveSharedSymmetricKey(senderPubKeyStr);
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedSymmetricKeyBase64));

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    ciphertext.buffer
  );

  return arrayBufferToBase64(decryptedBuffer);
}

// 5. Generate a random AES symmetric key for a channel
export function generateRandomSymmetricKey(): string {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  return arrayBufferToBase64(keyBytes.buffer);
}

// 6. Encrypt message payload (AES-GCM)
export async function encryptMessagePayload(payloadJson: any, symmetricKeyBase64: string): Promise<string> {
  const rawKey = base64ToArrayBuffer(symmetricKeyBase64);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  const textEncoder = new TextEncoder();
  const rawData = textEncoder.encode(JSON.stringify(payloadJson));

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    rawData
  );

  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

// 7. Decrypt message payload (AES-GCM)
export async function decryptMessagePayload(encryptedPayloadBase64: string, symmetricKeyBase64: string): Promise<any> {
  try {
    const rawKey = base64ToArrayBuffer(symmetricKeyBase64);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );

    const combined = new Uint8Array(base64ToArrayBuffer(encryptedPayloadBase64));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext.buffer
    );

    const textDecoder = new TextDecoder();
    const jsonStr = textDecoder.decode(decryptedBuffer);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Failed to decrypt payload:', err);
    return null;
  }
}
