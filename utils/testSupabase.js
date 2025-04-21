import supabase from './supabase.js';
import config from '../config/config.js';

/**
 * Utility script to test Supabase connection and functionality
 */

const testSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    
    // Basic connection test
    const { data, error } = await supabase.from('profiles').select('count');
    
    if (error) {
      console.error('Connection error:', error);
      return false;
    }
    
    console.log('Supabase connection successful!');
    console.log('Supabase URL:', config.supabase.url);
    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
};

const testTableCreation = async () => {
  try {
    console.log('Testing table creation in Supabase...');
    
    // Create a test table
    const testTableName = 'test_table_' + Date.now();
    
    // Using Raw SQL query to create a table
    const { error } = await supabase.rpc('execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS ${testTableName} (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
    });
    
    if (error) {
      console.error('Error creating test table:', error);
      return false;
    }
    
    console.log(`Test table '${testTableName}' created successfully!`);
    
    // Clean up - drop the test table
    const { error: dropError } = await supabase.rpc('execute_sql', {
      query: `DROP TABLE IF EXISTS ${testTableName}`
    });
    
    if (dropError) {
      console.error('Error dropping test table:', dropError);
    } else {
      console.log(`Test table '${testTableName}' dropped successfully.`);
    }
    
    return !error && !dropError;
  } catch (error) {
    console.error('Unexpected error during table test:', error);
    return false;
  }
};

const testAuth = async () => {
  try {
    console.log('Testing Supabase Auth functionality...');
    
    // Test accessing auth settings
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Auth error:', error);
      return false;
    }
    
    console.log('Auth functionality working correctly.');
    return true;
  } catch (error) {
    console.error('Unexpected auth error:', error);
    return false;
  }
};

const testStorage = async () => {
  try {
    console.log('Testing Supabase Storage functionality...');
    
    // List all buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Storage error:', error);
      return false;
    }
    
    console.log('Available buckets:', buckets.map(b => b.name));
    
    // Test bucket creation
    const testBucketName = 'test-bucket-' + Date.now();
    
    const { data: newBucket, error: createError } = await supabase.storage.createBucket(
      testBucketName,
      { public: false }
    );
    
    if (createError) {
      console.error('Error creating test bucket:', createError);
      return false;
    }
    
    console.log(`Test bucket '${testBucketName}' created successfully!`);
    
    // Clean up - delete test bucket
    const { error: deleteError } = await supabase.storage.deleteBucket(testBucketName);
    
    if (deleteError) {
      console.error('Error deleting test bucket:', deleteError);
    } else {
      console.log(`Test bucket '${testBucketName}' deleted successfully.`);
    }
    
    return !error && !createError && !deleteError;
  } catch (error) {
    console.error('Unexpected storage error:', error);
    return false;
  }
};

// Main function to run all tests
const runAllTests = async () => {
  console.log('Supabase Test Utility');
  console.log('===================');
  console.log('Environment:', config.environment);
  
  const connectionSuccess = await testSupabaseConnection();
  
  if (!connectionSuccess) {
    console.error('Cannot proceed with further tests due to connection failure.');
    return false;
  }
  
  const tableSuccess = await testTableCreation();
  const authSuccess = await testAuth();
  const storageSuccess = await testStorage();
  
  console.log('\nTest Results:');
  console.log('=============');
  console.log('Connection Test:', connectionSuccess ? 'PASSED' : 'FAILED');
  console.log('Table Creation Test:', tableSuccess ? 'PASSED' : 'FAILED');
  console.log('Auth Test:', authSuccess ? 'PASSED' : 'FAILED');
  console.log('Storage Test:', storageSuccess ? 'PASSED' : 'FAILED');
  
  const allTestsPassed = connectionSuccess && tableSuccess && authSuccess && storageSuccess;
  console.log('\nOverall Result:', allTestsPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
  
  return allTestsPassed;
};

// Run tests if executed directly
if (process.argv[1].endsWith('testSupabase.js')) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}

export {
  testSupabaseConnection,
  testTableCreation,
  testAuth,
  testStorage,
  runAllTests
}; 