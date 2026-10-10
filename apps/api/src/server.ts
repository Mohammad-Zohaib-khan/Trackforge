import './config/loadDotenv.js';
import { loadConfig } from './config/env.js';
import { createLogger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const mongoClient = await connectDatabase(config.mongoUri, config.mongoMaxPoolSize);
  const app = createApp({ config, logger, mongoClient });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'TrackForge API listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  // Configuration errors are printed without stack noise; never print env values.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
