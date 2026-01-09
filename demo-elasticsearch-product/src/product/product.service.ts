import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { SyncService } from '../sync/sync.service';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService, // <--- Thay thế AmqpConnection
  ) {}

  async createProduct(dto: CreateProductDto) {
    // Sử dụng transaction để đảm bảo tất cả các thao tác đều thành công hoặc thất bại cùng nhau
    const newProduct = await this.prisma.$transaction(async (tx) => {
      // 1. Tạo SPU (Sản phẩm chính)
      const product = await tx.product.create({
        data: {
          name: dto.name,
          // Tạo slug duy nhất để tránh trùng lặp
          slug: dto.name.toLowerCase().replace(/\s+/g, '-') + `-${Date.now()}`,
          description: dto.description,
        },
      });

      // 2. Lặp qua từng biến thể (SKU) được gửi lên
      for (const variantDto of dto.variants) {
        
        // Mảng để chứa dữ liệu cho bảng join, sẽ được dùng ở bước 4
        const variantOptionsForJoinTable: { optionValueId: string }[] = [];
        
        // 3. Với mỗi option của SKU (ví dụ: Color: Blue), tìm hoặc tạo (upsert)
        for (const optionDto of variantDto.options) {
          // Tìm hoặc tạo `Option` (e.g., "Color", "Size")
          const option = await tx.option.upsert({
            where: { name: optionDto.optionName },
            update: {},
            create: { name: optionDto.optionName },
          });

          // Tìm hoặc tạo `OptionValue` (e.g., "Blue", "M")
          const optionValue = await tx.optionValue.upsert({
            where: { 
              // Dùng unique key phức hợp đã định nghĩa trong schema
              optionId_value: { optionId: option.id, value: optionDto.optionValue } 
            },
            update: {},
            create: { optionId: option.id, value: optionDto.optionValue },
          });
          
          // Thêm ID của OptionValue vào mảng để chuẩn bị liên kết
          variantOptionsForJoinTable.push({
            optionValueId: optionValue.id
          });
        }
        
        // 4. Tạo SKU và liên kết với các option đã xử lý ở trên thông qua bảng join
        await tx.productVariant.create({
          data: {
            productId: product.id, // Liên kết với SPU
            sku: variantDto.sku,
            price: variantDto.price,
            stockQuantity: variantDto.stockQuantity,
            // Prisma sẽ tự động tạo các record trong bảng join ProductVariantOptionValue
            options: {
              create: variantOptionsForJoinTable,
            },
          },
        });
      }

      // Trả về sản phẩm chính đã được tạo
      return product;
    });

    // 5. Sau khi transaction thành công, gọi hàm đồng bộ (fire-and-forget)
    // this.syncService.syncProductToEs(newProduct.id);
    this.syncService.syncSpu(newProduct.id);
    this.logger.log(`Sync job for product ${newProduct.id} has been dispatched.`);

    return { message: 'Product created successfully. Sync in progress...', productId: newProduct.id };
  }
}