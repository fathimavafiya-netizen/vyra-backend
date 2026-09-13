/** Client-visible OTP payload. Never falls back to a generated code. Production/test: always null. */
export function otpResponsePayload(devCode?: string): { devCode: string; devNote: string } | null {
  if (process.env.NODE_ENV === 'development' && devCode) {
    return { devCode, devNote: 'Development mode only. Not returned in production.' };
  }
  return null;
}
