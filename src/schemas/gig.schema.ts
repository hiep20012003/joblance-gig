import {z} from 'zod';
import {parseArray, toSlug} from '@hiep20012003/joblance-shared';

const parseNumber = (val: unknown) => {
    const n = Number(val);
    return isNaN(n) ? val : n;
};

export const requirementQuestionSchema = z.preprocess(
    parseArray,
    z.array(
        z.object({
            question: z.string()
                .min(1, {message: 'Question is required'})
                .max(500, {message: 'Question must be at most 500 characters'}),
            hasFile: z.boolean().default(false),
            required: z.boolean().default(false),
        })
    )
        .min(1, {message: 'At least one requirement must be submitted'})
)
    .refine((arr) => {
        if (arr.length === 1) {
            return arr[0].required;
        }
        return true;
    }, {
        message: 'If there is only one requirement, it must be required',
        path: [0, 'required'], // chỉ ra field gây lỗi
    });

const gigCreateSchema = z.object({
    sellerId: z.string().nonempty({message: 'User is required'}),
    email: z.string().nonempty({message: 'User is required'}),
    username: z.string().nonempty({message: 'User is required'}),

    profilePicture: z.string().nonempty({message: 'Profile picture is required'}),
    title: z.string().nonempty({message: 'Gig title is required'}),
    description: z.string().nonempty({message: 'Gig description is required'}),
    categories: z
        .string()
        .nonempty({message: 'Gig category is required'})
        .transform(val => toSlug(val)),

    subCategories: z.preprocess(
        parseArray,
        z
            .array(z.string())
            .min(1, {message: 'Please add at least one subcategory'})
            .transform(arr => arr.map(toSlug))
    ),

    tags: z.preprocess(
        parseArray,
        z
            .array(z.string())
            .min(1, {message: 'Please add at least one tag'})
            .transform(arr => arr.map(toSlug))
    ),

    requirements: requirementQuestionSchema,

    // currency: z.string().min(3, { message: 'Currency must be required.' }).max(3),

    price: z.preprocess(
        parseNumber,
        z.number().gt(4.99, {message: 'Gig price must be greater than $4.99'})
    ),

    expectedDeliveryDays: z.preprocess(
        parseNumber,
        z.number()
            .min(1, {message: 'Expected delivery must be at least 1 day'})
            .max(365, {message: 'Expected delivery cannot exceed 365 days'}),
    ),
    basicTitle: z.string().nonempty({message: 'Gig basic title is required'}),
    basicDescription: z.string().nonempty({message: 'Gig basic description is required'}),
});

const gigUpdateSchema = gigCreateSchema
    .pick({
        title: true,
        description: true,
        categories: true,
        subCategories: true,
        tags: true,
        price: true,
        expectedDeliveryDays: true,
        basicTitle: true,
        basicDescription: true,
        requirements: true,
    });

export type GigCreateDTO = z.infer<typeof gigCreateSchema>;
export type GigUpdateDTO = z.infer<typeof gigUpdateSchema>;
export {gigCreateSchema, gigUpdateSchema};
