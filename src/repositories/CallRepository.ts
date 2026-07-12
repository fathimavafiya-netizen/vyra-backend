import prisma from '../config/db';
import { CallStatus } from '../config/constants';

export class CallRepository {
  async createCall(callerId: string, calleeId: string, type: 'VOICE' | 'VIDEO') {
    return prisma.call.create({
      data: {
        callerId,
        calleeId,
        type,
        status: CallStatus.RINGING,
      },
    });
  }

  async updateCall(
    callId: string,
    status: string,
    extra: { duration?: number; endedAt?: Date } = {},
  ) {
    return prisma.call.update({
      where: { id: callId },
      data: {
        status,
        ...(extra.duration !== undefined ? { duration: extra.duration } : {}),
        ...(extra.endedAt ? { endedAt: extra.endedAt } : {}),
      },
    });
  }

  async getCallHistory(userId: string) {
    return prisma.call.findMany({
      where: {
        OR: [{ callerId: userId }, { calleeId: userId }],
      },
      include: {
        caller: { include: { profile: true } },
        callee: { include: { profile: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  async findById(callId: string) {
    return prisma.call.findUnique({ where: { id: callId } });
  }
}

export default new CallRepository();
