# Multipart Upload & Progress Bar Explained

## Current Implementation (Single Upload)

### How It Works Now:
1. **Client**: Reads entire file into memory → sends as one request
2. **Server**: Receives entire file → uploads to R2 in one go
3. **Progress**: XMLHttpRequest tracks bytes sent vs total bytes

### Progress Bar Flow:
```
File (100MB)
  ↓
XMLHttpRequest upload event fires
  ↓
Progress: 0% → 25% → 50% → 75% → 100%
  ↓
Server receives complete file
  ↓
R2 upload completes
```

**Limitations:**
- ❌ Entire file must fit in memory
- ❌ If upload fails at 99%, you start over
- ❌ No resumable uploads
- ❌ Limited by browser/server memory

---

## Multipart Upload Concept

### What is Multipart Upload?
Instead of uploading the entire file at once, you break it into **chunks** and upload each chunk separately.

### How It Works:

```
Large File (500MB)
  ↓
Split into chunks (e.g., 5MB each)
  ↓
Chunk 1 (5MB) → Upload → Get ETag
Chunk 2 (5MB) → Upload → Get ETag
Chunk 3 (5MB) → Upload → Get ETag
...
Chunk 100 (5MB) → Upload → Get ETag
  ↓
Combine all chunks → Complete upload
```

### Benefits:
- ✅ Can handle files larger than memory
- ✅ Resume failed uploads (only re-upload failed chunks)
- ✅ Parallel uploads (upload multiple chunks simultaneously)
- ✅ Better progress tracking (per chunk)
- ✅ More reliable for large files

---

## Progress Bar Implementation

### Single Upload Progress (Current):
```javascript
xhr.upload.addEventListener('progress', (e) => {
    // e.loaded = bytes uploaded so far
    // e.total = total file size
    const percent = (e.loaded / e.total) * 100;
    // Shows: 0% → 100%
});
```

### Multipart Upload Progress:
```javascript
// Track progress per chunk
let totalUploaded = 0;
const totalSize = file.size;
const chunkSize = 5 * 1024 * 1024; // 5MB chunks
const totalChunks = Math.ceil(totalSize / chunkSize);

// Upload chunk 1
uploadChunk(0, chunk1).then(() => {
    totalUploaded += chunk1.length;
    const percent = (totalUploaded / totalSize) * 100;
    // Shows: 0% → 20% → 40% → 60% → 80% → 100%
});

// Upload chunk 2
uploadChunk(1, chunk2).then(() => {
    totalUploaded += chunk2.length;
    const percent = (totalUploaded / totalSize) * 100;
});
```

---

## R2 Multipart Upload API

Cloudflare R2 supports multipart uploads via S3-compatible API:

### Steps:
1. **Initiate Multipart Upload**
   ```javascript
   POST /{bucket}/{key}?uploads
   → Returns: uploadId
   ```

2. **Upload Parts** (can be parallel)
   ```javascript
   PUT /{bucket}/{key}?partNumber=1&uploadId={uploadId}
   → Returns: ETag for part 1
   
   PUT /{bucket}/{key}?partNumber=2&uploadId={uploadId}
   → Returns: ETag for part 2
   ```

3. **Complete Multipart Upload**
   ```javascript
   POST /{bucket}/{key}?uploadId={uploadId}
   Body: { parts: [{ partNumber: 1, etag: "..." }, ...] }
   → Combines all parts into final file
   ```

---

## Example: Multipart Upload Implementation

### Client Side:
```javascript
async function uploadMultipart(file, chunkSize = 5 * 1024 * 1024) {
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = await initiateMultipartUpload(file.name);
    const parts = [];
    
    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        // Upload chunk
        const etag = await uploadChunk(uploadId, i + 1, chunk);
        parts.push({ partNumber: i + 1, etag });
        
        // Update progress
        const progress = ((i + 1) / totalChunks) * 100;
        updateProgressBar(progress);
    }
    
    // Complete upload
    await completeMultipartUpload(uploadId, parts);
}
```

### Server Side:
```javascript
// 1. Initiate
const uploadId = await bucket.createMultipartUpload(key);

// 2. Upload parts (can be parallel)
const part1 = await bucket.uploadPart(key, uploadId, 1, chunk1);
const part2 = await bucket.uploadPart(key, uploadId, 2, chunk2);

// 3. Complete
await bucket.completeMultipartUpload(key, uploadId, [
    { partNumber: 1, etag: part1.etag },
    { partNumber: 2, etag: part2.etag }
]);
```

---

## When to Use Multipart Upload?

### Use Single Upload (Current):
- ✅ Files < 100MB
- ✅ Simple implementation
- ✅ Fast for small files
- ✅ Less server complexity

### Use Multipart Upload:
- ✅ Files > 100MB
- ✅ Need resumable uploads
- ✅ Unstable network connections
- ✅ Want parallel uploads for speed
- ✅ Memory constraints

---

## Progress Bar Speed Calculation

### Current Implementation:
```javascript
// Track bytes uploaded over time
let lastLoaded = 0;
let lastTime = Date.now();

xhr.upload.addEventListener('progress', (e) => {
    const now = Date.now();
    const timeDiff = (now - lastTime) / 1000; // seconds
    const bytesDiff = e.loaded - lastLoaded;
    
    // Speed = bytes per second
    uploadSpeed = bytesDiff / timeDiff;
    
    lastLoaded = e.loaded;
    lastTime = now;
});
```

### Why This Works:
- Measures actual bytes transferred
- Updates every ~100ms for smooth display
- Calculates instantaneous speed
- Can estimate time remaining: `(remainingBytes / speed)`

---

## Summary

**Current System:**
- Single HTTP request with FormData
- XMLHttpRequest tracks progress
- Works great for files < 100MB

**Multipart System:**
- Multiple HTTP requests (one per chunk)
- Track progress per chunk
- Better for large files, resumable, parallelizable

**Progress Bar:**
- Tracks `bytes uploaded / total bytes`
- Calculates speed from time difference
- Updates UI in real-time

