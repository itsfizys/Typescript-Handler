import { defineConfig } from 'drizzle-kit';
import { config } from './src/config/config.ts';

export default defineConfig({
        schema: './src/database/schema/index.ts',
        out: './drizzle',
        dialect: 'postgresql',
        dbCredentials: {
                url: config.database.url as string,
        },
});
