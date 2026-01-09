import { Injectable, OnModuleInit, Logger, InternalServerErrorException } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { QueryDslQueryContainer, Sort, SortOrder } from '@elastic/elasticsearch/lib/api/types';

interface SkuEsDocument {
    skuId: string;
    spuId: string;
    skuTitle: string;
    skuPrice: number;
    skuImg: string;
    hasStock: boolean;
    hotScore: number;
    saleCount: number;
    brandId: string;
    brandName: string;
    catalogId: string;
    catalogName: string;
    attrs: {
        attrId: string;
        attrName: string;
        attrValue: string;
    }[];
}

@Injectable()
export class SearchService implements OnModuleInit {
    private readonly logger = new Logger(SearchService.name);
    public readonly client: Client;

    constructor(private configService: ConfigService) {
        // const cloudId = this.configService.get<string>('ELASTIC_CLOUD_ID');
        // const username = this.configService.get<string>('ELASTIC_USERNAME');
        // const password = this.configService.get<string>('ELASTIC_PASSWORD');

        // if (!cloudId || !username || !password) {
        //   throw new Error('Elasticsearch Cloud credentials are not configured');
        // }

        const node = "https://e880df3dd3824b26a30a5d8ba5dc00ad.asia-southeast1.gcp.elastic-cloud.com:443"//this.configService.get<string>('ELASTIC_ENDPOINT');
        const apiKey = "cXBFME1KZ0JHM00tTU5rWnowRnY6eUY2aURtLURHMEx3MzJPTDF2b2NtQQ=="//this.configService.get<string>('ELASTIC_API_KEY');

        if (!node || !apiKey) {
            throw new Error('Elasticsearch endpoint and API key are not configured');
        }

        this.client = new Client({
            node: node, // URL của Elasticsearch node
            auth: {
                apiKey: apiKey, // Sử dụng API Key để xác thực
            },
        });
    }

    async onModuleInit() {
        try {
            await this.client.info();
            this.logger.log('Connected to Elasticsearch Cloud');
            await this.createProductIndex2();
            await this.createProductIndex();
        } catch (error) {
            this.logger.error('Failed to connect to Elasticsearch Cloud', error);
        }
    }

    // version 2
    private async createProductIndex2() {
        const indexName = 'products_v2';
        const exists = await this.client.indices.exists({ index: indexName });

        if (!exists) {
            this.logger.log(`Index "${indexName}" not found. Re-creating with SKU-based mapping...`);
            await this.client.indices.create({
                index: indexName,
                settings: {
                    analysis: {
                        analyzer: {
                            vietnamese_analyzer: {
                                type: 'custom',
                                tokenizer: 'standard',
                                filter: ['lowercase', 'asciifolding']
                            }
                        }
                    }
                },
                mappings: {
                    properties: {
                        skuId: { "type": "keyword" }, // ID của document là SKU ID
                        spuId: { "type": "keyword" }, // Để gom nhóm sau này

                        skuTitle: { // Tên của SKU (có thể giống tên SPU)
                            "type": "text",
                            "analyzer": "vietnamese_analyzer",
                            "fields": { "keyword": { "type": "keyword" } }
                        },
                        skuPrice: { "type": "double" },
                        skuImg: { "type": "keyword", "index": false },

                        hasStock: { "type": "boolean" },
                        hotScore: { "type": "double" }, // Dùng double để linh hoạt hơn
                        saleCount: { "type": "long" },

                        brandId: { "type": "keyword" },
                        brandName: { "type": "keyword" },

                        catalogId: { "type": "keyword" },
                        catalogName: { "type": "keyword" },

                        // Quan trọng nhất: các thuộc tính có thể tìm kiếm của SPU
                        attrs: {
                            "type": "nested",
                            "properties": {
                                "attrId": { "type": "keyword" },
                                "attrName": { "type": "keyword" },
                                "attrValue": { "type": "keyword" }
                            }
                        }
                    }
                }
            });
            this.logger.log(`Index "${indexName}" created.`);
        }
    }

    private async createProductIndex() {
        const indexName = 'products_v1';
        const exists = await this.client.indices.exists({ index: indexName });

        if (!exists) {
            this.logger.log(`Index "${indexName}" not found. Creating...`);
            await this.client.indices.create({
                index: indexName,
                mappings: {
                    properties: {
                        spu_id: { type: 'keyword' },
                        slug: { type: 'keyword' },
                        name: {
                            type: 'text',
                            analyzer: 'standard',
                            fields: { keyword: { type: 'keyword' } },
                        },
                        description: { type: 'text', analyzer: 'standard' },
                        brand: { type: 'keyword' },
                        categories: { type: 'keyword' },
                        price_range: {
                            type: 'object',
                            properties: {
                                min: { type: 'double' },
                                max: { type: 'double' },
                            },
                        },
                        total_stock: { type: 'integer' },
                        is_in_stock: { type: 'boolean' },
                        available_options: {
                            type: 'nested',
                            properties: {
                                name: { type: 'keyword' },
                                value: { type: 'keyword' },
                            },
                        },
                        updated_at: { type: 'date' },
                    },
                },
            });
            this.logger.log(`Index "${indexName}" created.`);
        }
    }

    async indexProduct(productDocument: Record<string, any>) {
        return this.client.index({
            index: 'products_v1',
            id: productDocument.spu_id,
            document: productDocument,
        });
    }

    async searchProducts(queryDto: { q?: string; options?: { name: string; value: string }[] }) {
        const { q, options } = queryDto;

        console.log('Search query:', q, 'Options:', options);
        const mustClauses: QueryDslQueryContainer[] = [];
        if (q) {
            mustClauses.push({
                match: {
                    name: {
                        query: q,
                        operator: 'and',
                        fuzziness: 'AUTO',
                    },
                },
            });
        }

        // Sửa luôn ở đây cho nhất quán
        const filterClauses: QueryDslQueryContainer[] = [];
        if (options && options.length > 0) {
            const nestedQueries = options.map(opt => ({
                nested: {
                    path: 'available_options',
                    query: {
                        bool: {
                            must: [
                                { term: { 'available_options.name': opt.name } },
                                { term: { 'available_options.value': opt.value } },
                            ],
                        },
                    },
                },
            }));
            filterClauses.push(...nestedQueries);
        }

        try {
            const response = await this.client.search({
                index: 'products',
                query: {
                    bool: {
                        must: mustClauses.length > 0 ? mustClauses : undefined,
                        filter: filterClauses.length > 0 ? filterClauses : undefined,
                    },
                },
            });

            return response.hits.hits.map(hit => hit._source);
        } catch (error) {
            this.logger.error('Error during Elasticsearch search', error.meta?.body || error);
            throw new Error('Search failed');
        }
    }

    async bulkIndexProducts(skuDocuments: Record<string, any>[]) {
        if (skuDocuments.length === 0) return;

        const operations = skuDocuments.flatMap(doc => [
            { index: { _index: 'products_v2', _id: doc.skuId } },
            doc
        ]);

        await this.client.bulk({ refresh: true, operations });

    }

    async searchProducts2(queryDto: { q?: string; options?: { name: string; value: string }[] }): Promise<SkuEsDocument[]> {
        // Luôn đảm bảo queryDto là một object hợp lệ
        const { q, options } = queryDto || {};

        const mustClauses: QueryDslQueryContainer[] = [];
        // Chỉ thêm `match` query nếu `q` thực sự là một chuỗi có nội dung
        if (typeof q === 'string' && q.trim() !== '') {
            mustClauses.push({
                match: {
                    skuTitle: {
                        query: q,
                        operator: 'and',
                        fuzziness: 'AUTO',
                    },
                },
            });
        } else {
            // Mặc định là tìm tất cả
            mustClauses.push({ match_all: {} });
        }

        const filterClauses: QueryDslQueryContainer[] = [];
        // Chỉ xử lý filter nếu `options` là một mảng và có phần tử
        if (Array.isArray(options) && options.length > 0) {
            const nestedQueries = options.map(opt => ({
                nested: {
                    path: 'attrs',
                    query: {
                        bool: {
                            must: [
                                { term: { 'attrs.attrName': opt.name } },
                                { term: { 'attrs.attrValue': opt.value } },
                            ],
                        },
                    },
                },
            }));
            filterClauses.push(...nestedQueries);
        }

        const sortOptions: Sort = [
            { _score: { order: 'desc' as SortOrder } },
            { hotScore: { order: 'desc' as SortOrder } },
        ];

        try {
            const response = await this.client.search<SkuEsDocument>({
                index: 'products_v2',
                query: {
                    bool: {
                        must: mustClauses,
                        filter: filterClauses.length > 0 ? filterClauses : undefined,
                    },
                },
                collapse: { field: 'spuId' },
                sort: sortOptions,
                size: 20,
            });

            return response.hits.hits
                .map(hit => hit._source)
                .filter((source): source is SkuEsDocument => source !== undefined);

        } catch (error) {
            this.logger.error('Error during Elasticsearch search', error.meta?.body || error);
            throw new InternalServerErrorException('An error occurred while searching for products.');
        }
    }
}