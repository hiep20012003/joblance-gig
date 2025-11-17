import {IOrderMessageQueue, MessageQueueType} from '@hiep20012003/joblance-shared';
import {AppLogger} from '@gigs/utils/logger';
import {gigService} from '@gigs/services/gig.service';

export async function handleOrderMessage<T extends Required<IOrderMessageQueue>>(payload: T): Promise<void> {
    const {type, gigId} = payload;
    switch (type) {
        case MessageQueueType.ORDER_STARTED:
            await gigService.updateActiveOrderCount(gigId, 1);
            break;
        case MessageQueueType.ORDER_APPROVED:
            await gigService.updateActiveOrderCount(gigId, -1);
            break;
        case MessageQueueType.ORDER_CANCELED:
            await gigService.updateActiveOrderCount(gigId, -1);
            break;

        default:
            AppLogger.warn(`[Gig Order Handler] Unhandled event type: ${type}`, {operation: 'consumer:handler'});
            break;
    }
}