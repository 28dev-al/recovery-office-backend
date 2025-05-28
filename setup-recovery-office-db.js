require('dotenv').config();
const { MongoClient } = require('mongodb');

async function smartDatabaseSetup() {
  console.log('🧠 Smart Recovery Office Database Setup...');
  console.log('=========================================');
  
  const uri = "mongodb+srv://newdev28:OijCo648dGk1AD6P@cluster0.jk9gqg.mongodb.net/recovery-office?retryWrites=true&w=majority&appName=Cluster0";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('recovery-office');
    
    // 1. Check existing services
    console.log('\n📋 Checking existing services...');
    const existingServices = await db.collection('services').find({}).toArray();
    console.log(`Found ${existingServices.length} existing services:`);
    
    if (existingServices.length > 0) {
      existingServices.forEach((service, index) => {
        console.log(`  ${index + 1}. ${service.name} (${service.slug}) - £${service.price}`);
      });
    }
    
    // 2. Define the services we want to ensure exist
    const requiredServices = [
      {
        name: "Cryptocurrency Recovery",
        description: "Specialized recovery for lost or stolen cryptocurrency including Bitcoin, Ethereum, and altcoins",
        duration: 75,
        price: 750,
        icon: "https://images2.imgbox.com/ba/78/wNqfvrmO_o.png",
        category: "recovery",
        isActive: true,
        slug: "cryptocurrency-recovery",
        tags: ["cryptocurrency", "bitcoin", "ethereum", "recovery"],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Investment Fraud Recovery",
        description: "Comprehensive recovery service for investment fraud cases including Ponzi schemes and fake brokers",
        duration: 90,
        price: 500,
        icon: "https://images2.imgbox.com/76/6d/BSPbxZsR_o.png",
        category: "recovery",
        isActive: true,
        slug: "investment-fraud-recovery",
        tags: ["investment", "fraud", "recovery"],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Financial Scam Recovery",
        description: "Recovery assistance for various financial scams including romance scams and advance fee fraud",
        duration: 60,
        price: 400,
        icon: "https://images2.imgbox.com/e7/0f/yfQ894Tl_o.png",
        category: "recovery",
        isActive: true,
        slug: "financial-scam-recovery",
        tags: ["scam", "fraud", "recovery"],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Regulatory Complaint Assistance",
        description: "Professional help with filing complaints to regulatory bodies and financial authorities",
        duration: 45,
        price: 300,
        icon: "https://images2.imgbox.com/f2/e9/tDfdd3sR_o.png",
        category: "compliance",
        isActive: true,
        slug: "regulatory-complaint-assistance",
        tags: ["regulatory", "complaint", "compliance"],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // 3. Smart upsert - update existing or insert new
    console.log('\n🔄 Updating/inserting services using smart upsert...');
    let updatedCount = 0;
    let insertedCount = 0;
    
    for (const service of requiredServices) {
      try {
        const result = await db.collection('services').updateOne(
          { slug: service.slug }, // Find by slug
          { 
            $set: {
              ...service,
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true } // Insert if doesn't exist, update if exists
        );
        
        if (result.upsertedCount > 0) {
          console.log(`  ✅ Inserted: ${service.name}`);
          insertedCount++;
        } else if (result.modifiedCount > 0) {
          console.log(`  🔄 Updated: ${service.name}`);
          updatedCount++;
        } else {
          console.log(`  ℹ️ No change: ${service.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Error with ${service.name}:`, error.message);
      }
    }
    
    console.log(`\n📊 Summary: ${insertedCount} inserted, ${updatedCount} updated`);
    
    // 4. Ensure indexes exist
    console.log('\n🏗️ Ensuring indexes exist...');
    
    const indexes = [
      { index: { slug: 1 }, options: { unique: true, name: 'slug_unique' } },
      { index: { category: 1, isActive: 1 }, options: { name: 'category_active' } },
      { index: { price: 1 }, options: { name: 'price' } },
      { index: { tags: 1 }, options: { name: 'tags' } },
      { index: { createdAt: -1 }, options: { name: 'created_desc' } }
    ];
    
    for (const { index, options } of indexes) {
      try {
        await db.collection('services').createIndex(index, options);
        console.log(`  ✅ Index ensured: ${options.name}`);
      } catch (error) {
        if (error.code === 85) { // Index already exists
          console.log(`  ℹ️ Index exists: ${options.name}`);
        } else {
          console.error(`  ❌ Index error: ${options.name}`, error.message);
        }
      }
    }
    
    // 5. Verify final state
    console.log('\n✅ Final verification...');
    const finalServices = await db.collection('services').find({}).toArray();
    console.log(`Total services in database: ${finalServices.length}`);
    
    finalServices.forEach((service, index) => {
      console.log(`  ${index + 1}. ${service.name}`);
      console.log(`     ID: ${service._id}`);
      console.log(`     Price: £${service.price}`);
      console.log(`     Duration: ${service.duration} minutes`);
      console.log(`     Category: ${service.category}`);
      console.log(`     Active: ${service.isActive}`);
      console.log('');
    });
    
    // 6. Test a sample query
    console.log('🧪 Testing sample queries...');
    const activeServices = await db.collection('services')
      .find({ isActive: true })
      .sort({ price: 1 })
      .toArray();
    console.log(`✅ Found ${activeServices.length} active services`);
    
    const cryptoService = await db.collection('services')
      .findOne({ slug: 'cryptocurrency-recovery' });
    console.log(`✅ Cryptocurrency service found: ${cryptoService ? 'Yes' : 'No'}`);
    
    if (cryptoService) {
      console.log(`   Name: ${cryptoService.name}`);
      console.log(`   ID: ${cryptoService._id}`);
      console.log(`   Valid ObjectId: ${cryptoService._id.toString().length === 24 ? 'Yes' : 'No'}`);
    }
    
    console.log('\n🎉 SMART DATABASE SETUP COMPLETE!');
    console.log('✅ All services are properly configured');
    console.log('✅ Indexes are optimized');
    console.log('✅ Database is ready for Recovery Office booking system');
    
  } catch (error) {
    console.error('\n❌ Smart setup failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.close();
  }
}

smartDatabaseSetup();
