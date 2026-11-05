'use strict';

/**
 * Native Phone Biometric Authentication Utility (WebAuthn / FIDO2)
 * Connects directly to the phone's native hardware biometric sensor
 * (Fingerprint / Touch ID / Face ID / Screen Lock) without any extra setup.
 */

// Helper: Convert ArrayBuffer to URL-safe Base64 string
function bufferToBase64Url(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper: Convert URL-safe Base64 string back to Uint8Array
function base64UrlToBuffer(base64url) {
  if (!base64url) return new Uint8Array(0);
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Determine valid RP ID (domain) for WebAuthn
function getRpId() {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  // Omit or allow localhost/IP in local dev
  if (host === '127.0.0.1') return undefined;
  return host;
}

/**
 * Checks if the device has a platform biometric sensor (Fingerprint/TouchID/FaceID)
 */
export async function isBiometricSupported() {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return Boolean(available);
  } catch (e) {
    return false;
  }
}

/**
 * Triggers the native phone biometric prompt for attendance verification.
 * Uses the phone's existing daily unlock fingerprint (zero setup needed).
 * 
 * @param {Object} user Current logged-in user
 * @param {string} actionType 'enter' | 'exit'
 * @returns {Promise<{success: boolean, bypassed?: boolean, method?: string}>}
 */
export async function promptBiometricVerification(user, actionType = 'enter') {
  if (typeof window === 'undefined') {
    return { success: false, reason: 'SSR' };
  }

  // 1. Check if hardware supports platform biometrics
  const supported = await isBiometricSupported();
  if (!supported) {
    return { success: true, bypassed: true, reason: 'NO_BIOMETRIC_HARDWARE' };
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const credKey = `asas_bio_cred_${user?.id || user?.identifier || 'current'}`;
  const savedCredId = localStorage.getItem(credKey);

  // 2. Try assertion (fast daily check via existing enrolled credential)
  if (savedCredId) {
    try {
      const credBuffer = base64UrlToBuffer(savedCredId);
      const rpId = getRpId();
      const getOptions = {
        publicKey: {
          challenge,
          ...(rpId ? { rpId } : {}),
          allowCredentials: [{
            id: credBuffer,
            type: 'public-key',
            transports: ['internal']
          }],
          userVerification: 'required',
          timeout: 60000
        }
      };

      const assertion = await navigator.credentials.get(getOptions);
      if (assertion) {
        return {
          success: true,
          bypassed: false,
          method: 'assertion',
          verified_at: new Date().toISOString()
        };
      }
    } catch (err) {
      // If user explicitly pressed Cancel or rejected biometric
      if (err.name === 'NotAllowedError' || /canceled|cancelled|denied/i.test(err.message || '')) {
        const bioErr = new Error('تم إلغاء التحقق عبر البصمة. يرجى لمس مستشعر بصمة الهاتف للمتابعة.');
        bioErr.isBiometric = true;
        throw bioErr;
      }
      // If credential invalidated/expired on device, fallback to creation below
    }
  }

  // 3. First-time seamless creation (prompts the phone's fingerprint sensor directly)
  try {
    const rpId = getRpId();
    const userIdStr = String(user?.id || user?.identifier || '1');
    const createOptions = {
      publicKey: {
        challenge,
        rp: {
          name: 'نظام أساس للحضور',
          ...(rpId ? { id: rpId } : {})
        },
        user: {
          id: new TextEncoder().encode(userIdStr),
          name: user?.identifier || user?.email || 'employee',
          displayName: user?.name || 'موظف أساس'
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256 (standard platform)
          { type: 'public-key', alg: -257 }  // RS256 (standard platform)
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60000
      }
    };

    const credential = await navigator.credentials.create(createOptions);
    if (credential && credential.rawId) {
      const b64Id = bufferToBase64Url(credential.rawId);
      localStorage.setItem(credKey, b64Id);
      return {
        success: true,
        bypassed: false,
        method: 'creation',
        verified_at: new Date().toISOString()
      };
    }
  } catch (err) {
    if (err.name === 'NotAllowedError' || /canceled|cancelled|denied/i.test(err.message || '')) {
      const bioErr = new Error('تم إلغاء التحقق عبر البصمة. يرجى لمس مستشعر بصمة الهاتف للمتابعة.');
      bioErr.isBiometric = true;
      throw bioErr;
    }
    // If device doesn't support platform attachment despite check
    if (/not supported|unsupported/i.test(err.message || '')) {
      return { success: true, bypassed: true, reason: 'UNSUPPORTED_PLATFORM' };
    }
    const bioErr = new Error('تعذر إتمام التحقق من بصمة الهاتف: ' + (err.message || 'خطأ في المستشعر'));
    bioErr.isBiometric = true;
    throw bioErr;
  }

  return { success: false, reason: 'UNKNOWN_FAILURE' };
}
