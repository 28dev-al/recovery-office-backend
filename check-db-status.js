require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkDatabaseStatus() {
  console.log('🔍 Recovery Office Database Status Check');
  console.log('======================================');
  
  const uri = "mongodb+srv://newdev28:OijCo648dGk1AD6P@cluster0.jk9gqg.mongodb.net/recovery-office?retryWrites=true&w=majority&appName=Cluster0";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('recovery-office');
    
    // Check all collections
    const collections = await db.listCollections().toArray();
    console.log(`\n📋 Database Collections (${collections.length}):`);
    
    for (const collection of collections) {
      const collName = collection.name;
      const count = await db.collection(collName).countDocuments();
      console.log(`  📁 ${collName}: ${count} documents`);
      
      // Show sample documents for key collections
      if (['services', 'clients', 'bookings'].includes(collName) && count > 0) {
        const sample = await db.collection(collName).findOne();
        console.log(`     Sample ID: ${sample._id}`);
        if (sample.name) console.log(`     Sample Name: ${sample.name}`);
      }
    }
    
    // Detailed services check
    console.log('\n🛠️ Services Analysis:');
    const services = await db.collection('services').find({}).toArray();
    
    if (services.length > 0) {
      console.log('Services with ObjectId validation:');
      services.forEach((service, index) => {
        const isValidObjectId = service._id.toString().length === 24;
        console.log(`  ${index + 1}. ${service.name}`);
        console.log(`     ObjectId: ${service._id} (${isValidObjectId ? 'Valid' : 'Invalid'})`);
        console.log(`     Slug: ${service.slug}`);
        console.log(`     Price: £${service.price}`);
      });
    } else {
      console.log('  No services found');
    }
    
    console.log('\n✅ Database status check complete');
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
  } finally {
    await client.close();
  }
}

checkDatabaseStatus();
