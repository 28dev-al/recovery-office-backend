/**
 * Seed Admin User
 * 
 * This script creates an initial admin user for the system.
 * Run with: node src/scripts/seedAdmin.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

// Load environment variables
dotenv.config({ path: './.env' });

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/recovery-office')
  .then(() => console.log('MongoDB connected for admin user seeding...'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Default admin user config
const defaultAdmin = {
  firstName: 'Admin',
  lastName: 'User',
  email: process.env.ADMIN_EMAIL || 'admin@recovery-office.com',
  password: process.env.ADMIN_PASSWORD || 'ChangeMeImmediately!2023',
  role: 'admin',
  isActive: true
};

// Function to seed admin user
const seedAdminUser = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: defaultAdmin.email });
    
    if (existingAdmin) {
      console.log(`Admin user already exists with email ${defaultAdmin.email}`);
      process.exit(0);
    }
    
    // Create admin user
    const adminUser = await User.create(defaultAdmin);
    
    console.log(`Admin user created successfully:
Email: ${adminUser.email}
Password: ${process.env.ADMIN_PASSWORD || 'ChangeMeImmediately!2023'} (please change on first login)
`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin user:', err);
    process.exit(1);
  }
};

// Run the seed function
seedAdminUser(); 