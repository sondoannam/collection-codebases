import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { SearchService } from 'src/search/search.service';
import { QueryParserService } from './query-parser.service';
import { DemoSearchService } from './demo-search.service';

export interface SkuEsDocument {
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

@Controller('products')
export class ProductController {
    constructor(private readonly productService: ProductService,
        private readonly searchService: SearchService,
        private readonly queryParser: QueryParserService,
        private readonly demoSearchService: DemoSearchService
    ) { }

    @Post()
    create(@Body() createProductDto: CreateProductDto) {
        return this.productService.createProduct(createProductDto);
    }

   // === KỊCH BẢN 1: TÌM TRÊN MYSQL ===
    @Get('search/scenario1')
    async searchScenario1() {
        // Chúng ta hard-code query để phục vụ mục đích demo
        const query = 'iPhone 17 Pro Max 1TB';
        return this.demoSearchService.searchInMySQL(query);
    }

    // === KỊCH BẢN 2: TÌM TRÊN ES (SPU INDEX) - MINH HỌA LỖI LOGIC ===
    @Get('search/scenario2')
    async searchScenario2() {
        // Hard-code query "sát thủ"
        const query = 'iPhone black 1tb';
        return this.demoSearchService.searchInSpuIndex(query);
    }

    // === KỊCH BẢN 3: TÌM TRÊN ES (SKU INDEX) - GIẢI PHÁP CHUYÊN NGHIỆP ===
    @Get('search/scenario3')
    async searchScenario3(@Query('q') rawQuery: string = ''): Promise<SkuEsDocument[]> {
        const parsedQuery = this.queryParser.parse(rawQuery);
        // Đảm bảo tên hàm đúng là searchProducts
        const results = await this.searchService.searchProducts2(parsedQuery);
        if (results.length === 0) {
            // Trả về 404 nếu không tìm thấy để minh họa rõ hơn
            // throw new NotFoundException(`No products found for query: "${rawQuery}"`);
        }
        return results;
    }
}