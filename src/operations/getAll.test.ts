import IORedis = require('ioredis');
import {nanoid} from 'nanoid/async';
import {getAll} from './getAll';
import {set} from './set';
import {initCommands} from '../initCommands';

let redis: IORedis.Redis;

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

test('get all', async () => {
  const collection = 'test-collection';
  expect(await getAll(redis, collection)).toMatchInlineSnapshot(`
    Object {
      "items": Array [],
      "revision": "0-0",
    }
  `);

  const setResult1 = await set(
    redis,
    collection,
    'key-1',
    Buffer.from([42]),
    123,
  );
  const result1 = await getAll(redis, collection);

  expect(result1.revision).toEqual(setResult1.revision);
  expect(result1.items.map((item) => ({...item, key: item.key.toString()})))
    .toMatchInlineSnapshot(`
    Array [
      Object {
        "key": "key-1",
        "value": Object {
          "data": Array [
            42,
          ],
          "type": "Buffer",
        },
        "version": 123,
      },
    ]
  `);

  const setResult2 = await set(
    redis,
    collection,
    'key-2',
    Buffer.from([123]),
    42,
  );
  const result2 = await getAll(redis, collection);

  expect(result2.revision).toEqual(setResult2.revision);
  expect(result2.items.map((item) => ({...item, key: item.key.toString()})))
    .toMatchInlineSnapshot(`
    Array [
      Object {
        "key": "key-2",
        "value": Object {
          "data": Array [
            123,
          ],
          "type": "Buffer",
        },
        "version": 42,
      },
      Object {
        "key": "key-1",
        "value": Object {
          "data": Array [
            42,
          ],
          "type": "Buffer",
        },
        "version": 123,
      },
    ]
  `);
});
