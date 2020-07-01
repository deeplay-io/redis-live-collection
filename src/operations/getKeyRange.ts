import IORedis = require('ioredis');
import * as fs from 'fs';
import * as path from 'path';
import {
  VALUES_HASH_SUFFIX,
  VERSIONS_SORTED_SET_SUFFIX,
  getKey,
  REVISION_SUFFIX,
  KEYS_SORTED_SET_SUFFIX,
} from '../keys';
import {versionFromString} from '../versions';
import {CollectionItem} from '../collectionItem';

const definition = {
  numberOfKeys: 4,
  lua: fs.readFileSync(path.join(__dirname, 'getKeyRange.lua'), 'utf-8'),
};

declare module 'ioredis' {
  interface Redis {
    lcGetKeyRangeBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      revisionKey: string,
      min: string | Buffer,
      max: string | Buffer,
    ): Promise<[Buffer, Array<[Buffer, Buffer, Buffer]>]>;
  }

  interface Cluster {
    lcGetKeyRangeBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      revisionKey: string,
      min: string | Buffer,
      max: string | Buffer,
    ): Promise<[Buffer, Array<[Buffer, Buffer, Buffer]>]>;
  }

  interface Pipeline {
    lcGetKeyRangeBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      revisionKey: string,
      min: string | Buffer,
      max: string | Buffer,
      callback?: IORedis.Callback<[Buffer, Array<[Buffer, Buffer, Buffer]>]>,
    ): IORedis.Pipeline;
  }
}

export function defineGetKeyRangeCommand(redis: IORedis.Redis | IORedis.Cluster) {
  redis.defineCommand('lcGetKeyRange', definition);
}

export function transformGetKeyRangeArguments(
  collection: string,
  min: string | Buffer,
  max: string | Buffer,
): Parameters<IORedis.Redis['lcGetKeyRangeBuffer']> {
  return [
    getKey(collection, VALUES_HASH_SUFFIX),
    getKey(collection, KEYS_SORTED_SET_SUFFIX),
    getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
    getKey(collection, REVISION_SUFFIX),
    min,
    max,
  ];
}

export type GetKeyRangeResult = {
  revision: string;
  items: CollectionItem[];
};

export function transformGetKeyRangeReply(
  reply: [Buffer, Array<[Buffer, Buffer, Buffer]>],
): GetKeyRangeResult {
  const [revision, items] = reply;

  return {
    revision: revision.toString(),
    items: items.map(([key, value, version]) => ({
      key,
      value,
      version: versionFromString(version.toString()),
    })),
  };
}

export function getKeyRange(
  redis: IORedis.Redis,
  collection: string,
  min: string | Buffer,
  max: string | Buffer,
): Promise<GetKeyRangeResult> {
  return redis
    .lcGetKeyRangeBuffer(...transformGetKeyRangeArguments(collection, min, max))
    .then(transformGetKeyRangeReply);
}
