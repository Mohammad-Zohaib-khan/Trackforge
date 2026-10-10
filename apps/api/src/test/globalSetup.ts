import type { TestProject } from 'vitest/node';

/**
 * Integration tests need a MongoDB-compatible server.
 *  - If TEST_MONGODB_URI is set, that server is used (CI service container, Atlas test cluster…).
 *  - Otherwise mongodb-memory-server downloads and starts a real `mongod` for the run.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const external = process.env['TEST_MONGODB_URI'];
  if (external) {
    project.provide('mongoUri', external);
    return async () => {};
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const server = await MongoMemoryServer.create();
  project.provide('mongoUri', server.getUri());
  return async () => {
    await server.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
