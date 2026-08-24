const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);


/**
 * Establishes a connection to the MongoDB database using the MONGODB_URI environment variable.
 * @returns {Promise<typeof mongoose>} The mongoose instance upon successful connection.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI environment variable is missing.');
    throw new Error('MONGODB_URI is not defined');
  }
  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    throw error;
  }
};
/*** 
 @returns {Promise<void>}
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
