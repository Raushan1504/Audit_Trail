const mongoose = require('mongoose');
const Event = require('../models/Event');
const { seedDefaultEvents } = require('./seedEvents');

const LOCAL_URI = 'mongodb://127.0.0.1:27017/audit-trail';

const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI;

  if (primaryUri) {
    try {
      console.log(`Connecting to primary MongoDB URI...`);
      const conn = await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 30000
      });
      console.log(`✓ MongoDB connected successfully to host: ${conn.connection.host}`);
      await Event.ensureIndexes();
      await seedDefaultEvents();
      return conn;
    } catch (primaryError) {
      console.warn(`Primary MongoDB connection failed (${primaryError.message}). Attempting local fallback...`);
    }
  }

  try {
    const conn = await mongoose.connect(LOCAL_URI, {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`✓ Connected to local MongoDB instance: ${conn.connection.host}`);
    await Event.ensureIndexes();
    await seedDefaultEvents();
    return conn;
  } catch (localError) {
    console.error(`Local MongoDB connection also failed: ${localError.message}`);
    throw localError;
  }
};

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
