import crypto from 'crypto';
import * as jose from 'jose';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

function signHS256(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const base64Url = (str) => {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const headerB64 = base64Url(JSON.stringify(header));
  const payloadB64 = base64Url(JSON.stringify(payload));
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${headerB64}.${payloadB64}.${signature}`;
}

async function test() {
  const jwtSecret = 'p974uqY4Nqym9PuVTQjie4BwkyS2KKOwcDE9vXpdnnvh6LtN4JhCrc9QvXF+dmz04aHM3wlo9tpip94UUgWfHg==';
  const supabaseUrl = 'https://rltygdzldplkmwuqfadm.supabase.co';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHlnZHpsZHBsa213dXFmYWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDM5NTUsImV4cCI6MjA5Njc3OTk1NX0.xmZ5bCZimFP4-AO9Y3CPMD_9thUK0qpilajd6zftvs0';
  
  const decodedAnon = jose.decodeJwt(anonKey);
  const payload = {
    iss: 'supabase',
    ref: decodedAnon.ref || 'rltygdzldplkmwuqfadm',
    role: 'service_role',
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
  };

  const token = signHS256(payload, jwtSecret);
  console.log("Synchronously generated token:", token);

  // Verify the token using jose
  try {
    const verified = await jose.jwtVerify(token, Buffer.from(jwtSecret, 'utf-8'));
    console.log("jose verification succeeded:", verified.payload);
  } catch (err) {
    console.log("jose verification failed:", err.message);
  }

  // Use the token to list users
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error("Auth Admin listUsers failed:", error);
    } else {
      console.log("Auth Admin listUsers succeeded! Number of users:", data.users.length);
    }
  } catch (err) {
    console.error("Caught error:", err);
  }
}

test();
