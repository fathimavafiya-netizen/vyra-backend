import { Server, Socket } from 'socket.io';
import callRepository from '../repositories/CallRepository';
import notificationService from '../services/NotificationService';
import { onlineUsers } from './state';
import { CallStatus, NotificationType, CALL_RING_TIMEOUT_MS } from '../config/constants';
import logger from '../utils/logger';
import { emitToUser } from '../utils/socketRelay';

/**
 * call.socket.ts — Phase 4B
 *
 * Handles all WebRTC signaling events in an isolated module.
 * Keeps chat.socket.ts clean and allows independent testing.
 *
 * Signal flow:
 *
 *   Caller                        Server                       Callee
 *   ──────                        ──────                       ──────
 *   call_offer          ─────►  createCall(RINGING)  ───►  incoming_call
 *                                setTimeout(30 s)
 *   call_answer         ◄─────  update(ANSWERED)     ◄───  call_answer
 *   ice_candidate       ◄─────  relay                ◄───  ice_candidate
 *   call_end            ─────►  update(ENDED)        ───►  call_ended (both)
 *   call_rejected       ◄─────  update(REJECTED)     ◄───  call_rejected
 *   call_cancelled      ─────►  update(CANCELLED)    ───►  call_cancelled (callee)
 *
 *   Timeout (no answer within 30 s):
 *                                update(MISSED)
 *                                emit call_missed → both
 *                                NotificationService.send(MISSED_CALL → callee)
 */
export default function registerCallHandlers(io: Server, socket: Socket) {
  const callerId = (socket as any).userId as string;

  // Track per-socket active ring timers so they can be cancelled
  const ringTimers = new Map<string, NodeJS.Timeout>();

  // ─────────────────────────────────────────
  // call_offer — initiates a call
  // ─────────────────────────────────────────
  socket.on('call_offer', async (data: {
    calleeId: string;
    type: 'VOICE' | 'VIDEO';
    offer: object; // SDP offer relayed as-is
  }) => {
    const { calleeId, type, offer } = data;
    if (!calleeId || !type || !offer) return;

    try {
      const call = await callRepository.createCall(callerId, calleeId, type);

      // Emit incoming_call to callee if online
      if (!onlineUsers.has(calleeId)) {
        // Callee offline — immediately MISSED
        await callRepository.updateCall(call.id, CallStatus.MISSED, { endedAt: new Date() });
        socket.emit('call_missed', { callId: call.id, reason: 'callee_offline' });
        await notificationService.send({
          userId: calleeId,
          type: NotificationType.MISSED_CALL,
          title: 'Missed Call',
          message: 'You missed a call',
          referenceId: call.id,
        });
        return;
      }

      emitToUser(io, calleeId, 'incoming_call', {
        callId: call.id,
        callerId,
        type,
        offer,
      });

      logger.info(`📞 call_offer: caller=${callerId} callee=${calleeId} type=${type} callId=${call.id}`);

      // 30-second ring timeout
      const timer = setTimeout(async () => {
        ringTimers.delete(call.id);
        const existing = await callRepository.findById(call.id);
        if (!existing || existing.status !== CallStatus.RINGING) return;

        await callRepository.updateCall(call.id, CallStatus.MISSED, { endedAt: new Date() });

        // Notify both parties
        socket.emit('call_missed', { callId: call.id });
        emitToUser(io, calleeId, 'call_missed', { callId: call.id });

        // Push notification to callee
        await notificationService.send({
          userId: calleeId,
          type: NotificationType.MISSED_CALL,
          title: 'Missed Call',
          message: 'You missed a call',
          referenceId: call.id,
        });

        logger.info(`⏰ Call timeout — MISSED: callId=${call.id}`);
      }, CALL_RING_TIMEOUT_MS);

      ringTimers.set(call.id, timer);
    } catch (err: any) {
      socket.emit('call_error', { event: 'call_offer', error: err.message });
      logger.error(`call_offer error: ${err.message}`);
    }
  });

  // ─────────────────────────────────────────
  // call_answer — callee accepts the call
  // ─────────────────────────────────────────
  socket.on('call_answer', async (data: {
    callId: string;
    answer: object; // SDP answer relayed as-is
  }) => {
    const { callId, answer } = data;
    if (!callId || !answer) return;

    try {
      // Cancel ring timeout
      const timer = ringTimers.get(callId);
      if (timer) {
        clearTimeout(timer);
        ringTimers.delete(callId);
      }

      const call = await callRepository.updateCall(callId, CallStatus.ANSWERED);

      // Relay answer to caller
      emitToUser(io, call.callerId, 'call_answered', { callId, answer });

      logger.info(`✅ call_answer: callId=${callId}`);
    } catch (err: any) {
      socket.emit('call_error', { event: 'call_answer', error: err.message });
    }
  });

  // ─────────────────────────────────────────
  // ice_candidate — relay ICE candidate to peer
  // ─────────────────────────────────────────
  socket.on('ice_candidate', async (data: {
    callId: string;
    candidate: object; // ICE candidate relayed as-is
    targetUserId: string;
  }) => {
    const { callId, candidate, targetUserId } = data;
    if (!callId || !candidate || !targetUserId) return;

    emitToUser(io, targetUserId, 'ice_candidate', { callId, candidate });
  });

  // ─────────────────────────────────────────
  // call_end — either party ends the call
  // ─────────────────────────────────────────
  socket.on('call_end', async (data: { callId: string; duration?: number }) => {
    const { callId, duration } = data;
    if (!callId) return;

    try {
      const call = await callRepository.updateCall(callId, CallStatus.ENDED, {
        duration,
        endedAt: new Date(),
      });

      // Notify both parties
      const payload = { callId, duration };

      emitToUser(io, call.callerId, 'call_ended', payload);
      emitToUser(io, call.calleeId, 'call_ended', payload);

      // Push: notify the other party
      const otherId = callerId === call.callerId ? call.calleeId : call.callerId;
      await notificationService.send({
        userId: otherId,
        type: NotificationType.CALL_ENDED,
        title: 'Call Ended',
        message: duration ? `Call duration: ${Math.floor(duration / 60)}m ${duration % 60}s` : 'Call ended',
        referenceId: callId,
      });

      logger.info(`📵 call_end: callId=${callId} duration=${duration}s`);
    } catch (err: any) {
      socket.emit('call_error', { event: 'call_end', error: err.message });
    }
  });

  // ─────────────────────────────────────────
  // call_rejected — callee declines
  // ─────────────────────────────────────────
  socket.on('call_rejected', async (data: { callId: string }) => {
    const { callId } = data;
    if (!callId) return;

    try {
      const timer = ringTimers.get(callId);
      if (timer) { clearTimeout(timer); ringTimers.delete(callId); }

      const call = await callRepository.updateCall(callId, CallStatus.REJECTED, { endedAt: new Date() });

      emitToUser(io, call.callerId, 'call_rejected', { callId });

      logger.info(`🚫 call_rejected: callId=${callId}`);
    } catch (err: any) {
      socket.emit('call_error', { event: 'call_rejected', error: err.message });
    }
  });

  // ─────────────────────────────────────────
  // call_cancelled — caller cancels before answer
  // ─────────────────────────────────────────
  socket.on('call_cancelled', async (data: { callId: string }) => {
    const { callId } = data;
    if (!callId) return;

    try {
      const timer = ringTimers.get(callId);
      if (timer) { clearTimeout(timer); ringTimers.delete(callId); }

      const call = await callRepository.updateCall(callId, CallStatus.CANCELLED, { endedAt: new Date() });

      emitToUser(io, call.calleeId, 'call_cancelled', { callId });

      logger.info(`❌ call_cancelled: callId=${callId}`);
    } catch (err: any) {
      socket.emit('call_error', { event: 'call_cancelled', error: err.message });
    }
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    for (const [, timer] of ringTimers) clearTimeout(timer);
    ringTimers.clear();
  });
}

export { registerCallHandlers };
