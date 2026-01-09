import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @RabbitSubscribe({
    exchange: 'product.events',
    routingKey: 'product.*',
    queue: 'sync-product-to-es-queue',
  })
  public async handleProductEvent(msg: { productId: string }) {
    this.logger.log(`Received product event for ID: ${msg.productId}`);
    try {
      const esDocument = await this.fetchAndTransformProduct(msg.productId);
      if (esDocument) {
        await this.searchService.indexProduct(esDocument);
        this.logger.log(`Synced product ${msg.productId} to ES.`);
      } else {
        this.logger.warn(`Product ${msg.productId} not found or has no variants. Skipping sync.`);
      }
    } catch (error) {
      this.logger.error(`Failed to sync product ${msg.productId}`, error.stack);
    }
  }

  private async fetchAndTransformProduct(productId: string): Promise<any | null> {
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

    const minPrice = Math.min(...variants.map(v => v.price.toNumber()));
    const maxPrice = Math.max(...variants.map(v => v.price.toNumber()));
    const totalStock = variants.reduce((sum, v) => sum + v.stockQuantity, 0);
    const optionMap = new Map<string, Set<string>>();

    variants.forEach(variant => {
      variant.options.forEach(opt => {
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
      values.forEach(value => { esAvailableOptions.push({ name, value }); });
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
}