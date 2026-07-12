import prisma from '../../config/db';

export class OtpRepository {
  async findByContact(contact: string, type: 'EMAIL' | 'MOBILE', purpose = 'LOGIN') {
    return prisma.otpVerification.findUnique({
      where: {
        contact_type_purpose: { contact, type, purpose },
      },
    });
  }

  async create(data: {
    contact: string;
    type: 'EMAIL' | 'MOBILE';
    purpose: string;
    otpHash: string;
    expiresAt: Date;
  }) {
    return prisma.otpVerification.create({
      data: {
        contact: data.contact,
        type: data.type,
        purpose: data.purpose,
        otpHash: data.otpHash,
        expiresAt: data.expiresAt,
        attempts: 0,
        verified: false,
        resendCountHour: 1,
        resendCountDay: 1,
        lastSentAt: new Date(),
      },
    });
  }

  async updateOtp(
    contact: string,
    type: 'EMAIL' | 'MOBILE',
    purpose: string,
    update: {
      otpHash: string;
      expiresAt: Date;
      resendCountHour: number;
      resendCountDay: number;
      lastSentAt: Date;
    }
  ) {
    return prisma.otpVerification.update({
      where: {
        contact_type_purpose: { contact, type, purpose },
      },
      data: {
        otpHash: update.otpHash,
        expiresAt: update.expiresAt,
        attempts: 0,
        verified: false,
        lastSentAt: update.lastSentAt,
        resendCountHour: update.resendCountHour,
        resendCountDay: update.resendCountDay,
      },
    });
  }

  async updateLockout(contact: string, type: 'EMAIL' | 'MOBILE', purpose: string, lockedUntil: Date | null) {
    return prisma.otpVerification.update({
      where: {
        contact_type_purpose: { contact, type, purpose },
      },
      data: {
        lockedUntil,
        resendCountHour: 0,
        resendCountDay: 0,
      },
    });
  }

  async incrementAttempts(contact: string, type: 'EMAIL' | 'MOBILE', purpose: string, attempts: number) {
    return prisma.otpVerification.update({
      where: {
        contact_type_purpose: { contact, type, purpose },
      },
      data: { attempts },
    });
  }

  async setVerified(contact: string, type: 'EMAIL' | 'MOBILE', purpose: string) {
    return prisma.otpVerification.update({
      where: {
        contact_type_purpose: { contact, type, purpose },
      },
      data: { verified: true, attempts: 0 },
    });
  }

  async deleteExpiredOrVerified() {
    return prisma.otpVerification.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { verified: true },
        ],
      },
    });
  }
}

export default new OtpRepository();
