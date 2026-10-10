import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Loads `.env` for local development: apps/api/.env first, then the repository root .env.
 * Real environment variables always win; in production set them on the host instead.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: [path.resolve(here, '../../.env'), path.resolve(here, '../../../../.env')],
  quiet: true,
});
