import {z} from 'zod';

export const paginateSchema = z.object({
    size: z
        .number()
        .min(1, {message: 'Page size must be at least 1'})
        .default(12),
    from: z
        .number()
        .min(0, {message: 'From must be greater than or equal to 0'})
        .optional(),
    type: z
        .enum(['forward', 'backward'])
        .default('forward'),
    search_after: z
        .array(z.union([z.string(), z.number()]))
        .optional(),
});


export const searchParamsSchema = z.object({
    seller: z.string().optional(),
    keyword: z.string().optional(),
    currency: z.string().optional(),
    categories: z.array(z.string()).default([]),
    subCategories: z.array(z.string()).default([]),
    excludeSellers: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
    paginate: paginateSchema,
    priceMin: z.number().min(0, {message: 'Minimum price cannot be negative'}).optional(),
    priceMax: z.number().min(0, {message: 'Maximum price cannot be negative'}).optional(),
    sort: z.object({
        by: z.string().optional().default('_score'),
        order: z.string().optional().default('desc'),
    }),
    expectedDeliveryDays: z
        .number()
        .min(1, {message: 'Expected delivery must be at least 1 day'})
        .max(365, {message: 'Expected delivery cannot exceed 365 days'})
        .optional(),
});

