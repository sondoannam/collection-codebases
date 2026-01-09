// import { Injectable } from '@nestjs/common';
// import { AttributeDictionaryService } from './attribute-dictionary.service';

// interface ParsedQuery {
//   q: string;
//   options: { name: string; value: string }[];
// }

// @Injectable()
// export class QueryParserService {
//   constructor(private readonly dictionaryService: AttributeDictionaryService) {}

//   public parse(rawQuery: string): ParsedQuery {
//     const dictionary = this.dictionaryService.getDictionary();
//     const tokens = rawQuery.toLowerCase().split(' ').filter(Boolean); // Tách từ và loại bỏ khoảng trắng thừa

//     const searchTextParts: string[] = [];
//     const foundOptions: { name: string; value: string }[] = [];
//     const processedTokens = new Set<string>();

//     // Vòng 1: Tìm các token khớp với thuộc tính
//     for (const token of tokens) {
//       for (const [optionName, values] of dictionary.entries()) {
//         const foundValue = values.find(v => v.synonyms.includes(token));
//         if (foundValue) {
//           foundOptions.push({ name: optionName, value: foundValue.normalizedValue });
//           processedTokens.add(token);
//           break; // Đã tìm thấy, chuyển sang token tiếp theo
//         }
//       }
//     }

//     // Vòng 2: Các token không phải thuộc tính sẽ là search text
//     for (const token of tokens) {
//       if (!processedTokens.has(token)) {
//         searchTextParts.push(token);
//       }
//     }

//     return {
//       q: searchTextParts.join(' '),
//       options: foundOptions,
//     };
//   }
// }

import { Injectable, Logger } from '@nestjs/common';
import { AttributeDictionaryService } from './attribute-dictionary.service';

interface ParsedQuery {
  q: string;
  options: { name: string; value: string }[];
}

@Injectable()
export class QueryParserService {
  private readonly logger = new Logger(QueryParserService.name);

  constructor(private readonly dictionaryService: AttributeDictionaryService) {}

  public parse(rawQuery: string): ParsedQuery {
    const dictionary = this.dictionaryService.getDictionary();
    console.log('Dictionary:', dictionary);
    const tokens = rawQuery.toLowerCase().split(' ').filter(Boolean);

    const searchTextParts: string[] = [];
    const foundOptions: { name: string; value: string }[] = [];
    const consumedTokens = new Set<string>();

    for (const token of tokens) {
      if (consumedTokens.has(token)) continue; // Bỏ qua token đã xử lý

      let found = false;
      for (const [optionName, values] of dictionary.entries()) {
        const foundValue = values.find(v => v.synonyms.includes(token));
        if (foundValue) {
          foundOptions.push({ name: optionName, value: foundValue.normalizedValue });
          consumedTokens.add(token);
          found = true;
          break; // Tìm thấy rồi, chuyển sang token tiếp theo
        }
      }

      if (!found) {
        searchTextParts.push(token);
      }
    }
    
    const result: ParsedQuery = {
      q: searchTextParts.join(' '),
      options: foundOptions,
    };

    this.logger.log(`Parsed query: q='${result.q}', options=${JSON.stringify(result.options)}`);
    return result;
  }
}