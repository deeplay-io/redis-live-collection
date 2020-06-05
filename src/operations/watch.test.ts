import IORedis = require('ioredis');
import {nanoid} from 'nanoid/async';
import {map, take, toArray, concatAll} from 'rxjs/operators';
import {initCommands} from '../initCommands';
import {removeKeyRange} from './removeKeyRange';
import {set} from './set';
import {watch} from './watch';

let redis: IORedis.Redis;
let watchRedis: IORedis.Redis;
const collection = 'test-collection';

beforeEach(async () => {
  const keyPrefix = await nanoid();

  redis = new IORedis({
    keyPrefix,
    lazyConnect: true,
  });
  initCommands(redis);

  watchRedis = new IORedis({
    keyPrefix,
    lazyConnect: true,
  });
  initCommands(watchRedis);

  await redis.connect();
  await watchRedis.connect();
});

afterEach(async () => {
  await redis.quit();
  await watchRedis.quit();
});

test('watch', async () => {
  const {revision} = await set(redis, collection, 'key-1', Buffer.from([]), 1);

  const eventsPromise = watch(watchRedis, collection, revision)
    .pipe(
      concatAll(),
      map((event) => {
        if (event.type === 'set') {
          return {
            type: 'set',
            key: event.key.toString(),
            version: event.version,
            value: event.value,
          };
        } else {
          return {
            type: 'remove',
            key: event.key.toString(),
          };
        }
      }),
      take(5),
      toArray(),
    )
    .toPromise();

  await new Promise((resolve) => setTimeout(resolve, 100));

  await set(redis, collection, 'key-2', Buffer.from([]), 2);
  await set(redis, collection, 'key-3', Buffer.from([]), 3);

  await removeKeyRange(redis, collection, '[key-2', '+');

  await set(redis, collection, 'key-1', Buffer.from([]), 1);

  expect(await eventsPromise).toMatchInlineSnapshot(`
    Array [
      Object {
        "key": "key-2",
        "type": "set",
        "value": Object {
          "data": Array [],
          "type": "Buffer",
        },
        "version": 2,
      },
      Object {
        "key": "key-3",
        "type": "set",
        "value": Object {
          "data": Array [],
          "type": "Buffer",
        },
        "version": 3,
      },
      Object {
        "key": "key-2",
        "type": "remove",
      },
      Object {
        "key": "key-3",
        "type": "remove",
      },
      Object {
        "key": "key-1",
        "type": "set",
        "value": Object {
          "data": Array [],
          "type": "Buffer",
        },
        "version": 1,
      },
    ]
  `);
});

test('wrong revision', async () => {
  await set(redis, collection, 'key-1', Buffer.from([]), 1);

  expect(
    watch(redis, collection, '0-1').toPromise(),
  ).rejects.toMatchInlineSnapshot(
    `[Error: Failed to continuously read change events from stream. Consider increasing \`maxlen\` parameter]`,
  );
});

test('watch empty', async () => {
  const eventsPromise = watch(watchRedis, collection, '0-0')
    .pipe(
      concatAll(),
      map((event) => {
        if (event.type === 'set') {
          return {
            type: 'set',
            key: event.key.toString(),
            version: event.version,
            value: event.value,
          };
        } else {
          return {
            type: 'remove',
            key: event.key.toString(),
          };
        }
      }),
      take(1),
      toArray(),
    )
    .toPromise();

  await new Promise((resolve) => setTimeout(resolve, 100));

  await set(redis, collection, 'key-1', Buffer.from([]), 1);

  expect(await eventsPromise).toMatchInlineSnapshot(`
    Array [
      Object {
        "key": "key-1",
        "type": "set",
        "value": Object {
          "data": Array [],
          "type": "Buffer",
        },
        "version": 1,
      },
    ]
  `);
});
