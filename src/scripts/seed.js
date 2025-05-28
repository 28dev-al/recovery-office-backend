// backend/src/scripts/seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Service = require('../models/Service');
const TimeSlot = require('../models/TimeSlot');
const config = require('../config');
require('dotenv').config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(config.database.uri);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Service.deleteMany({});
    await TimeSlot.deleteMany({});

    console.log('Starting database seed...');

    // Create admin user with ALL required fields
    console.log('Seeding users...');
    const hashedPassword = await bcrypt.hash('Admin123!', 12);
    
    const adminUser = await User.create({
      email: 'admin@recoveryoffice.com',
      password: hashedPassword,
      firstName: 'Recovery',        // ADD this required field
      lastName: 'Admin',           // ADD this required field
      role: 'admin',
      isActive: true
    });

    console.log('✅ Admin user created successfully');

    // Create recovery services
    console.log('Seeding services...');
    const services = await Service.insertMany([
      {
        name: 'Investment Fraud Recovery',
        description: 'Comprehensive recovery service for investment fraud cases',
      duration: 90,
        price: 500,
        icon: 'https://images2.imgbox.com/76/6d/BSPbxZsR_o.png',
        isActive: true,
        category: 'recovery',
        slug: 'investment-fraud-recovery'
      },
      {
        name: 'Cryptocurrency Recovery',
        description: 'Specialized recovery for lost or stolen cryptocurrency',
        duration: 75,
        price: 750,
        icon: 'https://images2.imgbox.com/ba/78/wNqfvrmO_o.png',
        isActive: true,
        category: 'recovery',
        slug: 'cryptocurrency-recovery'
      },
      {
        name: 'Financial Scam Recovery',
        description: 'Recovery assistance for various financial scams and fraud',
      duration: 60,
        price: 400,
        icon: 'https://images2.imgbox.com/e7/0f/yfQ894Tl_o.png',
        isActive: true,
        category: 'recovery',
        slug: 'financial-scam-recovery'
      },
      {
        name: 'Regulatory Complaint Assistance',
        description: 'Help with filing complaints to regulatory bodies',
      duration: 45,
        price: 300,
        icon: 'https://images2.imgbox.com/f2/e9/tDfdd3sR_o.png',
        isActive: true,
        category: 'compliance',
        slug: 'regulatory-complaint-assistance'
      }
    ]);

    console.log('✅ Services created successfully');

    // Create time slots for the next 30 days
    console.log('Seeding time slots...');
    const timeSlots = [];
    const businessHours = [
      '09:00-10:00', '10:00-11:00', '11:00-12:00',
      '14:00-15:00', '15:00-16:00', '16:00-17:00'
    ];

    for (let i = 1; i <= 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
    
    // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      for (const service of services) {
        for (const timeSlot of businessHours) {
          timeSlots.push({
            date: date,
            slot: timeSlot,
          serviceId: service._id,
            isAvailable: true,
            capacity: 1
        });
      }
    }
  }
  
    await TimeSlot.insertMany(timeSlots);
    console.log('✅ Time slots created successfully');

    // Summary
    console.log('\n🎉 Database seeded successfully!');
    console.log(`📧 Admin user: admin@recoveryoffice.com`);
    console.log(`🔑 Password: Admin123!`);
    console.log(`📊 Created ${services.length} services`);
    console.log(`📅 Created ${timeSlots.length} time slots`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedDatabase(); 