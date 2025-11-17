import {gigService} from '@gigs/services/gig.service';
import {IReviewMessageQueue, MessageQueueType} from '@hiep20012003/joblance-shared';

export async function handleGigReviewMessage<T extends Required<IReviewMessageQueue>>(payload: T): Promise<void> {
    const {type} = payload;
    if (type === MessageQueueType.BUYER_REVIEWED) {
        await gigService.updateGigReview(payload);
    }
}