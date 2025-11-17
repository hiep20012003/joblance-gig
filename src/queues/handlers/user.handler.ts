import {gigService} from '@gigs/services/gig.service';
import {ISellerMessageQueue, MessageQueueType} from '@hiep20012003/joblance-shared';

export async function handleUserMessage<T extends Required<ISellerMessageQueue>>(payload: T): Promise<void> {
    const {type, sellerId, profilePicture} = payload;
    if (type === MessageQueueType.PROFILE_PICTURE_UPDATED) {
        if (sellerId)
            await gigService.updateProfilePicture(sellerId, profilePicture);
    }
}