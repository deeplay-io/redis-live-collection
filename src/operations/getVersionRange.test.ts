import IORedis = require('ioredis');
import {nanoid} from 'nanoid/async';
import {initCommands} from '../initCommands';
import {getVersionRange, GetVersionRangeResult} from './getVersionRange';
import {set} from './set';

let redis: IORedis.Redis;
const collection = 'test-collection';

beforeEach(async () => {
  redis = new IORedis({
    keyPrefix: await nanoid(),
    lazyConnect: true,
  });
  initCommands(redis);
  await redis.connect();
});

afterEach(async () => {
  await redis.quit();
});

test('getVersionRange', async () => {
  await set(redis, collection, 'key-1', Buffer.from([3]), -Infinity);
  await set(redis, collection, 'key-2', Buffer.from([2]), 0);
  const {revision} = await set(
    redis,
    collection,
    'key-3',
    Buffer.from([1]),
    Infinity,
  );

  const result1 = await getVersionRange(redis, collection, -Infinity, Infinity);
  expect(result1.revision).toEqual(revision);

  expect(result1.items.map((item) => ({...item, key: item.key.toString()})))
    .toMatchInlineSnapshot(`
    Array [
      Object {
        "key": "key-1",
        "value": Object {
          "data": Array [
            3,
          ],
          "type": "Buffer",
        },
        "version": -Infinity,
      },
      Object {
        "key": "key-2",
        "value": Object {
          "data": Array [
            2,
          ],
          "type": "Buffer",
        },
        "version": 0,
      },
      Object {
        "key": "key-3",
        "value": Object {
          "data": Array [
            1,
          ],
          "type": "Buffer",
        },
        "version": Infinity,
      },
    ]
  `);

  const getKeys = (result: GetVersionRangeResult) =>
    result.items.map((item) => item.key.toString());

  expect(getKeys(await getVersionRange(redis, collection, -Infinity, 0)))
    .toMatchInlineSnapshot(`
    Array [
      "key-1",
      "key-2",
    ]
  `);
  expect(getKeys(await getVersionRange(redis, collection, '(-inf', 0)))
    .toMatchInlineSnapshot(`
    Array [
      "key-2",
    ]
  `);
  expect(getKeys(await getVersionRange(redis, collection, -Infinity, '(0')))
    .toMatchInlineSnapshot(`
    Array [
      "key-1",
    ]
  `);
  expect(
    getKeys(await getVersionRange(redis, collection, 0, '(0')),
  ).toMatchInlineSnapshot(`Array []`);
  expect(getKeys(await getVersionRange(redis, collection, 0, 0)))
    .toMatchInlineSnapshot(`
    Array [
      "key-2",
    ]
  `);
  expect(getKeys(await getVersionRange(redis, collection, Infinity, Infinity)))
    .toMatchInlineSnapshot(`
    Array [
      "key-3",
    ]
  `);
});
