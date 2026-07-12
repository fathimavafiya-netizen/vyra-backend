import prisma from '../../config/db';

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        settings: true,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        profile: true,
        settings: true,
      },
    });
  }

  async findByMobile(mobile: string) {
    return prisma.user.findUnique({
      where: { mobile: mobile.trim() },
      include: {
        profile: true,
        settings: true,
      },
    });
  }

  async create(data: {
    email?: string;
    mobile?: string;
    passwordHash: string;
    name: string;
    username: string;
    consentGiven?: boolean;
  }) {
    return prisma.user.create({
      data: {
        email: data.email ? data.email.toLowerCase().trim() : null,
        mobile: data.mobile ? data.mobile.trim() : null,
        password: data.passwordHash,
        role: 'USER',
        isVerified: true,
        emailVerifiedAt: data.email ? new Date() : null,
        mobileVerifiedAt: data.mobile ? new Date() : null,
        consentGivenAt: data.consentGiven ? new Date() : null,
        privacyVersion: '1.0',
        termsVersion: '1.0',
        profile: {
          create: {
            name: data.name,
            username: data.username,
          },
        },
        settings: {
          create: {},
        },
      },
      include: {
        profile: true,
        settings: true,
      },
    });
  }

  async updateStatus(userId: string, status: { isActive?: boolean; isBanned?: boolean; bannedReason?: string; deletedAt?: Date }) {
    return prisma.user.update({
      where: { id: userId },
      data: status,
    });
  }
}

export default new UserRepository();
