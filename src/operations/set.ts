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
import {versionToString} from '../versions';

const definition = {
  numberOfKeys: 5,
  lua: fs.readFileSync(path.join(__dirname, 'set.lua'), 'utf-8'),
};

declare module 'ioredis' {
  interface Redis {
    lcSetBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      value: Buffer,
      version: string,
      maxlen: number,
    ): Promise<[Buffer]>;
  }

  interface Cluster {
    lcSetBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      value: Buffer,
      version: string,
      maxlen: number,
    ): Promise<[Buffer]>;
  }

  interface Pipeline {
    lcSetBuffer(
      valuesKey: string,
      keysKey: string,
      versionsKey: string,
      changesKey: string,
      revisionKey: string,
      key: string | Buffer,
      value: Buffer,
      version: string,
      maxlen: number,
      callback?: IORedis.Callback<[Buffer]>,
    ): IORedis.Pipeline;
  }
}

export function defineSetCommand(redis: IORedis.Redis | IORedis.Cluster) {
  redis.defineCommand('lcSet', definition);
}

export function transformSetArguments(
  collection: string,
  key: string | Buffer,
  value: Buffer,
  version: number = Infinity,
  maxlen: number = 1000,
): Parameters<IORedis.Redis['lcSetBuffer']> {
  return [
    getKey(collection, VALUES_HASH_SUFFIX),
    getKey(collection, KEYS_SORTED_SET_SUFFIX),
    getKey(collection, VERSIONS_SORTED_SET_SUFFIX),
    getKey(collection, CHANGES_STREAM_SUFFIX),
    getKey(collection, REVISION_SUFFIX),
    key,
    value,
    versionToString(version),
    maxlen,
  ];
}

export type SetResult = {
  revision: string;
};

export function transformSetReply(reply: [Buffer]): SetResult {
  const [revision] = reply;

  return {
    revision: revision.toString(),
  };
}

export function set(
  redis: IORedis.Redis,
  collection: string,
  key: string | Buffer,
  value: Buffer,
  version: number = Infinity,
  maxlen: number = 1000,
): Promise<SetResult> {
  return redis
    .lcSetBuffer(
      ...transformSetArguments(collection, key, value, version, maxlen),
    )
    .then(transformSetReply);
}
