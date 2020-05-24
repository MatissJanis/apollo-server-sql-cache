import {
  KeyValueCacheSetOptions,
  TestableKeyValueCache,
} from 'apollo-server-caching';
import { Connection } from 'mysql';

export interface SqlCacheOptions {
  client: Connection;
  databaseName: string;
  tableName?: string;
  deleteExpiredItems?: boolean;
}

export class SqlCache implements TestableKeyValueCache<string> {
  protected client: Connection;
  protected databaseName: string;
  protected tableName: string = 'cache';
  protected deleteExpiredItems: boolean = true;
  protected readonly defaultSetOptions: KeyValueCacheSetOptions = {
    ttl: 300,
  };

  constructor(options: SqlCacheOptions) {
    if (!options) {
      throw new Error(
        'configuration object with `client` and `databaseName` must be set when initializing SqlCache',
      );
    }
    if (!options.client) {
      throw new Error('`client` must be set when initializing SqlCache');
    }
    if (!options.databaseName) {
      throw new Error('`databaseName` must be set when initializing SqlCache');
    }

    this.client = options.client;
    this.databaseName = options.databaseName;

    if (options.tableName) {
      this.tableName = options.tableName;
    }

    if (options.deleteExpiredItems !== undefined) {
      this.deleteExpiredItems = options.deleteExpiredItems;
    }
  }

  /**
   * Retrieve an item from the cache.
   */
  async get(key: string): Promise<string | undefined> {
    const data = await this.promisifyQuery<
      { key: string; value: string; expiry_ts: number }[]
    >(
      `
      SELECT
        value,
        (ttl + UNIX_TIMESTAMP(created_at)) as expiry_ts
      FROM ${this.databaseName}.${this.tableName} as cacheTable
      WHERE cacheTable.key = ?
      `,
      [key],
    );

    if (data && data.length) {
      const row = data[0];

      // Delete expired cache items
      if (this.deleteExpiredItems && Date.now() >= row.expiry_ts * 1000) {
        await this.delete(key);
        return;
      }

      // Return cached item
      return row.value;
    }
  }

  /**
   * Put a new item in the cache.
   */
  async set(
    key: string,
    value: string,
    options: KeyValueCacheSetOptions = {},
  ): Promise<void> {
    const { ttl } = { ...this.defaultSetOptions, ...options };
    await this.promisifyQuery(
      `INSERT INTO ${this.databaseName}.${this.tableName} SET ?`,
      {
        key,
        value,
        ttl,
      },
    );
  }

  /**
   * Delete a cached item
   */
  async delete(key: string): Promise<boolean> {
    await this.promisifyQuery(
      `DELETE FROM ${this.databaseName}.${this.tableName} as cacheTable WHERE cacheTable.key = ?`,
      [key],
    );

    return true;
  }

  /**
   * Convert a mysql query to a promise.
   */
  protected promisifyQuery<T>(query: string, data: any): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.client.query(query, data, (error, results: T) => {
        if (error) {
          return reject(error);
        }

        resolve(results);
      });
    });
  }
}
