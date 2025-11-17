import {
    BadRequestError, ConflictError,
    ErrorCode,
    EXCHANGES,
    IGigDocument,
    IGigMessageQueue,
    IRatingTypes,
    IReviewMessageQueue,
    ISearchParams,
    ISearchResponse,
    MessageQueueType,
    NotFoundError,
    ROUTING_KEYS,
    runInTransaction,
    uploadCloudinary
} from '@hiep20012003/joblance-shared';
import {gigRepository} from '@gigs/repositories/gig.repository';
import {AppLogger} from '@gigs/utils/logger';
import {v4 as uuidv4} from 'uuid';
import {GigModel} from '@gigs/database/models/gig.model';
import {messageQueue, publishChannel} from '@gigs/queues/connection';
import {GigCreateDTO, GigUpdateDTO} from '@gigs/schemas/gig.schema';
import {config} from '@gigs/config';
import {database} from '@gigs/database/connection';
import {workerPool} from '@gigs/workers/pool';

export class GigService {
    constructor() {
    }

    search = async (searchPayload: ISearchParams): Promise<ISearchResponse<IGigDocument>> => {
        console.log('search', searchPayload);
        return await gigRepository.search(searchPayload);
    };

    createGig = async (
        payload: GigCreateDTO,
        coverImageFile?: Express.Multer.File
    ): Promise<IGigDocument> => {

        if (!coverImageFile)
            throw new BadRequestError({
                clientMessage: 'Cover Image must be required.', operation: 'gigs:create'
            });

        return runInTransaction(await database.getConnection(), async (session) => {
            let coverImageUrl: string | undefined;
            let gigId: string | undefined;
            const publicId = uuidv4();

            if (coverImageFile) {
                const file = await uploadCloudinary({
                    file: coverImageFile,
                    publicId,
                    folder: 'joblance/gigs',
                    workerPool: workerPool,
                    resourceType: 'image'
                });
                coverImageUrl = file.secureUrl;
                gigId = publicId;
            }

            const count = await gigRepository.countGigs();
            const data: IGigDocument = {
                _id: gigId ?? uuidv4(),
                sellerId: payload.sellerId,
                username: payload.username,
                email: payload.email,
                profilePicture: payload.profilePicture,
                requirements: payload.requirements ?? [],
                title: payload.title,
                basicTitle: payload.basicTitle,
                description: payload.description,
                basicDescription: payload.basicDescription,
                categories: payload.categories,
                subCategories: payload.subCategories,
                tags: payload.tags,
                price: payload.price * 100,
                activeOrderCount: 0,
                expectedDeliveryDays: payload.expectedDeliveryDays,
                sortId: count + 1,
                coverImage: `${coverImageUrl ?? `${config.GIG_PLACEHOLDER_IMAGE_URL}/1280/720`}`
            };

            const gig = await GigModel.create([data], {session});
            await gigRepository.addGigToIndex(gig[0]);

            AppLogger.info('Gig created successfully.', {
                operation: 'gigs:create',
                context: {gigId: gig[0]._id, sellerId: gig[0].sellerId}
            });

            // Publish message
            const message: IGigMessageQueue = {
                type: MessageQueueType.GIG_CREATED,
                gigCount: 1,
                sellerId: gig[0].sellerId as string
            };

            const exchange = EXCHANGES.GIGS.name;
            const routingKey = ROUTING_KEYS.GIGS.GIG_CREATED;

            await messageQueue.publish({
                channelName: publishChannel,
                exchange,
                routingKey,
                message: JSON.stringify(message)
            });

            AppLogger.info(`Published ${routingKey} to ${exchange} successfully`, {
                operation: 'queue:publish',
                context: {
                    gigId: gig[0].id as string,
                    type: MessageQueueType.GIG_CREATED,
                    status: 'published',
                    exchange,
                    routingKey
                }
            });

            return gig[0].toObject() as IGigDocument;
        });
    };

    updateGig = async (
        gigId: string,
        payload: GigUpdateDTO,
        coverImageFile?: Express.Multer.File
    ): Promise<IGigDocument | null> => {
        return runInTransaction<IGigDocument | null>(await database.getConnection(), async (session) => {
            let coverImageUrl: string | undefined;

            const existingGig = await GigModel.findById(gigId);
            if (!existingGig) {
                throw new NotFoundError({
                    clientMessage: 'Gig not found.',
                    operation: 'gigs:not-found',
                    errorCode: ErrorCode.NOT_FOUND,
                    context: {gigId}
                });
            }

            if (coverImageFile) {
                const file = await uploadCloudinary({
                    file: coverImageFile,
                    publicId: existingGig.id as string,
                    folder: 'joblance/gigs',
                    workerPool: workerPool,
                    resourceType: 'image'
                });
                coverImageUrl = file.secureUrl;
            }

            const data: IGigDocument = {
                title: payload.title,
                basicTitle: payload.basicTitle,
                description: payload.description,
                basicDescription: payload.basicDescription,
                categories: payload.categories,
                subCategories: payload.subCategories,
                requirements: payload.requirements ?? [],
                tags: payload.tags,
                price: payload.price * 100,
                expectedDeliveryDays: payload.expectedDeliveryDays,
                coverImage: coverImageUrl ? `${coverImageUrl}` : existingGig.coverImage
            };

            const gig = await GigModel.findOneAndUpdate(
                {_id: gigId, isDeleted: false},
                {...data},
                {session, new: true}
            );

            await gigRepository.updateGigToIndex(gig);

            AppLogger.info('Gig updated successfully.', {
                operation: 'gig:update-profile',
                context: {gigId: gig!._id, sellerId: gig!.sellerId}
            });

            return gig ? gig.toObject() as IGigDocument : null;
        });
    };

    updateProfilePicture = async (
        sellerId: string,
        profilePicture: string,
    ): Promise<void> => {
        const gigs = await GigModel.find({sellerId, isDeleted: false});
        const bulkOps = gigs.map(gig => ({
            updateOne: {
                filter: {_id: gig._id},
                update: {profilePicture}
            }
        }));
        await GigModel.bulkWrite(bulkOps);

        await Promise.all(gigs.map(gig => {
            gig.profilePicture = profilePicture;
            return gigRepository.updateGigToIndex(gig);
        }));

        AppLogger.info('Gig updated successfully.', {
            operation: 'gig:update-profile-picture',
            context: {sellerId}
        });

    };

    updateGigStatus = async (gigId: string, active: boolean): Promise<IGigDocument> => {
        return runInTransaction(await database.getConnection(), async (session) => {
            const gig = await GigModel.findOne({
                _id: gigId,
                isDeleted: false,
                active: !active,
            });

            if (!gig) {
                throw new NotFoundError({
                    clientMessage: 'Gig not found.',
                    operation: 'gigs:not-found',
                    errorCode: ErrorCode.NOT_FOUND,
                    context: {gigId}
                });
            }

            if (gig?.activeOrderCount !== 0) {
                throw new ConflictError({
                    clientMessage: 'Cannot deactivate this gig while active orders exist.',
                    operation: 'gigs:toggle-active',
                    errorCode: ErrorCode.NOT_FOUND,
                    context: {gigId}
                });
            }

            const updatedGig = await GigModel.findByIdAndUpdate(gig._id, {active}, {session, new: true});

            if (updatedGig) {
                await gigRepository.updateGigToIndex(updatedGig);
            }
            return updatedGig?.toObject() as IGigDocument;
        });
    };

    updateGigReview = async (data: IReviewMessageQueue): Promise<IGigDocument | null> => {
        return runInTransaction(await database.getConnection(), async (session) => {
            const {targetId: sellerId, rating, gigId} = data;
            const ratingTypes: IRatingTypes = {'1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five'};
            const ratingKey: string = ratingTypes[`${rating}`];
            console.log(data)
            const updated = await GigModel.findByIdAndUpdate(
                gigId,
                {
                    $inc: {
                        ratingsCount: 1,
                        ratingSum: rating,
                        [`ratingCategories.${ratingKey}.value`]: rating,
                        [`ratingCategories.${ratingKey}.count`]: 1
                    }
                },
                {new: true, session}
            );

            if (updated) {
                await gigRepository.updateGigToIndex(updated);
                AppLogger.info('Gig review updated', {
                    operation: 'gigs:update-review',
                    context: {sellerId, updatedKeys: ['ratingsCount', 'ratingSum', `ratingCategories`]}
                });
            }

            return updated;
        });
    };

    deleteGig = async (gigId: string): Promise<void> => {
        return runInTransaction(await database.getConnection(), async (session) => {
            const deleted = await GigModel.findOneAndUpdate(
                {_id: gigId, isDeleted: false},
                {isDeleted: true, deletedAt: (new Date()).toISOString()},
                {new: true, session}
            );

            if (deleted) {
                await gigRepository.deleteGigFromIndex(gigId);
                AppLogger.info('Gig deleted successfully.', {operation: 'gig:delete', context: {gigId: deleted._id}});

                // TODO:PUBLISH_MESSAGE_QUEUE:GIG_DELETED
                const exchange = EXCHANGES.GIGS.name;
                const routingKey = ROUTING_KEYS.GIGS.GIG_DELETED;

                const message: IGigMessageQueue = {
                    type: MessageQueueType.GIG_DELETED,
                    sellerId: deleted.sellerId as string,
                    gigCount: -1
                };
                await messageQueue.publish({
                    channelName: publishChannel,
                    exchange,
                    routingKey,
                    message: JSON.stringify(message)
                });

                AppLogger.info(`Published ${routingKey} to ${exchange} successfully`, {
                    operation: 'queue:publish',
                    context: {
                        gigId: deleted._id as string,
                        type: MessageQueueType.GIG_CREATED,
                        status: 'published',
                        exchange,
                        routingKey
                    }
                });
            }
        });
    };

    getGigById = async (gigId: string): Promise<IGigDocument | null> => {
        const gig = await gigRepository.findGigById(gigId);
        return gig;
    };

    getAllGigsBySellerId = async (sellerId: string): Promise<IGigDocument[]> => {
        const gigs = await gigRepository.findGigsBySellerId(sellerId, undefined);
        return gigs ?? [];
    };

    getAllGigsBySellerUsername = async (username: string): Promise<IGigDocument[]> => {
        const gigs = await gigRepository.findGigsBySellerUsername(username, undefined);
        console.log(gigs.length);
        return gigs ?? [];
    };

    getActiveGigsBySellerUsername = async (username: string): Promise<IGigDocument[]> => {
        const gigs = await gigRepository.findGigsBySellerUsername(username, true);
        return gigs ?? [];
    };

    getInactiveGigsBySellerId = async (sellerId: string): Promise<IGigDocument[]> => {
        const gigs = await gigRepository.findGigsBySellerId(sellerId, false);
        return gigs ?? [];
    };

    getInactiveGigsBySellerUsername = async (username: string): Promise<IGigDocument[]> => {
        const gigs = await gigRepository.findGigsBySellerUsername(username, false);
        return gigs ?? [];
    };


    getGigsSimilar = async (gigId: string): Promise<IGigDocument[]> => {
        const result = await gigRepository.findGigsSimilarById(gigId);
        return result ?? [];
    };

    getTopGigs = async (query: Record<string, unknown>): Promise<IGigDocument[]> => {
        const result = await gigRepository.findTopGigs(query);
        return result ?? [];
    };

    async updateActiveOrderCount(gigId: string, value: number) {
        if (value > 0) {
            await GigModel.updateOne(
                {_id: gigId},
                {$inc: {activeOrderCount: value}}
            );
        } else if (value < 0) {
            await GigModel.updateOne(
                {
                    _id: gigId,
                    activeOrderCount: {$gte: Math.abs(value)}
                },
                {$inc: {activeOrderCount: value}}
            );
        }
    }
}

export const gigService: GigService = new GigService();
