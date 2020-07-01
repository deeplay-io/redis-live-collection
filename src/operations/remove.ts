import IORedis = require('ioredis');
import * as fs from 'fs';
import * as path from 'path';
import {
  VALUES_HASH_SUFFIX,
  VERSIONS_SORTED_SET_SUFFIX,
  getKey,
  CHANGES_STREAM_SUFFIX,
  REVISION_SUFFIX,
  KEYS_SORTED_SET_SUFFIX,
} from '../keys';

const definition = {
  numberOfKeys: 5,
  lua: fs.readFileSync(path.join(__dirname, 'remove.lua'), 'utf-8'),
};

declare module 'ioredis' {
  interface Redis {
    lcRemoveBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      maxlen: number,
    ): Promise<[Buffer]>;
  }

  interface Cluster {
    lcRemoveBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      maxlen: number,
    ): Promise<[Buffer]>;
  }

  interface Pipeline {
    lcRemoveBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      maxlen: number,
      callback?: IORedis.Callback<[Buffer]>,
    ): IORedis.Pipeline;
  }
}

export function defineRemoveCommand(redis: IORedis.Redis | IORedis.Cluster) {
  redis.defineCommand('lcRemove', definition);
}

export function transformRemoveArguments(
  collection: string,
  key: string | Buffer,
  maxlen: number = 1000,
): Parameters<IORedis.Redis['lcRemoveBuffer']> {
  return [
    getKey(collection, VALUES_HASH_SUFFIX),
    getKey(collection, KEYS_SORTED_SET_SUFFIX),
    getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
    getKey(collection, CHANGES_STREAM_SUFFIX),
    getKey(collection, REVISION_SUFFIX),
    key,
    maxlen,
  ];
}

export type RemoveResult = {
  revision: string;
};

export function transformRemoveReply(reply: [Buffer]): RemoveResult {
  const [revision] = reply;

  return {
    revision: revision.toString(),
  };
}

export function remove(
  redis: IORedis.Redis,
  collection: string,
  key: string | Buffer,
  maxlen: number = 1000,
): Promise<RemoveResult> {
  return redis
    .lcRemoveBuffer(...transformRemoveArguments(collection, key, maxlen))
    .then(transformRemoveReply);
}
