import {AppLogger} from '@gigs/utils/logger';
import {EXCHANGES, MessageQueue} from '@hiep20012003/joblance-shared';
import {consumerChannel} from '@gigs/queues/connection';

import {handleOrderMessage} from '../handlers/order.handler';

export async function consumeOrderMessage(messageQueue: MessageQueue) {
    const exchange = EXCHANGES.ORDERS.name;
    const queue = 'gig.orders';

    await messageQueue.consume({
        channelName: consumerChannel,
        exchange,
        queue,
        handler: handleOrderMessage,
        handlerRetryError: (operation: string, context) => {
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

    AppLogger.info('Order consumer started', {
        operation: 'consumer:init',
        context: {queue, exchange},
    });
}
