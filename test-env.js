require('dotenv').config();

console.log('🔍 Environment Variables Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
console.log('DATABASE_NAME:', process.env.DATABASE_NAME);
console.log('PORT:', process.env.PORT);

// List all environment variables that start with MONGODB
console.log('\n📋 All MONGODB variables:');
Object.keys(process.env)
  .filter(key => key.startsWith('MONGODB'))
  .forEach(key => {
    console.log(`${key}:`, process.env[key] ? 'SET' : 'NOT SET');
  });

// Test manual setting
console.log('\n🧪 Testing manual environment variable setting:');
process.env.TEST_VAR = 'test_value';
console.log('TEST_VAR:', process.env.TEST_VAR); 