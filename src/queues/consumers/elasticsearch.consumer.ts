import { AppLogger } from '@gigs/utils/logger';
import { EXCHANGES } from '@hiep20012003/joblance-shared';

import { consumerChannel, messageQueue } from '../connection';
import { handleGigsElasticsearchSyncMessage } from '../handlers/elasticsearch.handler';


export async function consumeGigsElasticsearchSync() {
  const exchange = EXCHANGES.GIGS.name;
  const queue = 'user-buyer-auth';
  
  await messageQueue.consume({
    channelName: consumerChannel,
    exchange,
    queue,
    handler: handleGigsElasticsearchSyncMessage,
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

  AppLogger.info('Elasticsearch Sync message consumer listening to queue', {
    operation: 'consumer:init',
    context: { queue, exchange },
  });
}
