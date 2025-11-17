
import { config } from '@gigs/config';
import { AppLogger } from '@gigs/utils/logger';
import { RedisClient } from '@hiep20012003/joblance-shared';

export class CacheStore extends RedisClient {
  getUserSelectedGigCategory = async (key: string) => {
    return await this.get(key);
  };
}

export const cacheStore = new CacheStore(config.REDIS_URL, AppLogger);
