import { MongoBinary } from "mongodb-memory-server";

/** Download the mongod binary once, so parallel test files don't race on the cache. */
export default async function setup(): Promise<void> {
  await MongoBinary.getPath();
}
