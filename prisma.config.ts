import { defineConfig } from "@prisma/client";

export default defineConfig({
  db: {
    adapter: {
      provider: 'sqlite',
      url: process.env.DATABASE_URL,
    },
  },
});
