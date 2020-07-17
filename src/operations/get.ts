import IORedis = require('ioredis');
import * as fs from 'fs';
import * as path from 'path';
import {
  VALUES_HASH_SUFFIX,
  VERSIONS_SORTED_SET_SUFFIX,
  getKey,
  REVISION_SUFFIX,
} from '../keys';
import {versionFromString} from '../versions';

const definition = {
  numberOfKeys: 3,
  lua: fs.readFileSync(path.join(__dirname, 'get.lua'), 'utf-8'),
};

declare module 'ioredis' {
  interface Redis {
    lcGetBuffer(
      valuesKey: string,
      versionsKey: string,
      revisionKey: string,
      key: string | Buffer,
    ): Promise<[Buffer, Buffer?, Buffer?]>;
  }

  interface Cluster {
    lcGetBuffer(
      valuesKey: string,
      versionsKey: string,
      revisionKey: string,
      key: string | Buffer,
    ): Promise<[Buffer, Buffer?, Buffer?]>;
  }

  interface Pipeline {
    lcGetBuffer(
      valuesKey: string,
      versionsKey: string,
      revisionKey: string,
      key: string | Buffer,
      callback?: IORedis.Callback<[Buffer, Buffer?, Buffer?]>,
    ): IORedis.Pipeline;
  }
}

export function defineGetCommand(redis: IORedis.Redis | IORedis.Cluster) {
  redis.defineCommand('lcGet', definition);
}

export function transformGetArguments(
  collection: string,
  key: string | Buffer,
): Parameters<IORedis.Redis['lcGetBuffer']> {
  return [
    getKey(collection, VALUES_HASH_SUFFIX),
    getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
    getKey(collection, REVISION_SUFFIX),
    key,
  ];
}

export type GetResult = {
  revision: string;
  value: Buffer | null;
  version: number;
};

export function transformGetReply(
  reply: [Buffer, Buffer?, Buffer?],
): GetResult {
  const [revision, value = null, version] = reply;

  return {
    revision: revision.toString(),
    value,
    version: version == null ? 0 : versionFromString(version.toString()),
  };
}

export function get(
  redis: IORedis.Redis,
  collection: string,
  key: string | Buffer,
): Promise<GetResult> {
  return redis
    .lcGetBuffer(...transformGetArguments(collection, key))
    .then(transformGetReply);
}
