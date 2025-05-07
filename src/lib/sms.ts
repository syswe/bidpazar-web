import crypto from 'crypto';

// Simple in-memory cache for rate limiting
type RateLimitEntry = {
  lastSent: number; // Timestamp of last SMS
  dailyCount: number; // Count of SMS sent today
  countResetDate: string; // Date in YYYY-MM-DD format for resetting daily count
};

// Cache structure: { [userId or IP]: RateLimitEntry }
const smsRateLimitCache: Record<string, RateLimitEntry> = {};

// Rate limit configuration
const SMS_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes cooldown
const MAX_SMS_PER_DAY = 5; // Maximum 5 SMS per day per IP/user

// Generate a 6-digit verification code
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Check if an SMS can be sent based on rate limits
export function canSendSMS(userIdOrIp: string): { 
  allowed: boolean; 
  reason?: string; 
  retryAfterMs?: number;
  dailyRemaining?: number;
} {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Initialize or reset daily counter if it's a new day
  if (!smsRateLimitCache[userIdOrIp] || smsRateLimitCache[userIdOrIp].countResetDate !== today) {
    smsRateLimitCache[userIdOrIp] = {
      lastSent: 0,
      dailyCount: 0,
      countResetDate: today
    };
  }
  
  const entry = smsRateLimitCache[userIdOrIp];
  const now = Date.now();
  
  // Check cooldown period
  if (now - entry.lastSent < SMS_COOLDOWN_MS) {
    const retryAfterMs = SMS_COOLDOWN_MS - (now - entry.lastSent);
    return { 
      allowed: false, 
      reason: 'cooldown', 
      retryAfterMs,
      dailyRemaining: MAX_SMS_PER_DAY - entry.dailyCount
    };
  }
  
  // Check daily limit
  if (entry.dailyCount >= MAX_SMS_PER_DAY) {
    return { 
      allowed: false, 
      reason: 'daily_limit',
      dailyRemaining: 0
    };
  }
  
  return { 
    allowed: true,
    dailyRemaining: MAX_SMS_PER_DAY - entry.dailyCount - 1 // -1 for the one we're about to send
  };
}

// Update rate limit cache after sending SMS
function updateRateLimitCache(userIdOrIp: string): void {
  const today = new Date().toISOString().split('T')[0];
  
  if (!smsRateLimitCache[userIdOrIp] || smsRateLimitCache[userIdOrIp].countResetDate !== today) {
    smsRateLimitCache[userIdOrIp] = {
      lastSent: Date.now(),
      dailyCount: 1,
      countResetDate: today
    };
  } else {
    smsRateLimitCache[userIdOrIp].lastSent = Date.now();
    smsRateLimitCache[userIdOrIp].dailyCount += 1;
  }
}

// Send verification code via SMS
export async function sendVerificationCode(
  phoneNumber: string, 
  code: string, 
  userIdOrIp?: string
): Promise<boolean> {
  try {
    // Apply rate limiting if userIdOrIp is provided
    if (userIdOrIp) {
      const rateLimitCheck = canSendSMS(userIdOrIp);
      if (!rateLimitCheck.allowed) {
        console.warn(`[SMS] Rate limit hit for ${userIdOrIp}: ${rateLimitCheck.reason}`);
        return false;
      }
    }

    // Get environment variables with defaults for safety
    const smsApiUrl = process.env.SMS_API_URL || 'https://smsgw.mutlucell.com/smsgw-ws/sndblkex';
    const smsUsername = process.env.SMS_USERNAME || 'bidpazar';
    const smsPassword = process.env.SMS_PASSWORD || 'lAJ5HgcV23HgeSYg';
    const smsOrigin = process.env.SMS_ORIGIN || '908505518624';
    const sendMode = process.env.SEND_MESSAGE || 'real';
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Comprehensive logging for debugging
    console.log(`[SMS] Environment configuration:`);
    console.log(`[SMS] NODE_ENV: ${nodeEnv}`);
    console.log(`[SMS] SEND_MESSAGE: ${sendMode}`);
    console.log(`[SMS] SMS_API_URL: ${smsApiUrl}`);
    console.log(`[SMS] SMS_USERNAME: ${smsUsername}`);
    console.log(`[SMS] SMS_PASSWORD: ${smsPassword ? '[SET]' : '[MISSING]'}`);
    console.log(`[SMS] SMS_ORIGIN: ${smsOrigin}`);

    // PRIORITIZE SEND_MESSAGE over NODE_ENV
    // Only use mock if SEND_MESSAGE is explicitly set to 'mock'
    if (sendMode === 'mock') {
      console.log(`[MOCK SMS] Verification code ${code} would be sent to ${phoneNumber}`);
      // Update rate limit cache even for mock SMS
      if (userIdOrIp) {
        updateRateLimitCache(userIdOrIp);
      }
      return true;
    }

    console.log(`[SMS] Attempting to send real SMS verification code to ${phoneNumber}`);

    // Format phone number - remove leading 0 if exists, ensure it's in E.164 format
    let formattedNumber = phoneNumber.trim();
    if (formattedNumber.startsWith('0')) {
      formattedNumber = formattedNumber.substring(1);
    }
    // If number doesn't have country code, assume Turkey (+90)
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = `90${formattedNumber}`;
    } else {
      // If it has +, remove it and ensure proper format
      formattedNumber = formattedNumber.replace('+', '');
    }

    // Format message
    const message = `BidPazar dogrulama kodunuz: ${code}`;
    
    // Create XML payload for Mutlucell API (based on their documentation)
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<smspack ka="${smsUsername}" pwd="${smsPassword}" org="${smsOrigin}">
  <mesaj>
    <metin>${message}</metin>
    <nums>${formattedNumber}</nums>
  </mesaj>
</smspack>`;

    console.log(`[SMS] Sending XML payload to ${smsApiUrl}`);

    // Production SMS sending using the configured provider with XML format
    const response = await fetch(smsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
      body: xmlPayload,
    });

    const text = await response.text();
    console.log(`[SMS] API Response status: ${response.status}`);
    console.log(`[SMS] API Response body: ${text}`);

    // Parse response to check for success (Mutlucell returns XML with error codes)
    const isSuccess = !text.includes('ERR') && response.ok;
    console.log(`[SMS] SMS sending successful: ${isSuccess}`);

    // Update rate limit cache if successful and userIdOrIp is provided
    if (isSuccess && userIdOrIp) {
      updateRateLimitCache(userIdOrIp);
    }

    return isSuccess;
  } catch (error) {
    console.error('[SMS] Sending error:', error);
    return false;
  }
} 