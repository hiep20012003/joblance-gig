import fs from 'fs';
import path from 'path';

import { parse } from 'csv-parse/sync';

export interface CsvRecord {
  [key: string]: string;
}

export type CsvData = Record<string, CsvRecord[]>;

export function readCsvFolder(dirPath: string): CsvData {
  const csvData: CsvData = {};

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    if (file.endsWith('.csv')) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf8');

      const records: CsvRecord[] = parse(content, {
        columns: true,
        skip_empty_lines: true,
      });

      const varName = path.basename(file, '.csv');
      csvData[varName] = records;
    }
  }

  return csvData;
}
