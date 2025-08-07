const { Pool } = require('pg');
const fs = require('fs-extra');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Database setup script
async function setupDatabase() {
  let pool;
  
  try {
    console.log('🚀 Starting database setup...');

    // Create database connection
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      // Don't specify database initially
    };

    console.log(`📊 Connecting to PostgreSQL at ${dbConfig.host}:${dbConfig.port}...`);
    
    // Connect without specifying database first
    pool = new Pool(dbConfig);

    // Check if database exists, create if not
    const dbName = process.env.DB_NAME || 'media_streaming';
    console.log(`🔍 Checking if database '${dbName}' exists...`);
    
    const dbExistsResult = await pool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (dbExistsResult.rows.length === 0) {
      console.log(`📁 Creating database '${dbName}'...`);
      await pool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database '${dbName}' created successfully`);
    } else {
      console.log(`✅ Database '${dbName}' already exists`);
    }

    // Close initial connection
    await pool.end();

    // Connect to the specific database
    dbConfig.database = dbName;
    pool = new Pool(dbConfig);

    console.log('📋 Reading schema file...');
    const schemaPath = path.join(__dirname, '../sql/schema.sql');
    
    if (!await fs.pathExists(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const schema = await fs.readFile(schemaPath, 'utf8');

    console.log('🏗️  Executing database schema...');
    await pool.query(schema);
    console.log('✅ Database schema created successfully');

    // Create admin user if specified in environment
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      console.log('👤 Creating admin user...');
      await createAdminUser(pool);
    }

    console.log('🎉 Database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Install Redis server for queue management');
    console.log('2. Install yt-dlp: pip install yt-dlp');
    console.log('3. Run: npm run dev');
    console.log('4. Visit: http://localhost:3000');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting:');
      console.error('- Make sure PostgreSQL is running');
      console.error('- Check your database credentials in .env file');
      console.error('- Verify database host and port');
    }
    
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

async function createAdminUser(pool) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Check if admin user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );

    if (existingUser.rows.length > 0) {
      console.log('ℹ️  Admin user already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create admin user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, is_active, email_verified)
       VALUES ($1, $2, $3, 'admin', true, true)
       RETURNING id, username, email`,
      ['admin', adminEmail, hashedPassword]
    );

    const admin = result.rows[0];
    console.log(`✅ Admin user created: ${admin.username} (${admin.email})`);

    // Add default admin settings
    const defaultAdminSettings = [
      ['theme', 'dark', 'string'],
      ['notifications_enabled', 'true', 'boolean'],
      ['email_notifications', 'true', 'boolean']
    ];

    for (const [key, value, dataType] of defaultAdminSettings) {
      await pool.query(
        `INSERT INTO user_settings (user_id, setting_key, setting_value, data_type)
         VALUES ($1, $2, $3, $4)`,
        [admin.id, key, value, dataType]
      );
    }

    console.log('✅ Default admin settings created');

  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    throw error;
  }
}

// Check prerequisites
async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...');

  // Check if .env file exists
  if (!await fs.pathExists('.env')) {
    console.log('⚠️  .env file not found. Creating from .env.example...');
    
    if (await fs.pathExists('.env.example')) {
      await fs.copy('.env.example', '.env');
      console.log('✅ .env file created from .env.example');
      console.log('⚠️  Please edit .env file with your database credentials before running setup again');
      process.exit(0);
    } else {
      console.error('❌ .env.example file not found. Please create .env file manually.');
      process.exit(1);
    }
  }

  // Check required environment variables
  const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease update your .env file with the missing variables.');
    process.exit(1);
  }

  console.log('✅ Prerequisites check passed');
}

// Main setup function
async function main() {
  console.log('🎯 Media Streaming App - Database Setup');
  console.log('=====================================\n');

  await checkPrerequisites();
  await setupDatabase();
}

// Run setup if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}

module.exports = { setupDatabase, createAdminUser };