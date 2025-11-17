import {IGigDocument, ISearchOptions, ISearchParams, ISearchResponse} from '@hiep20012003/joblance-shared';
import {elasticsearch} from '@gigs/search/elasticsearch';
import {estypes} from '@elastic/elasticsearch';

export class GigRepository {
    constructor(private readonly elasticsearchIndex: string) {
        this.elasticsearchIndex = elasticsearchIndex;
    }

    private standardizeDocument = (document: IGigDocument): IGigDocument => {
        return {
            ...document,
            _id: document.id,
            id: undefined
        };
    };

    countGigs = async () => {
        return (await elasticsearch.getDocumentCount(this.elasticsearchIndex))?.count ?? 0;
    };

    addGigToIndex = async (gig: IGigDocument | null): Promise<IGigDocument | null> => {
        if (gig) {
            const data: IGigDocument = gig.toJSON?.() as IGigDocument;
            await elasticsearch.addDataToIndex(this.elasticsearchIndex, `${gig._id as string}`, data);
        }

        return gig;
    };

    updateGigToIndex = async (gig: IGigDocument | null): Promise<IGigDocument | null> => {
        if (gig) {
            const data: IGigDocument = gig.toJSON?.() as IGigDocument;
            await elasticsearch.updateIndexedData(this.elasticsearchIndex, `${gig._id as string}`, data);
        }
        return gig;
    };

    deleteGigFromIndex = async (gigId: string): Promise<void> => {
        await elasticsearch.deleteIndexedData(this.elasticsearchIndex, gigId);
    };

    search = async ({
                        keyword,
                        categories = [],
                        subCategories = [],
                        tags = [],
                        paginate,
                        priceMin,
                        priceMax,
                        expectedDeliveryDays,
                        sort,
                        excludeSellers = [],
                    }: ISearchParams): Promise<ISearchResponse<IGigDocument>> => {

        const must: estypes.QueryDslQueryContainer[] = [];
        const filter: estypes.QueryDslQueryContainer[] = [{term: {active: true}}];
        const must_not: estypes.QueryDslQueryContainer[] = [];

        // ======================================================
        // 🔹 Keyword search (ưu tiên mạnh)
        // ======================================================
        // ======================================================
        // 🔹 Keyword search (cross_fields + prefix/wildcard hỗ trợ)
        // ======================================================
        if (keyword) {
            const normalizedKeyword = keyword.toLowerCase().trim();

            must.push({
                bool: {
                    should: [
                        // ✅ Cross-fields (match logic, không fuzziness)
                        {
                            multi_match: {
                                query: normalizedKeyword,
                                type: 'cross_fields',
                                fields: [
                                    'title^6',
                                    'basicTitle^4',
                                    'basicDescription^2',
                                    'tags^3',
                                    'skills^2',
                                    'categories^1.5',
                                    'subCategories^1.5',
                                    'username^0.5',
                                ],
                                operator: 'and',
                                minimum_should_match: '70%',
                                boost: 3
                            }
                        },

                        // ✅ Fuzzy match riêng biệt (best_fields)
                        {
                            multi_match: {
                                query: normalizedKeyword,
                                type: 'best_fields',
                                fields: [
                                    'title^6',
                                    'basicTitle^4',
                                    'tags^3',
                                    'skills^2',
                                    'categories^1.5',
                                    'subCategories^1.5',
                                    'username^0.5',
                                ],
                                fuzziness: 'AUTO',
                                operator: 'and',
                                minimum_should_match: '70%',
                                boost: 2
                            }
                        },

                        // ✅ Prefix match (auto-complete)
                        {
                            prefix: {
                                'title.keyword': {
                                    value: normalizedKeyword,
                                    boost: 2.5
                                }
                            }
                        },

                        // ✅ Wildcard match (fallback)
                        {
                            wildcard: {
                                'title.keyword': {
                                    value: `${normalizedKeyword}*`,
                                    boost: 2.0,
                                    case_insensitive: true
                                }
                            }
                        }
                    ],
                    minimum_should_match: 1
                }
            });
        }

        // ======================================================
        // 🔹 Filters
        // ======================================================
        if (categories.length) filter.push({match: {categories: categories.join(' ')}});
        if (subCategories.length) filter.push({match: {subCategories: subCategories.join(' ')}});
        if (tags.length) filter.push({match: {tags: tags.join(' ')}});

        if (!isNaN(Number(priceMin)) && !isNaN(Number(priceMax))) {
            filter.push({range: {price: {gte: priceMin! * 100, lte: priceMax! * 100}}});
        }

        if (!isNaN(Number(expectedDeliveryDays))) {
            filter.push({range: {expectedDeliveryDays: {lte: expectedDeliveryDays}}});
        }

        // ======================================================
        // 🔹 Exclude (must_not)
        // ======================================================
        if (excludeSellers.length) must_not.push({terms: {'sellerId.keyword': excludeSellers}});

        // ======================================================
        // 🔹 Base Function Score
        // ======================================================
        const baseFunctionScore: estypes.QueryDslQueryContainer = {
            function_score: {
                query: {bool: {must, filter, must_not}},
                functions: [
                    {
                        field_value_factor: {
                            field: 'ratingSum',
                            factor: 0.05,
                            modifier: 'sqrt',
                            missing: 0
                        }
                    },
                    {
                        random_score: {
                            seed: Date.now()
                        },
                        weight: 0.02
                    }
                ],
                score_mode: 'sum',
                boost_mode: 'multiply',
            }
        };

        // ======================================================
        // 🔹 BestSelling score
        // ======================================================
        const bestSellingScore: estypes.QueryDslQueryContainer = {
            script_score: {
                query: {bool: {must, filter, must_not}},
                script: {
                    source: `
                    double ratingSum = doc['ratingSum'].size() > 0 ? doc['ratingSum'].value : 0.0;
                    double ratingsCount = doc['ratingsCount'].size() > 0 ? doc['ratingsCount'].value : 0.0;
                    double avgRating = ratingSum / Math.max(1, ratingsCount);
                    double performance = avgRating * Math.log1p(ratingsCount);
                    long now = new Date().getTime();
                    long createdAt = doc['createdAt'].size() > 0 ? doc['createdAt'].value.toInstant().toEpochMilli() : now;
                    double ageDays = (now - createdAt) / (1000.0 * 60 * 60 * 24);
                    double freshness = ageDays < 30 ? (30 - ageDays) / 30.0 : 0.0;
                    double random = Math.random() * 0.03;
                    return (performance * 0.7) + (freshness * 0.2) + (random * 0.1);
                `
                }
            }
        };

        // ======================================================
        // 🔹 Sort logic
        // ======================================================
        const allowedSortFields = ['price', 'createdAt', 'ratingSum', 'expectedDeliveryDays', 'bestSelling'];
        const sortField = allowedSortFields.includes(sort?.by) ? sort.by : '_score';
        const sortOrder = sort?.order === 'asc' ? 'asc' : 'desc';

        const sortOptions: estypes.SortCombinations[] = [];
        const query: estypes.QueryDslQueryContainer =
            sortField === 'bestSelling' ? bestSellingScore : baseFunctionScore;

        if (sortField === 'bestSelling' || sortField === '_score') {
            sortOptions.push({_score: {order: sortOrder}});
        } else {
            sortOptions.push({[sortField]: sortOrder}, {_score: {order: 'desc'}});
        }

        // ======================================================
        // 🔹 Execute search
        // ======================================================
        const options: ISearchOptions = {
            query,
            sort: sortOptions,
            _source: true,
            from: paginate.from ?? 0,
            size: paginate.size ?? 12
        };

        const searchResult = await elasticsearch.search<IGigDocument>(
            this.elasticsearchIndex,
            options
        );

        return {
            hits: searchResult.hits.map(hit => ({
                ...this.standardizeDocument(hit._source as IGigDocument),
                _score: hit._score
            })),
            total: searchResult.total
        };
    };

    findGigById = async (gigId: string): Promise<IGigDocument | null> => {
        const result = await elasticsearch.getIndexedData<IGigDocument>(this.elasticsearchIndex, gigId);
        const gig = result?._source as IGigDocument;
        if (!gig || !gig.active) {
            return null;
        }
        return this.standardizeDocument(result?._source as IGigDocument);
    };

    findGigsBySellerId = async (
        sellerId: string,
        active: boolean | undefined,
        from = 0,
        size = 10
    ): Promise<IGigDocument[]> => {
        const filters: estypes.QueryDslQueryContainer[] = [
            {
                query_string: {
                    default_field: 'sellerId',
                    query: sellerId
                }
            },
        ];

        if (active !== undefined) {
            filters.push({term: {active}});
        }

        const query: estypes.QueryDslQueryContainer = {
            bool: {filter: filters}
        };

        const options: ISearchOptions = {
            query,
            from,
            size
        };

        const docs = (await elasticsearch.search<IGigDocument>(this.elasticsearchIndex, options)).hits.map((hit) =>
            this.standardizeDocument(hit._source as IGigDocument)
        );
        return docs;
    };


    findGigsBySellerUsername = async (
        username: string,
        active: boolean | undefined,
        from?: number,
        size = 100
    ): Promise<IGigDocument[]> => {
        const filters: estypes.QueryDslQueryContainer[] = [
            {
                query_string: {
                    default_field: 'username',
                    query: username
                }
            },
        ];

        if (active !== undefined) {
            filters.push({term: {active}});
        }

        const query: estypes.QueryDslQueryContainer = {
            bool: {filter: filters}
        };

        const options: ISearchOptions = {
            query,
            from,
            size
        };

        const result = await elasticsearch.search<IGigDocument>(this.elasticsearchIndex, options);

        return result.hits.map((hit) => this.standardizeDocument(hit._source as IGigDocument));
    };


    findGigsByCategory = async (categories: string, from = 0, size = 10): Promise<IGigDocument[] | null> => {
        const query: estypes.QueryDslQueryContainer = {
            bool: {
                must: [
                    {
                        query_string: {
                            fields: ['categories'],
                            query: `*${categories}*`
                        }
                    },
                ],
                filter: [{term: {active: true}}]
            }
        };

        const options: ISearchOptions = {
            query,
            from,
            size
        };

        const docs = (await elasticsearch.search<IGigDocument>(this.elasticsearchIndex, options)).hits.map((hit) =>
            this.standardizeDocument(hit._source as IGigDocument)
        );
        return docs;
    };

    findTopGigs = async (searchParams: {
        sellerId?: string,
        category?: string,
        from?: number,
        size?: number,
    }): Promise<IGigDocument[]> => {
        const {sellerId, category, from = 0, size = 10} = searchParams;
        const mustQueries: estypes.QueryDslQueryContainer[] = [];
        const filterQueries: estypes.QueryDslQueryContainer[] = [{term: {active: true}}];

        if (sellerId?.trim()) {
            mustQueries.push({term: {'sellerId.keyword': sellerId}});
        }

        if (category?.trim()) {
            mustQueries.push({
                match: {
                    categories: {
                        query: category,
                        operator: 'and',
                    },
                },
            });
        }

        // =========================
        // Function Score Logic (Đã sửa boost_mode)
        // =========================
        const query: estypes.QueryDslQueryContainer = {
            function_score: {
                query: {bool: {must: mustQueries, filter: filterQueries}},
                functions: [
                    // Boost dựa trên Tổng Rating (ratingSum)
                    {
                        field_value_factor: {
                            field: 'ratingSum',
                            factor: 0.1,
                            modifier: 'sqrt',
                            missing: 0,
                        },
                        weight: 0.7,
                    },
                    // 2️⃣ Ưu tiên gig mới hơn (Freshness Decay)
                    {
                        gauss: {
                            createdAt: {
                                origin: 'now',
                                scale: '30d',
                                decay: 0.7,
                            },
                        },
                        weight: 0.2,
                    },
                    // Điểm ngẫu nhiên (chống lặp lại hoàn toàn)
                    {
                        random_score: {
                            seed: Date.now()
                        },
                        weight: 0.2
                    }
                ],
                score_mode: 'sum',
                boost_mode: 'sum',
            },
        };

        // =========================
        // 🔹 Sort: theo điểm tổng hợp (score)
        // =========================
        const sortOptions: estypes.SortCombinations[] = [{_score: {order: 'desc'}}];

        const options: ISearchOptions = {
            query,
            sort: sortOptions,
            from,
            size,
            _source: true,
        };

        const result = await elasticsearch.search<IGigDocument>(this.elasticsearchIndex, options);
        console.log(result);
        return result.hits.map((hit) =>
            this.standardizeDocument(hit._source as IGigDocument)
        );
    };

    findGigsSimilarById = async (gigId: string, from = 0, size = 10): Promise<IGigDocument[] | null> => {
        const gigHit = await elasticsearch.getIndexedData<IGigDocument>(this.elasticsearchIndex, gigId);

        if (!gigHit || !gigHit.found || !gigHit._source) return null;
        const gig = gigHit._source;

        // Tính toán Price Scale dựa trên giá trị thực tế để kiểm soát độ rộng của hàm Gauss
        // Sử dụng giá trị tuyệt đối cho price và đặt một giá trị tối thiểu (minScale) để tránh scale quá nhỏ
        const priceValue = Math.max(gig.price || 0, 0);
        const minScale = 5; // Đảm bảo scale không quá nhỏ, ví dụ: $5
        const priceScale = Math.max(priceValue * 0.3, minScale);

        const query: estypes.QueryDslQueryContainer = {
            function_score: {
                query: {
                    bool: {
                        must: [
                            // 1. MUST: Multi_Match cho sự liên quan của văn bản
                            {
                                multi_match: {
                                    query: [
                                        gig.username,
                                        gig.title,
                                        gig.basicTitle,
                                        gig.basicDescription,
                                        gig.categories,
                                        ...(gig.subCategories || []),
                                        ...(gig.tags || [])
                                    ].join(' '),
                                    fields: [
                                        'username^0.5',
                                        'title^4',
                                        'basicTitle^3',
                                        'basicDescription^1.5',
                                        'categories^2.5',
                                        'subCategories^2',
                                        'tags^1'
                                    ],
                                    type: 'best_fields',
                                }
                            }
                        ],
                        filter: [
                            {term: {active: true}},
                            // {range: {ratingAvg: {gte: 3.0}}},
                            // {term: {categories: gig.categories}}
                        ],
                        must_not: [
                            {term: {_id: gigId}}
                        ]
                    }
                },
                functions: [
                    {
                        field_value_factor: {
                            field: 'ratingSum',
                            factor: 3,
                            modifier: 'log1p',
                            missing: 0
                        },
                        weight: 5
                    },
                    {
                        gauss: {
                            price: {
                                origin: priceValue,
                                scale: priceScale,
                                decay: 0.5
                            }
                        },
                        weight: 10
                    },
                    {
                        gauss: {
                            createdAt: {
                                origin: 'now',
                                scale: '30d',
                                offset: '7d',
                                decay: 0.5
                            }
                        },
                        weight: 2
                    }
                ],
                score_mode: 'multiply',
                boost_mode: 'multiply'
            }
        };

        const options: ISearchOptions = {query, from, size, _source: true};

        const docs = (await elasticsearch.search<IGigDocument>(this.elasticsearchIndex, options)).hits.map((hit) =>
            this.standardizeDocument(hit._source as IGigDocument)
        );

        return docs;
    };

}

export const gigRepository: GigRepository = new GigRepository('gigs');
