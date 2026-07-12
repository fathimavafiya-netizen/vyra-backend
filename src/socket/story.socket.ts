import { Server, Socket } from 'socket.io';
import logger from '../utils/logger';

export default function registerStoryHandlers(io: Server, socket: Socket) {
  socket.on('react_story', (data: { storyId: string; userId: string; reaction: string }) => {
    const { storyId, userId, reaction } = data;
    if (!storyId) return;

    logger.debug(`Story Slide ${storyId} received reaction "${reaction}" from ${userId}`);
    socket.to(storyId).emit('story_reaction', { storyId, userId, reaction });
  });
}
export { registerStoryHandlers };
