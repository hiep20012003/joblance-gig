import { Umzug } from 'umzug';

export const migrator = new Umzug({
  migrations: {
    glob: ['./migrations/*.ts', { cwd: __dirname }],
  },
  logger: console,
});

export const seeder = new Umzug({
  migrations: {
    glob: ['./seeders/*.ts', { cwd: __dirname }],
  },
  logger: console,
});

export type Migration = typeof migrator._types.migration;
export type Seeder = typeof seeder._types.migration;
