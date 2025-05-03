import crypto from 'crypto';

// Generate a 6-digit verification code
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Send verification code via SMS
export async function sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
  try {
    // In development, we'll mock the SMS sending
    if (process.env.NODE_ENV === 'development' || process.env.SEND_MESSAGE === 'mock') {
      console.log(`[MOCK SMS] Verification code ${code} would be sent to ${phoneNumber}`);
      return true;
    }

    // Production SMS sending using the configured provider
    const response = await fetch(process.env.SMS_API_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: process.env.SMS_USERNAME,
        password: process.env.SMS_PASSWORD,
        origin: process.env.SMS_ORIGIN,
        message: `Your BidPazar verification code is: ${code}`,
        numbers: [phoneNumber],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('SMS sending error:', error);
    return false;
  }
} 