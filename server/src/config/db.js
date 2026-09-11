const mongoose = require('mongoose');
const dns = require('dns');

// Configure fallback DNS for environments requiring Google DNS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore if custom DNS cannot be set
}

const { seedDefaultEvents } = require('./seedEvents');

const LOCAL_URI = 'mongodb://127.0.0.1:27017/audit-trail';

/**
 * Establishes a connection to MongoDB.
 * Attempts configured MONGODB_URI first, and seamlessly falls back
 * to the local MongoDB instance if remote Atlas is unreachable (e.g. IP whitelist / network issues).
 * @returns {Promise<typeof mongoose>} The mongoose instance upon successful connection.
 */
const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI;

  // 1. Try Primary URI (Remote Atlas or configured DB)
  if (primaryUri) {
    try {
      console.log(`Connecting to primary MongoDB URI...`);
      const conn = await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 4000
      });
      console.log(`✓ MongoDB connected successfully to host: ${conn.connection.host}`);
      await seedDefaultEvents();
      return conn;
    } catch (primaryError) {
      console.warn(`Primary MongoDB connection failed (${primaryError.message}). Attempting local fallback...`);
    }
  }

  // 2. Fallback to Local MongoDB instance
  try {
    const conn = await mongoose.connect(LOCAL_URI, {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`✓ Connected to local MongoDB instance: ${conn.connection.host}`);
    await seedDefaultEvents();
    return conn;
  } catch (localError) {
    console.error(`Local MongoDB connection also failed: ${localError.message}`);
    throw localError;
  }
};

/**
 * Disconnects from MongoDB.
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected successfully');
  } catch (error) {
    console.error(`Error during MongoDB disconnection: ${error.message}`);
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB
};
