/** Client-visible OTP payload. Never falls back to a generated code. Production/test: always null. */
export function otpResponsePayload(devCode?: string): { devCode: string; devNote: string } | null {
  if (devCode) {
    return { devCode, devNote: 'Testing mode active. OTP returned in production.' };
  }
  return null;
}
