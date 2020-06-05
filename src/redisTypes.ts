import IORedis = require('ioredis');

declare module 'ioredis' {
  interface Commands {
    hgetallBuffer(
      key: IORedis.KeyType,
      callback: IORedis.Callback<Record<string, Buffer>>,
    ): void;
    hgetallBuffer(key: IORedis.KeyType): Promise<Record<string, Buffer>>;

    zrangeBuffer(
      key: IORedis.KeyType,
      start: number,
      stop: number,
      withScores?: 'WITHSCORES',
    ): Promise<Buffer[]>;

    xaddBuffer: IORedis.OverloadedKeyCommand<IORedis.ValueType, Buffer>;
    xrangeBuffer: IORedis.OverloadedKeyCommand<
      IORedis.ValueType,
      Array<[Buffer, Buffer[]]>
    >;
    xreadBuffer: IORedis.OverloadedListCommand<
      IORedis.ValueType,
      Array<[Buffer, Array<[Buffer, Buffer[]]>]> | null
    >;
  }

  interface Pipeline {
    hgetallBuffer(
      key: IORedis.KeyType,
      callback?: IORedis.Callback<Array<Record<string, Buffer>>>,
    ): IORedis.Pipeline;

    zrangeBuffer(
      key: IORedis.KeyType,
      start: number,
      stop: number,
      callback?: IORedis.Callback<string[]>,
    ): IORedis.Pipeline;
    zrangeBuffer(
      key: IORedis.KeyType,
      start: number,
      stop: number,
      withScores: 'WITHSCORES',
      callback?: IORedis.Callback<string[]>,
    ): IORedis.Pipeline;
  }
}
