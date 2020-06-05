# Redis Live Collection

Redis-based realtime collection with compare-and-set support for NodeJS.

<!-- TOC depthFrom:2 -->

- [Installation](#installation)
- [Design](#design)
- [Usage](#usage)
  - [Connection Pool](#connection-pool)
  - [Pipelining](#pipelining)
  - [Cluster](#cluster)
- [API](#api)
  - [get](#get)
  - [getAll](#getall)
  - [getKeyRange](#getkeyrange)
  - [getVersionRange](#getversionrange)
  - [watch](#watch)
  - [set](#set)
  - [compareAndSet](#compareandset)
  - [remove](#remove)
  - [compareAndRemove](#compareandremove)
  - [removeKeyRange](#removekeyrange)
  - [removeVersionRange](#removeversionrange)
  - [makePrefixRange](#makeprefixrange)
  - [initCommands](#initcommands)

<!-- /TOC -->

## Installation

    yarn add redis-live-collection

## Design

A collection consists of key-value pairs, where keys and values are `Buffer`s
and have a numeric version. A collection uses a set of Redis keys:

- `<collectionName>:values`: Hash mapping keys to values.
- `<collectionName>:keys`: Sorted Set of keys with all scores set to `0`.
- `<collectionName>:versions`: Sorted Set of keys scored by version.
- `<collectionName>:changes`: Stream of collection changes.
- `<collectionName>:revision`: Stream ID of the last change entry.

By storing keys in a Sorted Set `keys` we get the ability to efficiently
retrieve or remove lexicographic ranges of keys. Sorted Set `versions` allows to
retrieve or remove ranges of versions.

A version is an arbitrary `number` (including `Infinity`). It is up to user to
assign a meaning to versions or even use versions at all.

Versions enable compare-and-set operations, where you can atomically compare
current version of a key with given number and only update the key if the
condition is true.

Stream `changes` allows to [`watch`](#watch) a collection and receive updates in
realtime.

## Usage

Call [`initCommands`](#initcommands) on
[`ioredis`](https://github.com/luin/ioredis) instance to initialize Lua scripts:

```ts
import * as IORedis from 'ioredis';
import {initCommands} from 'redis-live-collection';

const redis = new IORedis();
initCommands(redis);
```

Now you can invoke collection operations using this instance:

```ts
import {set, getAll, watch} from 'redis-live-collection';

await set(redis, 'my-collection', 'some-key', Buffer.from('value'));
const {revision, items} = await getAll(redis, 'my-collection');
const observable = watch(redis, 'my-collection', revision);
```

### Connection Pool

Since reading from a Stream is blocking, to use [`watch`](#watch) you need to
set up a connection pool. Example using
[`generic-pool`](https://github.com/coopernurse/node-pool):

```ts
import {createPool} from 'generic-pool';
import {defer} from 'rxjs';
import {finalize} from 'rxjs/operators';

const redisPool = createPool(
  {
    async create() {
      const redis = new IORedis({
        lazyConnect: true,
      });
      initCommands(redis);

      await redis.connect();

      return redis;
    },
    async destroy(redis) {
      await redis.quit();
    },
  },
  {
    min: 1,
    max: 100,
    evictionRunIntervalMillis: 10_000,
    acquireTimeoutMillis: 10_000,
  },
);

const {revision, items} = await pool.use((redis) =>
  getAll(redis, 'my-collection'),
);

const observable = defer(() => pool.acquire()).pipe(
  concatMap((redis) =>
    watch(redis, 'my-collection', revision).pipe(
      finalize(() => {
        pool.release(redis);
      }),
    ),
  ),
);
```

### Pipelining

It is possible to use some operations with
[Pipelining](https://github.com/luin/ioredis#pipelining). For example, to
transactionally get multiple fields:

```ts
import {transformGetArguments, transformGetReply} from 'redis-live-collection';

const rawResults = await redis
  .multi()
  .lcGetBuffer(...transformGetArguments('my-collection', 'key-1'))
  .lcGetBuffer(...transformGetArguments('my-collection', 'key-2'))
  .lcGetBuffer(...transformGetArguments('my-collection', 'key-3'))
  .exec();

const results = rawResults.map(([err, res]) => {
  if (err) {
    throw err;
  }

  return transformGetReply(res);
});
```

### Cluster

With Redis Cluster, it is important that all the keys used by collection are
placed on the same shard. To achieve this, make sure to have
[hash tags](https://redis.io/topics/cluster-tutorial#redis-cluster-data-sharding)
in collection names:

```ts
const collection = '{my-collection}';

await getAll(redis, collection);
```

## API

Every operation returns a promise that resolves to an object containing
`revision` string property, which is the collection revision after the operation
is applied.

Every write operation has `maxlen` integer argument that specifies how much
entries in the Stream of changes we want to retain. If you do high rate writes,
the default of `1000` may be too small for [`watch`](#watch) to catch up. See
[Redis docs](https://redis.io/commands/xadd#capped-streams).

### get

```ts
function get(
  redis: IORedis.Redis,
  collection: string,
  key: string | Buffer,
): Promise<{
  revision: string;
  value: Buffer | null;
  version: number;
}>;
```

Get a value of a single key. If the key does not exist, returned `value` is
`null` and `version` is `0`.

`get` can be used with [Pipelining](#pipelining).

### getAll

```ts
function getAll(
  redis: IORedis.Redis,
  collection: string,
): Promise<{
  revision: string;
  items: Array<{
    key: Buffer;
    version: number;
    value: Buffer;
  }>;
}>;
```

Get all key-value pairs.

### getKeyRange

```ts
function getKeyRange(
  redis: IORedis.Redis,
  collection: string,
  min: string | Buffer,
  max: string | Buffer,
): Promise<{
  revision: string;
  items: Array<{
    key: Buffer;
    version: number;
    value: Buffer;
  }>;
}>;
```

Get all key-value pairs with keys lexicographically sorted between `min` and
`max`. See
[Redis docs](https://redis.io/commands/zrangebylex#how-to-specify-intervals) on
how to specify intervals. Use [`makePrefixRange`](#makeprefixrange) to get all
keys starting with a prefix.

`getKeyRange` can be used with [Pipelining](#pipelining).

Example:

```ts
// get keys from `a` (inclusive) to `z` (exclusive)
await getKeyRange(redis, 'my-collection', '[a', '(z');

// get all keys from `z` (inclusive) onwards
await getKeyRange(redis, 'my-collection', '[z', '+');
```

### getVersionRange

```ts
function getVersionRange(
  redis: IORedis.Redis,
  collection: string,
  min: number | string,
  max: number | string,
): Promise<{
  revision: string;
  items: Array<{
    key: Buffer;
    version: number;
    value: Buffer;
  }>;
}>;
```

Get all key-value pairs with version between `min` and `max` (inclusive).
`Infinity` is allowed. See
[Redis docs](https://redis.io/commands/zrangebyscore#exclusive-intervals-and-infinity)
on how to specify exclusive intervals.

`getVersionRange` can be used with [Pipelining](#pipelining).

### watch

```ts
function watch(
  redis: IORedis.Redis,
  collection: string,
  lastRevision: string,
  blockMs: number = 2500,
): Observable<ChangeEvent[]>;
```

Return RxJS Observable that emits changes to a collection happening after
`lastRevision`. Changes are emitted as arrays of events of the following shape:

```ts
type ChangeEvent = SetEvent | RemoveEvent;

type SetEvent = {
  type: 'set';
  revision: string;
  key: Buffer;
  version: number;
  value: Buffer;
};

type RemoveEvent = {
  type: 'remove';
  revision: string;
  key: Buffer;
};
```

Example:

```ts
// observable that emits the whole collection as a Map on each change
const collectionObservable = defer(() => getAll(redis, 'my-collection')).pipe(
  concatMap(({items, revision}) => {
    const initialState = new Map();

    for (const {key, value, version} of items) {
      initialState.set(key.toString(), {value, version});
    }

    return concat(
      of(initialState),
      watch(redis, 'my-collection', revision).pipe(
        scan((state, changes) => {
          const nextState = new Map(state);

          for (const event of changes) {
            if (event.type === 'set') {
              const {value, version} = event;

              nextState.set(event.key.toString(), {value, version});
            } else if (event.type === 'remove') {
              nextState.delete(event.key.toString());
            }
          }

          return nextState;
        }, initialState),
      ),
    );
  }),
);
```

### set

```ts
function set(
  redis: IORedis.Redis,
  collection: string,
  key: string | Buffer,
  value: Buffer,
  version: number = Infinity,
  maxlen: number = 1000,
): Promise<{
  revision: string;
}>;
```

Update the key-value pair, overwriting previous value, if any. See [API](#api)
for details on `maxlen` argument.

`set` can be used with [Pipelining](#pipelining).

### compareAndSet

```ts
function compareAndSet(
  redis: IORedis.Redis,
  collection: string,
  key: string | Buffer,
  compareOperator: '<' | '<=' | '==' | '!=' | '>=' | '>',
  compareVersion: number,
  value: Buffer,
  version: number = Infinity,
  maxlen: number = 1000,
): Promise<{
  revision: string;
  success: boolean;
}>;
```

Update the key-value pair only if a comparison condition holds on the previous
version of the pair. If a previous value does not exist, its version is
considered to be `0`. See [API](#api) for details on `maxlen` argument.

`compareAndSet` can be used with [Pipelining](#pipelining).

Example:

```ts
// only update if previous version is older
const newVersion = Date.now();
await compareAndSet(
  redis,
  'my-collection',
  'some-key',
  '<',
  newVersion,
  Buffer.from('payload'),
  newVersion,
);

// only update if the key does not exist
await compareAndSet(
  redis,
  'my-collection',
  'some-key',
  '==',
  0,
  Buffer.from('payload'),
);
```

### remove

```ts
function remove(
  redis: IORedis.Redis,
  collection: string,
  key: string | Buffer,
  maxlen: number = 1000,
): Promise<{
  revision: string;
}>;
```

Delete the key-value pair, if it exists. See [API](#api) for details on `maxlen`
argument.

`remove` can be used with [Pipelining](#pipelining).

### compareAndRemove

```ts
function compareAndRemove(
  redis: IORedis.Redis,
  collection: string,
  key: string | Buffer,
  compareOperator: '<' | '<=' | '==' | '!=' | '>=' | '>',
  compareVersion: number,
  maxlen: number = 1000,
): Promise<{
  revision: string;
  success: boolean;
}>;
```

Delete the key-value pair only if a comparison condition holds on the previous
version of the pair. If a previous value does not exist, its version is
considered to be `0`. See [API](#api) for details on `maxlen` argument.

`compareAndRemove` can be used with [Pipelining](#pipelining).

### removeKeyRange

```ts
function removeKeyRange(
  redis: IORedis.Redis,
  collection: string,
  min: string | Buffer,
  max: string | Buffer,
  maxlen: number = 1000,
): Promise<{
  revision: string;
  removedCount: number;
}>;
```

Delete all key-value pairs with keys lexicographically sorted between `min` and
`max`. See
[Redis docs](https://redis.io/commands/zrangebylex#how-to-specify-intervals) on
how to specify intervals. Use [`makePrefixRange`](#makeprefixrange) to delete
all keys starting with a prefix. See [API](#api) for details on `maxlen`
argument.

`removeKeyRange` can be used with [Pipelining](#pipelining).

### removeVersionRange

```ts
function removeVersionRange(
  redis: IORedis.Redis,
  collection: string,
  min: number | string,
  max: number | string,
  maxlen: number = 1000,
): Promise<{
  revision: string;
  removedCount: number;
}>;
```

Delete all key-value pairs with version between `min` and `max` (inclusive).
`Infinity` is allowed. See
[Redis docs](https://redis.io/commands/zrangebyscore#exclusive-intervals-and-infinity)
on how to specify exclusive intervals. See [API](#api) for details on `maxlen`
argument.

`removeVersionRange` can be used with [Pipelining](#pipelining).

### makePrefixRange

```ts
function makePrefixRange(prefix: string | Buffer): [Buffer, Buffer];
```

Make a `[min, max]` range of all keys starting with a prefix. Useful with
[`getKeyRange`](#getkeyrange) and [`removeKeyRange`](#removekeyrange)
operations:

```ts
const [min, max] = makePrefixRange('prefix:');

await getKeyRange(redis, 'my-collection', min, max);
await removeKeyRange(redis, 'my-collection', min, max);
```

### initCommands

```ts
function initCommands(redis: IORedis.Redis): void;
```

Enable collection operations on `ioredis` instance by defining Lua commands.
