import {MessageQueue, setupAllQueues} from '@hiep20012003/joblance-shared';
import {config} from '@gigs/config';
import {AppLogger} from '@gigs/utils/logger';
import {consumeUserMessage} from '@gigs/queues/consumers/user.consumer';
import {consumeGigReview} from '@gigs/queues/consumers/review.consumer';
import {consumeOrderMessage} from '@gigs/queues/consumers/order.consumer';

export const messageQueue = MessageQueue.getInstance(`${config.RABBITMQ_URL}`);

export const publishChannel: string = 'gigs-publish-channel';
export const consumerChannel: string = 'gigs-consumer-channel';

export async function initQueue() {
    await messageQueue.connect();
    AppLogger.info('RabbitMQ connection established successfully', {operation: 'queue:connect'});
    await setupAllQueues(messageQueue, (error: Error, queueName?: string) => {
        AppLogger.error(
            `[Setup] Failed to setup queue${queueName ? ` "${queueName}"` : ''}`,
            {
                operation: 'queue:setup-all',
                error: error,
            }
        );
    });
    await consumeUserMessage(messageQueue);
    await consumeGigReview(messageQueue);
    await consumeOrderMessage(messageQueue);
}