import { ENV } from "../_core/env";

// In-memory fallback cache to allow smooth operations without Redis during development
class MemoryCache {
  private store = new Map<string, { value: any; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const record = this.store.get(key);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return record.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<string> {
    let expiresAt = Infinity;
    if (mode === "EX" && duration) {
      expiresAt = Date.now() + duration * 1000;
    } else if (mode === "PX" && duration) {
      expiresAt = Date.now() + duration;
    }
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async incr(key: string): Promise<number> {
    const val = await this.get(key);
    const num = val ? parseInt(val, 10) : 0;
    const next = num + 1;
    await this.set(key, next.toString());
    return next;
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    const record = this.store.get(key);
    if (!record) return -2;
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return -2;
    }
    if (record.expiresAt === Infinity) return -1;
    return Math.max(0, Math.ceil((record.expiresAt - Date.now()) / 1000));
  }
}

let redisClient: any = null;
let useMemoryFallback = true;

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL) {
  try {
    // Dynamic import to prevent startup failures if ioredis package is missing or failing during build/lint
    const Redis = require("ioredis");
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    redisClient.on("error", (err: any) => {
      console.warn("[Redis] Connection error, falling back to memory:", err.message);
      useMemoryFallback = true;
    });
    redisClient.on("connect", () => {
      console.log("[Redis] Connected successfully.");
      useMemoryFallback = false;
    });
    useMemoryFallback = false;
  } catch (e) {
    console.warn("[Redis] Failed to load ioredis library, using in-memory store instead.");
    useMemoryFallback = true;
  }
} else {
  console.log("[Redis] REDIS_URL not configured. Running in-memory cache mode.");
}

const memoryStore = new MemoryCache();

export const cache = {
  async get(key: string): Promise<string | null> {
    if (useMemoryFallback) {
      return memoryStore.get(key);
    }
    try {
      return await redisClient.get(key);
    } catch (err) {
      return memoryStore.get(key);
    }
  },

  async set(key: string, value: string, expireInSeconds?: number): Promise<void> {
    if (useMemoryFallback) {
      await memoryStore.set(key, value, expireInSeconds ? "EX" : undefined, expireInSeconds);
      return;
    }
    try {
      if (expireInSeconds) {
        await redisClient.set(key, value, "EX", expireInSeconds);
      } else {
        await redisClient.set(key, value);
      }
    } catch (err) {
      await memoryStore.set(key, value, expireInSeconds ? "EX" : undefined, expireInSeconds);
    }
  },

  async incr(key: string, expireInSeconds?: number): Promise<number> {
    if (useMemoryFallback) {
      const next = await memoryStore.incr(key);
      if (expireInSeconds && next === 1) {
        await memoryStore.set(key, next.toString(), "EX", expireInSeconds);
      }
      return next;
    }
    try {
      const next = await redisClient.incr(key);
      if (expireInSeconds && next === 1) {
        await redisClient.expire(key, expireInSeconds);
      }
      return next;
    } catch (err) {
      const next = await memoryStore.incr(key);
      if (expireInSeconds && next === 1) {
        await memoryStore.set(key, next.toString(), "EX", expireInSeconds);
      }
      return next;
    }
  },

  async del(key: string): Promise<void> {
    if (useMemoryFallback) {
      await memoryStore.del(key);
      return;
    }
    try {
      await redisClient.del(key);
    } catch (err) {
      await memoryStore.del(key);
    }
  },

  async getTtl(key: string): Promise<number> {
    if (useMemoryFallback) {
      return memoryStore.ttl(key);
    }
    try {
      return await redisClient.ttl(key);
    } catch (err) {
      return memoryStore.ttl(key);
    }
  }
};
