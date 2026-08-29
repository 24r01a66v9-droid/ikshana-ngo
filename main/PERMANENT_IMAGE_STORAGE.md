# Permanent Image Storage Implementation

## Overview
The gallery now saves all images permanently to the server's file system instead of converting them to base64 strings in the database. This provides:

- **Better Performance**: Smaller database size, faster queries
- **Easier Management**: Images stored as actual files, easy to backup/export
- **Scalability**: Can handle large image collections efficiently
- **Caching**: Browser can cache images efficiently
- **Persistence**: Images survive database backups/migrations

## How It Works

### File Storage
- Images are uploaded via the `/api/photos` endpoint
- Files are stored in the `uploads/` directory in the server root
- Each file is renamed with a timestamp to ensure uniqueness: `img-{timestamp}-{random}.{ext}`

### Database Storage
- Only the file path is stored in the database: `/uploads/img-{timestamp}-{random}.{ext}`
- This reduces database size significantly
- File paths can be easily modified if needed (e.g., for CDN migration)

### File Serving
- The `/uploads` directory is served as static content at `http://localhost:3000/uploads/`
- Images are accessible directly from the browser

## Implementation Details

### Backend Changes (`server.ts`)

1. **Added Dependencies**:
   - `multer`: For handling file uploads
   - `fs`: For file system operations

2. **Configuration**:
   ```typescript
   // Upload directory setup
   const uploadsDir = path.join(__dirname, "uploads");
   
   // Multer storage configuration
   const storage = multer.diskStorage({
     destination: (req, file, cb) => cb(null, uploadsDir),
     filename: (req, file, cb) => {
       const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
       cb(null, `img-${uniqueSuffix}${path.extname(file.originalname)}`);
     }
   });
   ```

3. **Updated Endpoints**:
   - `POST /api/photos`: Now expects FormData with file upload instead of JSON with base64
   - `DELETE /api/photos/:id`: Now deletes both database record AND file from disk
   - Added static file serving: `app.use("/uploads", express.static(uploadsDir))`

4. **File Validation**:
   - File size limit: 10MB
   - Allowed types: JPEG, PNG, GIF, WebP
   - Automatic cleanup if upload fails

### Frontend Changes (`Gallery.tsx`)

1. **Updated Upload Handler**:
   - Changed from `FileReader.readAsDataURL()` to `FormData` API
   - Sends multipart/form-data instead of JSON
   - Simpler, more efficient implementation

### Configuration (`package.json`)

- Added `multer` dependency for file handling

### Version Control (`.gitignore`)

- Added `uploads/` directory to `.gitignore` (images are not version controlled)
- Added `ikshana.db` to `.gitignore` (local database file)

## File Sizes Comparison

### Before (Base64 in Database)
- Single 1MB image → ~1.33MB when base64 encoded
- Database bloats quickly
- Slow database queries

### After (File System)
- Single 1MB image → ~1MB on disk
- Database only stores path (typically <100 bytes per image)
- Fast image serving via HTTP caching

## Backup & Migration

### Backing Up Images
```bash
# Simply backup the uploads folder
tar -czf images_backup.tar.gz uploads/
```

### Migrating to CDN
If you want to move images to a cloud storage service (AWS S3, CloudFront, etc.):
1. Upload files from `uploads/` to CDN
2. Update database URLs to point to CDN: `https://cdn.example.com/img-{timestamp}-{random}.{ext}`
3. Delete local `uploads/` directory

## Testing the Implementation

1. Start the server: `npm run dev`
2. Navigate to the Gallery section
3. Click "Contribute to Gallery" button
4. Upload an image
5. The image will be:
   - Saved to `uploads/` directory
   - Stored in the database with the file path
   - Displayed in the gallery
6. Deleting an image removes both the file and database record

## Troubleshooting

### Images not displaying
- Check that `uploads/` directory exists: `ls uploads/` (or `dir uploads` on Windows)
- Check server console for any errors
- Verify file permissions on the `uploads/` directory

### Upload fails
- Check server logs for error messages
- Verify file size is under 10MB
- Verify file type is supported (JPEG, PNG, GIF, WebP)

### Database inconsistency
If files are deleted manually from disk but records remain in database:
```typescript
// You can add a cleanup function to remove orphaned database records
const files = fs.readdirSync(uploadsDir);
const orphanedPhotos = db.prepare(`
  SELECT id, url FROM photos 
  WHERE url NOT IN (${files.map(f => `'/uploads/${f}'`).join(',')})
`).all();
```

## Future Enhancements

1. **Image Optimization**: Auto-resize/compress images on upload
2. **Thumbnails**: Generate thumbnails for faster gallery loading
3. **CDN Integration**: Serve images from a content delivery network
4. **Image Metadata**: Extract and store EXIF data
5. **Image Processing**: Add filters, effects, or watermarks
