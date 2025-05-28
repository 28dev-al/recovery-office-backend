/**
 * Database configuration and connection setup
 * Handles MongoDB connection using Mongoose
 */
const mongoose = require('mongoose');
const { MongoClient, ServerApiVersion } = require('mongodb');

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.client = null;
  }

  async connect() {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    console.log('🔄 Attempting to connect to MongoDB Atlas...');
    console.log('📍 Database:', process.env.DATABASE_NAME || 'recovery-office');
    console.log('🏢 Cluster: cluster0.jk9gqg.mongodb.net');

    // Mongoose connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.MONGODB_OPTIONS_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_OPTIONS_SERVER_SELECTION_TIMEOUT_MS) || 5000,
      socketTimeoutMS: parseInt(process.env.MONGODB_OPTIONS_SOCKET_TIMEOUT_MS) || 45000
    };

    try {
      // Connect using Mongoose
      await mongoose.connect(mongoUri, options);
      
      this.isConnected = true;
      console.log('✅ MongoDB Atlas connection established successfully');
      console.log(`🏢 Connected to: ${mongoose.connection.host}`);
      console.log(`📊 Database: ${mongoose.connection.name}`);
      
      // Test the connection with a ping
      await this.pingDatabase();
      
      return mongoose.connection;
    } catch (error) {
      this.isConnected = false;
      console.error('❌ MongoDB connection failed:', error.message);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`🔄 Retrying connection (${this.retryCount}/${this.maxRetries}) in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.connect();
      } else {
        throw new Error(`Failed to connect to MongoDB after ${this.maxRetries} attempts: ${error.message}`);
      }
    }
  }

  async pingDatabase() {
    try {
      // Create a separate MongoClient for ping test
      const client = new MongoClient(process.env.MONGODB_URI, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        }
      });

      await client.connect();
      await client.db("admin").command({ ping: 1 });
      console.log("✅ Database ping successful - MongoDB Atlas is responsive");
      await client.close();
    } catch (error) {
      console.warn('⚠️ Database ping failed:', error.message);
    }
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('📴 MongoDB connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error.message);
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      retryCount: this.retryCount
    };
  }
}

// Create singleton instance
const databaseConnection = new DatabaseConnection();

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('📴 Mongoose disconnected from MongoDB Atlas');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed due to application termination');
  process.exit(0);
});

// Export the singleton instance and legacy functions for compatibility
module.exports = databaseConnection;

// Also export legacy functions for backward compatibility
module.exports.connectDB = () => databaseConnection.connect();
module.exports.disconnectDB = () => databaseConnection.disconnect(); 