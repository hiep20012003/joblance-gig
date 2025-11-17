 
import { IGigDocument } from '@hiep20012003/joblance-shared';

export async function handleGigsElasticsearchSyncMessage<T extends Required<IGigDocument>>(_payload: T): Promise<void> {
  // const { type } = payload;
  // if (type === MessageQueueType.CREATE_BUYER) {
  //   const { username, email } = payload;
  //   const buyer: IBuyerDocument = {
  //     username,
  //     email,
  //     purchasedGigs: [],
  //   };
  //   // await buyerService.createBuyer(buyer);
  // } else {
  //   // await buyerService.updateBuyerPurchasedGigsProp(buyerId, purchasedGigId, type);
  // }
}