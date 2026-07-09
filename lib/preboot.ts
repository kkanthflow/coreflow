// Self-contained pure JS SHA-256 implementation for Uint8Array
function sha256_buffer(buffer: Uint8Array): ArrayBuffer {
  var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
      h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  var k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  var len = buffer.length;
  var lenBits = len * 8;
  var padLen = 64 - ((len + 1 + 8) % 64);
  if (padLen === 64) padLen = 0;
  
  var totalLen = len + 1 + padLen + 8;
  var padded = new Uint8Array(totalLen);
  padded.set(buffer, 0);
  padded[len] = 0x80;
  
  var view = new DataView(padded.buffer);
  view.setUint32(totalLen - 4, lenBits);

  var w = new Uint32Array(64);
  for (var chunkOffset = 0; chunkOffset < totalLen; chunkOffset += 64) {
    for (var i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunkOffset + i * 4);
    }
    for (var i = 16; i < 64; i++) {
      var s0 = ((rotateRight(w[i-15], 7) ^ rotateRight(w[i-15], 18) ^ (w[i-15] >>> 3)) >>> 0);
      var s1 = ((rotateRight(w[i-2], 17) ^ rotateRight(w[i-2], 19) ^ (w[i-2] >>> 10)) >>> 0);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }

    var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (var i = 0; i < 64; i++) {
      var S1 = ((rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0);
      var ch = (((e & f) ^ (~e & g)) >>> 0);
      var temp1 = ((h + S1 + ch + k[i] + w[i]) >>> 0);
      var S0 = ((rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0);
      var maj = (((a & b) ^ (a & c) ^ (b & c)) >>> 0);
      var temp2 = ((S0 + maj) >>> 0);

      h = g;
      g = f;
      f = e;
      e = ((d + temp1) >>> 0);
      d = c;
      c = b;
      b = a;
      a = ((temp1 + temp2) >>> 0);
    }

    h0 = ((h0 + a) >>> 0);
    h1 = ((h1 + b) >>> 0);
    h2 = ((h2 + c) >>> 0);
    h3 = ((h3 + d) >>> 0);
    h4 = ((h4 + e) >>> 0);
    h5 = ((h5 + f) >>> 0);
    h6 = ((h6 + g) >>> 0);
    h7 = ((h7 + h) >>> 0);
  }

  var result = new Uint8Array(32);
  var resultView = new DataView(result.buffer);
  resultView.setUint32(0, h0);
  resultView.setUint32(4, h1);
  resultView.setUint32(8, h2);
  resultView.setUint32(12, h3);
  resultView.setUint32(16, h4);
  resultView.setUint32(20, h5);
  resultView.setUint32(24, h6);
  resultView.setUint32(28, h7);
  return result.buffer;
}

function rotateRight(val: number, bits: number): number {
  return ((val >>> bits) | (val << (32 - bits))) >>> 0;
}

const existingCrypto = (global as any).crypto || {};
const cryptoPolyfill = {
  getRandomValues: existingCrypto.getRandomValues || function (array: any) {
    if (array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  },
  subtle: existingCrypto.subtle || {
    digest: function (algorithm: string, data: any) {
      return new Promise(function (resolve, reject) {
        try {
          if (algorithm !== 'SHA-256') {
            reject(new Error('Only SHA-256 is supported'));
            return;
          }
          var uint8;
          if (data instanceof ArrayBuffer) {
            uint8 = new Uint8Array(data);
          } else if (ArrayBuffer.isView(data)) {
            uint8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          } else {
            reject(new Error('Invalid data type'));
            return;
          }
          resolve(sha256_buffer(uint8));
        } catch (err) {
          reject(err);
        }
      });
    }
  }
};

try {
  Object.defineProperty(global, 'crypto', {
    value: cryptoPolyfill,
    configurable: true,
    writable: true
  });
} catch (e) {
  (global as any).crypto = cryptoPolyfill;
}

import { LogBox } from "react-native";

// Override console.error early to completely suppress the expo-notifications warning in Expo Go
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Check string arguments only to suppress notification warnings.
  // This is completely immune to symbol crashes and infinite recursion loops from JSON.stringify.
  const isNotificationWarning = args.some(arg => 
    typeof arg === 'string' && (
      arg.includes("expo-notifications: Android Push notifications") ||
      arg.includes("removed from Expo Go")
    )
  );

  if (isNotificationWarning) {
    return;
  }
  originalConsoleError(...args);
};

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Android Push notifications'
]);

import { Alert } from 'react-native';

// Register global error handler for uncaught JS exceptions
if (typeof global !== 'undefined' && (global as any).ErrorUtils) {
  const previousHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    console.warn("[Global Crash Logger] Uncaught Exception caught by ErrorUtils:", error);
    try {
      Alert.alert('Fatal JS Crash', String(error?.message || error));
    } catch(e) {}
    if (previousHandler) {
      previousHandler(error, isFatal);
    }
  });
}

// Register global promise rejection handler
const originalPromiseRejectionHandler = (Promise as any)._onUnhandledRejection;
(Promise as any)._onUnhandledRejection = (id: any, error: any) => {
  console.warn("[Global Crash Logger] Unhandled Promise Rejection:", error);
  try {
    Alert.alert('Unhandled Promise Rejection', String(error?.message || error));
  } catch(e) {}
  if (originalPromiseRejectionHandler) {
    originalPromiseRejectionHandler(id, error);
  }
};

