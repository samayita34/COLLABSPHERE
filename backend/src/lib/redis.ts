import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

export const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 3) {
                // Stop retrying after 3 attempts if Redis isn't running
                return new Error("Redis connection retries exhausted");
            }
            return 1000; // Retry after 1 second
        }
    }
});

redisClient.on("error", (err) => {
    if (err.code !== 'ECONNREFUSED') {
        console.error("Redis Client Error:", err.message || err);
    }
});

export const connectRedis = async () => {
    if (!redisClient.isOpen) {
        try {
            await redisClient.connect();
            console.log("Connected to Redis successfully!");
        } catch (err) {
            console.log("Redis not available on localhost:6379. Caching will be disabled.");
        }
    }
};

