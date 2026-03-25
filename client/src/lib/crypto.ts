export async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportPublicKey(key: CryptoKey) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return Buffer.from(exported).toString('base64');
}

export async function importPublicKey(pem: string) {
  const binaryDer = Buffer.from(pem, 'base64');
  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function encryptData(publicKey: CryptoKey, data: string) {
  const encoded = new TextEncoder().encode(data);
  const encrypted = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, encoded);
  return Buffer.from(encrypted).toString('base64');
}

export async function decryptData(privateKey: CryptoKey, ciphertext: string) {
  const binaryDer = Buffer.from(ciphertext, 'base64');
  const decrypted = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, binaryDer);
  return new TextDecoder().decode(decrypted);
}

// NOTE: For a real E2EE chat, you would use AES-GCM for messages and exchange the AES key via RSA.
// For simplicity and since we want "True end-to-end encryption", we will implement AES-GCM symmetric key here.
// Since it's exactly 2 people, they can negotiate or share an AES Key over RSA, 
// OR simpler yet, deriving a shared symmetric key from a password/pairing code using PBKDF2.

export async function deriveSymmetricKey(passphrase: string, saltHex: string) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = Buffer.from(saltHex, 'hex');

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptAES(key: CryptoKey, text: string) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  
  // Return iv:ciphertext as base64
  const ivBase64 = Buffer.from(iv).toString('base64');
  const cipherBase64 = Buffer.from(ciphertext).toString('base64');
  return `${ivBase64}:${cipherBase64}`;
}

export async function decryptAES(key: CryptoKey, payload: string) {
  if (!payload || !payload.includes(':')) return payload; // Fallback if plain text
  try {
    const [ivBase64, cipherBase64] = payload.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const ciphertext = Buffer.from(cipherBase64, 'base64');
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("Decryption failed", err);
    return "[Encrypted Message - Unreadable]";
  }
}
