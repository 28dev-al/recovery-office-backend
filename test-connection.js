require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

async function testNewCredentials() {
  console.log('🔐 Testing New MongoDB Atlas Credentials...');
  console.log('===========================================');
  
  console.log('📋 Connection Details:');
  console.log('👤 Username: newdev28');
  console.log('🔑 Password: OijCo648dGk1AD6P');
  console.log('🏢 Cluster: cluster0.jk9gqg.mongodb.net');
  console.log('💾 Database: recovery-office');
  
  const uri = "mongodb+srv://newdev28:OijCo648dGk1AD6P@cluster0.jk9gqg.mongodb.net/recovery-office?retryWrites=true&w=majority&appName=Cluster0";
  
  try {
    console.log('\n🔄 Attempting connection...');
    
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000
    });

    // Connect to MongoDB
    await client.connect();
    console.log('✅ Connection successful!');
    
    // Test admin ping
    await client.db("admin").command({ ping: 1 });
    console.log('📡 Admin ping successful');
    
    // Test recovery-office database
    const db = client.db('recovery-office');
    console.log('💾 Connected to recovery-office database');
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`📋 Found ${collections.length} collections:`, collections.map(c => c.name));
    
    // Test write operation
    console.log('✍️ Testing write operation...');
    const testCollection = db.collection('connection-test');
    const testDoc = { 
      test: true, 
      timestamp: new Date(),
      credentials: 'newdev28',
      message: 'Recovery Office connection test successful'
    };
    
    const result = await testCollection.insertOne(testDoc);
    console.log(`✅ Write test successful. Document ID: ${result.insertedId}`);
    
    // Clean up test document
    await testCollection.deleteOne({ _id: result.insertedId });
    console.log('🧹 Test document cleaned up');
    
    // Test collections creation
    console.log('🏗️ Testing collections structure...');
    const collectionsNeeded = ['services', 'clients', 'bookings', 'availability'];
    
    for (const collName of collectionsNeeded) {
      const collExists = collections.find(c => c.name === collName);
      if (!collExists) {
        await db.createCollection(collName);
        console.log(`✅ Created collection: ${collName}`);
      } else {
        console.log(`ℹ️ Collection already exists: ${collName}`);
      }
    }
    
    await client.close();
    console.log('\n🎉 ALL TESTS PASSED - NEW CREDENTIALS WORKING PERFECTLY!');
    console.log('✅ MongoDB Atlas connection established');
    console.log('✅ Database operations working');
    console.log('✅ Collections ready for Recovery Office');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error('Error Code:', error.code);
    console.error('Error Name:', error.codeName || error.name);
    console.error('Error Message:', error.message);
    
    if (error.code === 18) {
      console.error('\n🔧 AUTHENTICATION ERROR - Possible solutions:');
      console.error('1. Verify username: newdev28');
      console.error('2. Verify password: OijCo648dGk1AD6P');
      console.error('3. Check Database Access in MongoDB Atlas');
      console.error('4. Ensure user has "Read and write to any database" privileges');
    }
    
    if (error.message.includes('IP')) {
      console.error('\n🌐 NETWORK ACCESS ERROR - Possible solutions:');
      console.error('1. Wait for 0.0.0.0/0 to become Active (currently Pending)');
      console.error('2. Add your current IP to Network Access');
      console.error('3. Check if IP whitelist is configured correctly');
    }
  }
}

testNewCredentials();
