import IORedis = require('ioredis');
import {nanoid} from 'nanoid/async';
import {initCommands} from '../initCommands';
import {getKeyRange, GetKeyRangeResult} from './getKeyRange';
import {set} from './set';
import {makePrefixRange} from '../prefixRange';

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

test('getKeyRange', async () => {
  await set(redis, collection, 'key-1', Buffer.from([3]), -Infinity);
  await set(redis, collection, 'key-2', Buffer.from([2]), 0);
  const {revision} = await set(
    redis,
    collection,
    'key-3',
    Buffer.from([1]),
    Infinity,
  );

  const result1 = await getKeyRange(redis, collection, '-', '+');
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

  const getKeys = (result: GetKeyRangeResult) =>
    result.items.map((item) => item.key.toString());

  expect(getKeys(await getKeyRange(redis, collection, '[key-1', '(key-3')))
    .toMatchInlineSnapshot(`
    Array [
      "key-1",
      "key-2",
    ]
  `);
  expect(getKeys(await getKeyRange(redis, collection, '(key-1', '[key-2')))
    .toMatchInlineSnapshot(`
    Array [
      "key-2",
    ]
  `);
  expect(getKeys(await getKeyRange(redis, collection, '-', '(key-2')))
    .toMatchInlineSnapshot(`
    Array [
      "key-1",
    ]
  `);
  expect(
    getKeys(await getKeyRange(redis, collection, '[key-2', '(key-2')),
  ).toMatchInlineSnapshot(`Array []`);
  expect(getKeys(await getKeyRange(redis, collection, '[key-2', '[key-2')))
    .toMatchInlineSnapshot(`
    Array [
      "key-2",
    ]
  `);
  expect(getKeys(await getKeyRange(redis, collection, '[key-3', '+')))
    .toMatchInlineSnapshot(`
    Array [
      "key-3",
    ]
  `);
});

test('prefix', async () => {
  await set(redis, collection, 'a', Buffer.from([]));
  await set(redis, collection, 'ab', Buffer.from([]));
  await set(redis, collection, 'baa', Buffer.from([]));
  await set(redis, collection, 'bab', Buffer.from([]));
  await set(redis, collection, 'bb', Buffer.from([]));

  const getKeys = (result: GetKeyRangeResult) =>
    result.items.map((item) => item.key.toString());

  expect(getKeys(await getKeyRange(redis, collection, ...makePrefixRange('a'))))
    .toMatchInlineSnapshot(`
    Array [
      "a",
      "ab",
    ]
  `);
  expect(getKeys(await getKeyRange(redis, collection, ...makePrefixRange('b'))))
    .toMatchInlineSnapshot(`
    Array [
      "baa",
      "bab",
      "bb",
    ]
  `);
  expect(
    getKeys(await getKeyRange(redis, collection, ...makePrefixRange('ba'))),
  ).toMatchInlineSnapshot(`
    Array [
      "baa",
      "bab",
    ]
  `);
  expect(
    getKeys(await getKeyRange(redis, collection, ...makePrefixRange('baa'))),
  ).toMatchInlineSnapshot(`
    Array [
      "baa",
    ]
  `);
  expect(
    getKeys(await getKeyRange(redis, collection, ...makePrefixRange('baaa'))),
  ).toMatchInlineSnapshot(`Array []`);
});
