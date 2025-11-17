import {Request, Response} from 'express';
import {v4 as uuidv4} from 'uuid';
import {faker} from '@faker-js/faker';
import {IGigDocument, ISellerDocument, GIG_CATEGORIES, GIG_TAGS, toSlug} from '@hiep20012003/joblance-shared';

import {GigModel} from '../database/models/gig.model';
import {AppLogger} from '../utils/logger';
import {elasticsearch} from '../search/elasticsearch';


// Generate consistent rating data
// const generateRatings = () => {
//   const ratingCategories = {
//     five: { value: 5, count: faker.number.int({ min: 0, max: 50 }) },
//     four: { value: 4, count: faker.number.int({ min: 0, max: 40 }) },
//     three: { value: 3, count: faker.number.int({ min: 0, max: 30 }) },
//     two: { value: 2, count: faker.number.int({ min: 0, max: 20 }) },
//     one: { value: 1, count: faker.number.int({ min: 0, max: 10 }) },
//   };
//
//   const ratingsCount = Object.values(ratingCategories).reduce(
//     (sum, { count }) => sum + count,
//     0
//   );
//
//   const ratingSum = Object.values(ratingCategories).reduce(
//     (sum, { value, count }) => sum + value * count,
//     0
//   );
//
//   return { ratingCategories, ratingsCount, ratingSum };
// };

export const seedGigs = async (req: Request, res: Response) => {
    const operation = 'seedGigs';
    try {
        const {sellers} = req.body as { sellers: ISellerDocument[] };
        if (!sellers?.length) {
            return res.status(400).json({message: 'No sellers provided for seeding gigs'});
        }

        const gigsToInsert: IGigDocument[] = [];

        for (const seller of sellers) {
            const numberOfGigs = seller.totalGigs ?? faker.number.int({min: 1, max: 10});

            for (let i = 0; i < numberOfGigs; i++) {
                const randomCategory = faker.helpers.arrayElement(GIG_CATEGORIES);
                const randomSubCategories = faker.helpers.arrayElements(
                    randomCategory.subcategories,
                    {min: 1, max: 3}
                );

                const tagKey = randomCategory.category;
                const allTags = GIG_TAGS[tagKey] || [];
                const tags = faker.helpers.arrayElements(allTags, {min: 3, max: 25});

                // const { ratingCategories, ratingsCount, ratingSum } = generateRatings();

                const gig: IGigDocument = {
                    _id: uuidv4(),
                    sellerId: seller._id,
                    username: seller.username,
                    email: seller.email,
                    profilePicture: seller.profilePicture,
                    title: faker.lorem.words({min: 3, max: 10}),
                    basicTitle: faker.lorem.words({min: 3, max: 10}),
                    description: faker.lorem.paragraph({min: 3, max: 20}),
                    basicDescription: faker.lorem.paragraph({min: 1, max: 5}),
                    categories: toSlug(randomCategory.category),
                    subCategories: randomSubCategories.map(toSlug),
                    tags: tags,
                    activeOrderCount: 0,
                    active: faker.datatype.boolean(),
                    expectedDeliveryDays: faker.number.int({min: 1, max: 30}),
                    // ratingsCount,
                    // ratingSum,
                    // ratingCategories,
                    price: faker.number.int({min: 5, max: 10000}) * 100,
                    currency: 'USD',
                    sortId: faker.number.int({min: 1, max: 1000}),
                    coverImage: faker.image.url({width: 1280, height: 720}),
                    requirements: (() => {
                        const arr = Array.from({length: 5}, () => ({
                            _id: uuidv4(),
                            question: faker.lorem.paragraph({min: 1, max: 3}),
                            hasFile: faker.datatype.boolean(),
                            required: faker.datatype.boolean(),
                        }));

                        const selected = faker.helpers.arrayElements(arr, {min: 1, max: 5});

                        if (selected.length > 0) {
                            selected[0].required = true;
                        }

                        return selected;
                    })(),
                    isDeleted: false,
                    deletedAt: null,
                };

                gigsToInsert.push(gig);
            }
        }

        // Bulk insert
        const createdGigs = await GigModel.insertMany(gigsToInsert, {ordered: false});

        // Index in Elasticsearch asynchronously (non-blocking)
        for (const gig of createdGigs) {
            const data = gig.toJSON?.() as IGigDocument;
            elasticsearch.addDataToIndex('gigs', gig._id as string, data).catch((err) => {
                AppLogger.error('Failed to index gig in Elasticsearch', {
                    operation,
                    context: {gigId: gig._id},
                    error: err
                });
            });
        }

        AppLogger.info(`${createdGigs.length} gigs seeded successfully`, {operation});
        return res.status(201).json({
            message: `${createdGigs.length} gigs seeded successfully`,
            gigs: createdGigs,
        });
    } catch (error: unknown) {
        AppLogger.error('Failed to seed gigs', {operation, error});
        return res.status(500).json({
            message: 'Failed to seed gigs',
            error: (error as Error).message,
        });
    }
};

export const deleteSeededGigs = async (_req: Request, res: Response) => {
    const operation = 'deleteSeededGigs';
    try {
        const gigsToDelete = await GigModel.find({email: {$regex: /@example\.com$/i}}).select('_id');
        const deletedCount = await GigModel.deleteMany({email: {$regex: /@example\.com$/i}});

        for (const gig of gigsToDelete) {
            await elasticsearch.deleteIndexedData('gigs', gig._id as string);
        }

        AppLogger.info(`${deletedCount.deletedCount} seeded gigs deleted successfully from MongoDB and Elasticsearch`, {operation});
        return res.status(200).json({message: `${deletedCount.deletedCount} seeded gigs deleted successfully from MongoDB and Elasticsearch`});
    } catch (error: unknown) {
        AppLogger.error('Failed to delete seeded gigs', {operation, error});
        return res.status(500).json({message: 'Failed to delete seeded gigs', error: (error as Error).message});
    }
};
