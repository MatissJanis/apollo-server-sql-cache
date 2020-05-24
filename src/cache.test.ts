import { Connection } from 'mysql';

import { SqlCache, SqlCacheOptions } from './cache';

jest.mock('mysql');

class MockConnection {
  public results;
  public error;

  public query = jest.fn((a, b, callback) =>
    callback(this.error, this.results),
  );
}

describe('SqlCache', () => {
  let cache: SqlCache;
  let client: MockConnection;
  let defaultConfig: SqlCacheOptions;

  beforeEach(() => {
    client = new MockConnection();
    defaultConfig = {
      client: (client as unknown) as Connection,
      databaseName: 'cache',
    };
    cache = new SqlCache(defaultConfig);
  });

  describe('constructor', () => {
    test.each([
      { client: true }, // missing `databaseName`
      { databaseName: 'test' }, // missing `client`
      {}, // no configuration
      undefined, // no configuration
    ])('fails initializing with: %j', (config: any) => {
      expect(() => {
        new SqlCache(config);
      }).toThrowError();
    });

    test('initializes with custom `databaseName`', async () => {
      cache = new SqlCache({
        ...defaultConfig,
        databaseName: 'test',
      });

      await cache.delete('key');

      expect(client.query).toBeCalledWith(
        expect.stringMatching(/test.cache as cacheTable/),
        expect.anything(),
        expect.anything(),
      );
    });

    test('initializes with custom `tableName`', async () => {
      cache = new SqlCache({
        ...defaultConfig,
        tableName: 'test_table',
      });

      await cache.delete('key');

      expect(client.query).toBeCalledWith(
        expect.stringMatching(/cache.test_table as cacheTable/),
        expect.anything(),
        expect.anything(),
      );
    });

    test('initializes with custom `deleteExpiredItems`', async () => {
      cache = new SqlCache({
        ...defaultConfig,
        deleteExpiredItems: false,
      });
      const key = 'key-123';
      const value = JSON.stringify({ cached: 'value' });
      const results = [
        {
          key,
          value,
          expiry_ts: 0,
        },
      ];
      client.results = results;

      await cache.get(key);

      expect(client.query).not.toBeCalledWith(
        expect.stringMatching(/^DELETE FROM /),
        expect.anything(),
        expect.anything(),
      );
    });

    test('initializes with default values', async () => {
      const key = 'key-123';
      const value = JSON.stringify({ cached: 'value' });
      const results = [
        {
          key,
          value,
          expiry_ts: 0,
        },
      ];
      client.results = results;

      await cache.get(key);

      expect(client.query).toBeCalledWith(
        expect.stringMatching(/^DELETE FROM cache/),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('.get', () => {
    test('retrieves an item from the cache when it finds something', async () => {
      const value = JSON.stringify({ cached: 'value' });
      const results = [
        {
          key: 'key-123',
          value,
          expiry_ts: 9999999999999,
        },
      ];
      client.results = results;

      const output = await cache.get('key-123');

      expect(output).toEqual(value);
    });

    describe('returns nothing when item', () => {
      test('is not in cache', async () => {
        const output = await cache.get('key-123');

        expect(output).toBeUndefined();
      });

      test('is in cache, but is outdated', async () => {
        const value = JSON.stringify({ cached: 'value' });
        const results = [
          {
            key: 'key-123',
            value,
            expiry_ts: 0,
          },
        ];
        client.results = results;

        const output = await cache.get('key-123');

        expect(output).toBeUndefined();
      });
    });

    test('deletes an outdated cache item when `deleteExpiredItems` is turned on', async () => {
      cache = new SqlCache({
        ...defaultConfig,
        deleteExpiredItems: true,
      });
      const key = 'key-123';
      const value = JSON.stringify({ cached: 'value' });
      const results = [
        {
          key,
          value,
          expiry_ts: 0,
        },
      ];
      client.results = results;

      await cache.get(key);

      expect(client.query).toBeCalledWith(
        expect.stringMatching(/^DELETE FROM /),
        expect.arrayContaining([key]),
        expect.anything(),
      );
    });

    test('does not delete an outdated cache item when `deleteExpiredItems` is turned off', async () => {
      cache = new SqlCache({
        ...defaultConfig,
        deleteExpiredItems: false,
      });
      const key = 'key-123';
      const value = JSON.stringify({ cached: 'value' });
      const results = [
        {
          key,
          value,
          expiry_ts: 0,
        },
      ];
      client.results = results;

      await cache.get(key);

      expect(client.query).not.toBeCalledWith(
        expect.stringMatching(/^DELETE FROM /),
        expect.anything(),
        expect.anything(),
      );
    });

    test('rejects the promise when query fails', () => {
      client.error = true;

      expect(cache.get('key-123')).rejects.toBeTruthy();
    });
  });

  describe('.set', () => {
    test('writes an item to the cache with default TTL', async () => {
      const value = JSON.stringify({ cached: 'value' });

      await cache.set('key-123', value);

      expect(client.query).toBeCalledWith(
        expect.stringMatching(/^INSERT INTO /),
        expect.objectContaining({
          ttl: expect.any(Number),
        }),
        expect.anything(),
      );
    });

    test('writes an item to the cache with custom TTL', async () => {
      const value = JSON.stringify({ cached: 'value' });

      await cache.set('key-123', value, { ttl: 900 });

      expect(client.query).toBeCalledWith(
        expect.stringMatching(/^INSERT INTO /),
        expect.objectContaining({
          ttl: 900,
        }),
        expect.anything(),
      );
    });

    test('rejects the promise when query fails', () => {
      client.error = true;

      expect(cache.set('key-123', '{}')).rejects.toBeTruthy();
    });
  });

  describe('.delete', () => {
    test('deletes a cache item', async () => {
      const key = 'key-123';

      const output = await cache.delete(key);

      expect(output).toBeTruthy();
      expect(client.query).toBeCalledWith(
        expect.stringMatching(/^DELETE FROM /),
        expect.arrayContaining([key]),
        expect.anything(),
      );
    });

    test('rejects the promise when query fails', () => {
      client.error = true;

      expect(cache.delete('key-123')).rejects.toBeTruthy();
    });
  });
});
