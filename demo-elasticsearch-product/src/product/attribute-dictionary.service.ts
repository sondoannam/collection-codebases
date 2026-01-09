import { Injectable } from "@nestjs/common";

// attribute-dictionary.service.ts
@Injectable()
export class AttributeDictionaryService {
  getDictionary(): Map<string, { normalizedValue: string; synonyms: string[] }[]> {
    return new Map([
      [
        'Storage',
        [
          { normalizedValue: '256GB', synonyms: ['256gb', '256'] },
          { normalizedValue: '512GB', synonyms: ['512gb', '512'] },
          { normalizedValue: '1TB', synonyms: ['1tb', '1024gb', '1 terabyte'] },
        ],
      ],
      [
        'Color',
        [
          { normalizedValue: 'Galactic Blue', synonyms: ['blue', 'galactic blue'] },
          { normalizedValue: 'Cosmic Black', synonyms: ['black', 'cosmic'] },
          { normalizedValue: 'Crimson Red', synonyms: ['red', 'crimson'] },
          { normalizedValue: 'Starlight Silver', synonyms: ['silver', 'starlight'] },
        ],
      ],
    ]);
  }
}
