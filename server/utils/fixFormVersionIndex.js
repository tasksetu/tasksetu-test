/**
 * Auto-fix for FormVersion external_token index
 * This runs on server startup to ensure the index is sparse
 */

export async function ensureSparseExternalTokenIndex() {
  try {
    const mongoose = await import('mongoose');
    const FormVersion = mongoose.default.connection.collection('formversions');
    
    // Check if collection exists
    const collections = await mongoose.default.connection.db.listCollections({ name: 'formversions' }).toArray();
    if (collections.length === 0) {
      console.log('ℹ️  FormVersion collection does not exist yet, skipping index fix');
      return;
    }
    
    const indexes = await FormVersion.indexes();
    
    // Check for non-sparse external_token index
    const problematicIndex = indexes.find(idx => 
      idx.key.external_token === 1 && 
      idx.unique && 
      !idx.sparse
    );
    
    if (problematicIndex) {
      console.log(`🔧 Fixing non-sparse external_token index: ${problematicIndex.name}`);
      
      // Drop the problematic index
      await FormVersion.dropIndex(problematicIndex.name);
      console.log(`✅ Dropped non-sparse index: ${problematicIndex.name}`);
      
      // Create sparse index
      await FormVersion.createIndex(
        { external_token: 1 }, 
        { unique: true, sparse: true, name: 'external_token_1' }
      );
      console.log('✅ Created sparse unique index for external_token');
    } else {
      // Check if sparse index exists
      const sparseIndex = indexes.find(idx => 
        idx.key.external_token === 1 && 
        idx.sparse
      );
      
      if (!sparseIndex) {
        // Create sparse index if it doesn't exist
        await FormVersion.createIndex(
          { external_token: 1 }, 
          { unique: true, sparse: true, name: 'external_token_1' }
        );
        console.log('✅ Created sparse unique index for external_token');
      }
    }
  } catch (error) {
    console.warn('⚠️  Failed to fix external_token index:', error.message);
    // Don't throw - allow server to start
  }
}
