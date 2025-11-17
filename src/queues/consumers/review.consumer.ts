import { AppLogger } from '@gigs/utils/logger';
import { EXCHANGES, MessageQueue } from '@hiep20012003/joblance-shared';

import { consumerChannel } from '../connection';
import { handleGigReviewMessage } from '../handlers/review.handler';


export async function consumeGigReview(messageQueue: MessageQueue) {
  const exchange = EXCHANGES.REVIEWS.name;
  const queue = 'gig.reviews';
  
  await messageQueue.consume({
    channelName: consumerChannel,
    exchange,
    queue,
    handler: handleGigReviewMessage,
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

  AppLogger.info('Review message consumer listening to queue', {
    operation: 'consumer:init',
    context: { queue, exchange },
  });
}
