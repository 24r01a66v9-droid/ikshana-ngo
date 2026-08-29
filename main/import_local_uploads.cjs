const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 1. Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be defined in your .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getMimeType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

async function importUploads() {
  console.log("Scanning uploads/ directory...");
  const uploadsDir = path.join(__dirname, 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    console.error("Error: uploads directory not found at " + uploadsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith('img-'));
  console.log(`Found ${files.length} files to import.`);

  // Categories to distribute them into for testing/display
  const categories = ['gallery', 'about', 'gallery', 'gallery']; 
  const subCategories = ['Community', 'Team', 'Initiative', 'Event'];

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const localFilePath = path.join(uploadsDir, fileName);

    try {
      console.log(`[${i+1}/${files.length}] Uploading ${fileName} to Supabase Storage bucket 'photos'...`);
      const fileBuffer = fs.readFileSync(localFilePath);
      const mimeType = getMimeType(fileName);

      // Upload file to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, fileBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        console.error(`Failed to upload ${fileName} to storage:`, uploadError.message);
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      console.log(`Uploaded! Public URL: ${publicUrl}`);

      // Check if already exists in photos table
      const { data: existing, error: checkError } = await supabase
        .from('photos')
        .select('id')
        .eq('url', publicUrl)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        console.log(`Record already exists in photos table. Skipping database insert.`);
        continue;
      }

      // Insert record into Supabase photos table
      const category = categories[i % categories.length];
      const subCategory = subCategories[i % subCategories.length];
      
      const { error: dbError } = await supabase.from('photos').insert([{
        url: publicUrl,
        title: `Ikshana Moment ${i+1}`,
        category: category,
        sub_category: subCategory,
        is_featured: i === 1 ? 1 : 0, // Set one as featured
        date: new Date().toLocaleDateString(),
        created_at: new Date().toISOString()
      }]);

      if (dbError) {
        console.error(`Failed to insert database record for ${fileName}:`, dbError.message);
      } else {
        console.log(`Successfully registered in database.`);
      }
    } catch (err) {
      console.error(`Error processing ${fileName}:`, err.message);
    }
  }

  console.log("Import process complete!");
}

importUploads();
