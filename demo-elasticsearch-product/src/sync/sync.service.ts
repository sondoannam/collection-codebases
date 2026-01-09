import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  // Đây là hàm sẽ được gọi từ ProductService
  public async syncProductToEs(productId: string): Promise<void> {
    this.logger.log(`Syncing product to ES: ${productId}`);
    try {
      const esDocument = await this.fetchAndTransformProduct(productId);
      if (esDocument) {
        await this.searchService.indexProduct(esDocument);
        this.logger.log(`Successfully synced product ${productId}`);
      } else {
        this.logger.warn(
          `Product ${productId} not found or invalid. Skipping.`,
        );
        // Ở đây có thể thêm logic xóa document khỏi ES nếu cần
      }
    } catch (error) {
      this.logger.error(`Failed to sync product ${productId}`, error.stack);
    }
  }

  // Hàm này giữ nguyên, đã được sửa lỗi type-safety
  private async fetchAndTransformProduct(
    productId: string,
  ): Promise<any | null> {
    // ... logic giống hệt như trong WorkerService trước đó ...
    const productFromDb = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          include: {
            options: {
              include: {
                optionValue: {
                  include: { option: true },
                },
              },
            },
          },
        },
      },
    });

    if (!productFromDb) return null;
    const variants = productFromDb.variants;
    if (variants.length === 0) return null;

    const minPrice = Math.min(...variants.map((v) => v.price.toNumber()));
    const maxPrice = Math.max(...variants.map((v) => v.price.toNumber()));
    const totalStock = variants.reduce((sum, v) => sum + v.stockQuantity, 0);
    const optionMap = new Map<string, Set<string>>();

    variants.forEach((variant) => {
      variant.options.forEach((opt) => {
        if (!opt.optionValue?.option) return;
        const optionName = opt.optionValue.option.name;
        const optionValue = opt.optionValue.value;
        let valueSet = optionMap.get(optionName);
        if (!valueSet) {
          valueSet = new Set<string>();
          optionMap.set(optionName, valueSet);
        }
        valueSet.add(optionValue);
      });
    });

    const esAvailableOptions: { name: string; value: string }[] = [];
    optionMap.forEach((values, name) => {
      values.forEach((value) => {
        esAvailableOptions.push({ name, value });
      });
    });

    return {
      spu_id: productFromDb.id,
      slug: productFromDb.slug,
      name: productFromDb.name,
      description: productFromDb.description,
      price_range: { min: minPrice, max: maxPrice },
      total_stock: totalStock,
      is_in_stock: totalStock > 0,
      available_options: esAvailableOptions,
      updated_at: productFromDb.updatedAt,
    };
  }

  public async syncSpu(spuId: string): Promise<void> {
    this.logger.log(`Fetching data for SPU ${spuId} to sync.`);
    try {
      const spuData = await this.prisma.product.findUnique({
        where: { id: spuId },
        include: {
          variants: {
            include: {
              options: {
                include: {
                  optionValue: {
                    include: { option: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!spuData || spuData.variants.length === 0) {
        this.logger.warn(
          `SPU ${spuId} not found or has no variants. Skipping.`,
        );
        return;
      }

      // Xây dựng một danh sách các document SKU, MỖI SKU CÓ ATTRS RIÊNG
      const skuDocuments = spuData.variants.map((sku) => {
        // **LOGIC ĐÚNG:** Lấy ra các thuộc tính CỤ THỂ của SKU hiện tại
        const specificAttrs = sku.options.map((opt) => ({
          attrId: opt.optionValue.option.id,
          attrName: opt.optionValue.option.name,
          attrValue: opt.optionValue.value,
        }));

        const skuEsModel = {
          skuId: sku.id,
          spuId: spuData.id,
          skuTitle: spuData.name, // Sẽ được tìm kiếm không dấu
          skuPrice: sku.price.toNumber(),
          skuImg: 'default_image.jpg',
          hasStock: sku.stockQuantity > 0,
          hotScore: 0.0,
          saleCount: 0,
          brandId: 'brand_id_placeholder',
          brandName: 'Brand Placeholder',
          catalogId: 'catalog_id_placeholder',
          catalogName: 'Catalog Placeholder',
          // Gán các thuộc tính CỤ THỂ của SKU này
          attrs: specificAttrs,
        };
        return skuEsModel;
      });

      await this.searchService.bulkIndexProducts(skuDocuments);
      this.logger.log(
        `Successfully synced ${skuDocuments.length} SKUs for SPU ${spuId}.`,
      );
    } catch (error) {
      this.logger.error(`Failed to sync SPU ${spuId}`, error.stack);
    }
  }
}
