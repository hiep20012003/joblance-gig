import { AppLogger } from '@gigs/utils/logger';
import { EXCHANGES, MessageQueue } from '@hiep20012003/joblance-shared';

import { consumerChannel } from '../connection';
import { handleUserMessage } from '../handlers/user.handler';


export async function consumeUserMessage(messageQueue: MessageQueue) {
  const exchange = EXCHANGES.USERS.name;
  const queue = 'gig.users';
  
  await messageQueue.consume({
    channelName: consumerChannel,
    exchange,
    queue,
    handler: handleUserMessage,
    handlerRetryError: (operation: string, context: unknown)=>{
      AppLogger.error(
        `Exceeded max retries`,
        {
          operation,
          context
        }
      );
    },
    maxRetries: 5,
  });

  AppLogger.info('Users message consumer listening to queue', {
    operation: 'consumer:init',
    context: { queue, exchange },
  });
}
