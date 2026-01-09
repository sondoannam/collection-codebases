import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class SearchOptionDto {
  @IsString()
  name: string; // e.g., "Color"

  @IsString()
  value: string; // e.g., "Black"
}

export class SearchProductDto {
  @IsString()
  @IsOptional() // Cho phép tìm kiếm không cần text, chỉ lọc theo option
  q?: string; // Query text, e.g., "áo thun"

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SearchOptionDto)
  options?: SearchOptionDto[]; // Array of options, e.g., [{ name: 'Color', value: 'Black' }]
}