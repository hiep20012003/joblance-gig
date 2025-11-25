import path from "path";

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { faker } from '@faker-js/faker';
import { GIG_CATEGORIES, GIG_TAGS, IGigDocument, ISellerDocument, toSlug } from '@hiep20012003/joblance-shared';
import { readCsvFolder } from "@gigs/utils/csv-reader";

import { GigModel } from '../database/models/gig.model';
import { AppLogger } from '../utils/logger';
import { elasticsearch } from '../search/elasticsearch';

const gigsData = readCsvFolder(path.join(__dirname, "../seed/gigs"));


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

function getRandomItem(arr: any) {
  try {
    const randomIndex = Math.floor(Math.random() * arr.length);
    return arr[randomIndex];
  } catch {
    return null;
  }
}

function getRandomItems(arr: any, min: number, max: number) {
  try {
    const randomQuantity = Math.floor(Math.random() * (max - min)) + min;
    const result = [];
    for (let i = 0; i < randomQuantity && i < arr.length; i++) {
      const item = getRandomItem(arr);
      if (item)
        result.push(item);
    }
    return result;
  } catch {
    return [];
  }
}

export const seedGigs = async (req: Request, res: Response) => {
  const operation = 'seedGigs';
  try {
    const { sellers } = req.body as { sellers: ISellerDocument[] };
    if (!sellers?.length) {
      return res.status(400).json({ message: 'No sellers provided for seeding gigs' });
    }

    let gigsToInsert: IGigDocument[] = [];
    let CATEGORIES = [...GIG_CATEGORIES];
    const createdGigs = [];

    for (const seller of sellers) {
      const numberOfGigs = seller.totalGigs ?? faker.number.int({ min: 10, max: 30 });
      
      let countGigs = 0;
        
      while (countGigs < numberOfGigs && CATEGORIES.length > 0) {
        const randomCategory = getRandomItem(CATEGORIES);
        const randomSubCategories = getRandomItems(
          randomCategory.subcategories,
          1, 3 
        );

        if (!randomCategory || !randomSubCategories) continue;

        const randomSubCategory = getRandomItem(randomSubCategories);

        const arr = gigsData[toSlug(String(randomSubCategory))];
        if (!Array.isArray(arr) || arr.length === 0) continue;

        const length = arr.length;
        const randomIndex = Math.floor(Math.random() * (length + 1));
        const seedData = arr[randomIndex];

        if (!seedData) {
          continue;
        } else {
          const index = arr.indexOf(seedData);
          if (randomIndex > -1) arr.splice(index, 1);
          if (arr.length === 0)
            CATEGORIES = CATEGORIES.map((item) => {
              if (item.category === randomCategory) {
                const idx = item.subcategories.indexOf(String(randomSubCategory));
                if (idx !== -1) item.subcategories.splice(idx, 1);
              }

              return item.subcategories.length > 0 ? item : null;
            }).filter(item => item != null);
        }

        const tagKey = randomCategory.category;
        const allTags = GIG_TAGS[tagKey] || [];
        const tags = faker.helpers.arrayElements(allTags, { min: 3, max: 25 });

        // const { ratingCategories, ratingsCount, ratingSum } = generateRatings();

        const gig: IGigDocument = {
          _id: uuidv4(),
          sellerId: seller._id,
          username: seller.username,
          email: seller.email,
          profilePicture: seller.profilePicture,
          title: seedData?.["Title"] ?? faker.lorem.words({ min: 3, max: 10 }),
          basicTitle: seedData?.["Basic_Title"] ?? faker.lorem.words({ min: 3, max: 10 }),
          description: seedData?.["Description"] ?? faker.lorem.paragraph({ min: 3, max: 20 }),
          basicDescription: seedData?.["Basic_Description"] ?? faker.lorem.paragraph({ min: 1, max: 5 }),
          categories: toSlug(String(randomCategory.category)),
          subCategories: randomSubCategories.map(toSlug),
          tags: tags,
          activeOrderCount: 0,
          active: Math.random() < 0.8,
          expectedDeliveryDays: faker.number.int({ min: 1, max: 30 }),
          // ratingsCount,
          // ratingSum,
          // ratingCategories,
          price: (Number(seedData?.["Price"] ?? faker.number.int({ min: 5, max: 10000 }))) * 100,
          currency: 'USD',
          sortId: faker.number.int({ min: 1, max: 1000 }),
          coverImage: seedData?.["Image_URL"] ?? faker.image.url({ width: 1280, height: 720 }),
          requirements: (() => {
            const array = Array.from({ length: 5 }, () => ({
              _id: uuidv4(),
              question: faker.lorem.paragraph({ min: 1, max: 3 }),
              hasFile: faker.datatype.boolean(),
              required: faker.datatype.boolean(),
            }));

            const selected = faker.helpers.arrayElements(array, { min: 1, max: 5 });

            if (selected.length > 0) {
              selected[0].required = true;
            }

            return selected;
          })(),
          isDeleted: false,
          deletedAt: null,
        };

        gigsToInsert.push(gig);
        if (gigsToInsert.length > 500) {
          createdGigs.push((await GigModel.insertMany(gigsToInsert, {
            ordered: false
          })).map(doc => doc.toJSON()));
          gigsToInsert = [];
        }
        countGigs++;
      }
    }

    if (gigsToInsert.length > 0) {
      createdGigs.push((await GigModel.insertMany(gigsToInsert, {
        ordered: false
      })).map(doc => doc.toJSON()));
      gigsToInsert = [];
    }

    // Index in Elasticsearch asynchronously (non-blocking)
    // for (const gig of createdGigs) {
    //   const data = gig.toJSON?.() as IGigDocument;
    //   elasticsearch.addDataToIndex('gigs', gig._id as string, data).catch((err) => {
    //     AppLogger.error('Failed to index gig in Elasticsearch', {
    //       operation,
    //       context: { gigId: gig._id },
    //       error: err
    //     });
    //   });
    // }
    const flatGigs = createdGigs.flat();
    await elasticsearch.addManyDocsToIndex('gigs', flatGigs);

    AppLogger.info(`${flatGigs.length} gigs seeded successfully`, { operation });
    return res.status(201).json({
      message: `${flatGigs.length} gigs seeded successfully`,
      gigs: flatGigs,
    });
  } catch (error: unknown) {
    AppLogger.error('Failed to seed gigs', { operation, error });
    return res.status(500).json({
      message: 'Failed to seed gigs',
      error: (error as Error).message,
    });
  }
};

export const deleteSeededGigs = async (_req: Request, res: Response) => {
  const operation = 'deleteSeededGigs';
  try {
    const deletedCount = await GigModel.deleteMany({ email: { $regex: /@example\.com$/i } });
    
    const query = {
      regexp: {
        email: {
          value: ".*@example.com",
          case_insensitive: true
        }
      }
    };

    await elasticsearch.deleteByQuery('gigs', query);

    AppLogger.info(`${deletedCount.deletedCount} seeded gigs deleted successfully from MongoDB and Elasticsearch`, { operation });
    return res.status(200).json({ message: `${deletedCount.deletedCount} seeded gigs deleted successfully from MongoDB and Elasticsearch` });
  } catch (error: unknown) {
    AppLogger.error('Failed to delete seeded gigs', { operation, error });
    return res.status(500).json({ message: 'Failed to delete seeded gigs', error: (error as Error).message });
  }
};
