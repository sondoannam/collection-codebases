import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DemoSearchService {
  private readonly logger = new Logger(DemoSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * KỊCH BẢN 1: TÌM KIẾM TRỰC TIẾP TRÊN MYSQL
   */
  async searchInMySQL(q: string) {
    this.logger.log(`[Scenario 1] Searching in MySQL for: "${q}"`);

    const searchText = 'iPhone 17 Pro Max';
    const storageValue = '1TB';

    const products = await this.prisma.product.findMany({
      where: {
        name: { contains: searchText },
        variants: {
          some: {
            options: {
              some: {
                optionValue: {
                  value: storageValue,
                  option: { name: 'Storage' },
                },
              },
            },
          },
        },
      },
      // === PHẦN NÂNG CẤP ĐỂ HIỂN THỊ ĐẦY ĐỦ DỮ LIỆU ===
      include: {
        // Lấy tất cả các biến thể (SKU) của SPU tìm được
        variants: {
          include: {
            // Với mỗi SKU, lấy ra các thuộc tính đã chọn
            options: {
              include: {
                // Với mỗi thuộc tính, lấy thông tin chi tiết của OptionValue
                optionValue: {
                  include: {
                    // Và lấy cả tên của Option (Color, Storage)
                    option: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    this.logger.log(`[Scenario 1] Found ${products.length} SPU(s).`);
    return { 
      scenario: 1, 
      result: products 
    };
  
  }

  /**
   * KỊCH BẢN 2: TÌM KIẾM TRÊN ES VỚI DOCUMENT SPU
   * (Chúng ta sẽ giả lập kết quả để minh họa lỗi logic)
   */
  async searchInSpuIndex(q: string) {
    this.logger.log(`[Scenario 2] Searching in SPU-based ES Index for: "${q}"`);

    // Phân tích query thủ công
    const searchText = 'iPhone';
    const color = 'Cosmic Black';
    const storage = '1TB';

    // Giả lập document SPU trong ES
    const spuDocumentInEs = {
      name: "iPhone 17 Pro Max",
      available_colors: ["Starlight Silver", "Cosmic Black", "Galactic Blue", "Crimson Red"],
      available_storages: ["256GB", "512GB", "1TB"],
    };

    // Giả lập logic tìm kiếm của ES
    const isNameMatch = spuDocumentInEs.name.includes(searchText);
    const isColorMatch = spuDocumentInEs.available_colors.includes(color);
    const isStorageMatch = spuDocumentInEs.available_storages.includes(storage);

    if (isNameMatch && isColorMatch && isStorageMatch) {
      this.logger.warn(`[Scenario 2] Found a match, but it's a PHANTOM product!`);
      return {
        scenario: 2,
        description: "Found a result, but it's incorrect. This SPU has 'Cosmic Black' and '1TB', but not on the same SKU. This is the 'loss of correlation' problem.",
        result: spuDocumentInEs,
      };
    }

    return { scenario: 2, description: "No result found.", result: null };
  }
}