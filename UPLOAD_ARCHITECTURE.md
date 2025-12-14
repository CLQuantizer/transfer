# Upload Architecture: Where Do Chunks Go?

## Your Question: 50MB file, 5MB chunks - where do they go?

## Option 1: Client → Backend → R2 (Current System)
```
Client (50MB file)
  ↓ [Sends entire file]
Cloudflare Worker (receives 50MB)
  ↓ [Uploads to R2]
R2 Storage
```

**Problem:** 
- ❌ Worker has **128MB memory limit**
- ❌ Worker has **30s CPU time limit** (can extend to 15min)
- ❌ Receiving 50MB uses significant memory
- ❌ If 100 users upload simultaneously = 5GB memory needed!

---

## Option 2: Client → R2 Direct (Presigned URLs) ⭐ BEST
```
Client (50MB file, split into 5MB chunks)
  ↓ [Chunk 1: 5MB]
R2 Storage (direct upload)
  ↓ [Chunk 2: 5MB]
R2 Storage (direct upload)
  ↓ [Chunk 3: 5MB]
R2 Storage (direct upload)
  ...
```

**How it works:**
1. Client asks backend: "I want to upload 50MB file"
2. Backend creates **presigned URLs** for each chunk
3. Client uploads chunks **directly to R2** (bypasses Worker!)
4. Backend only coordinates, doesn't handle file data

**Benefits:**
- ✅ Worker never touches file data (no memory used!)
- ✅ Unlimited file sizes
- ✅ Faster (direct to R2, no Worker bottleneck)
- ✅ Worker only coordinates (lightweight)

---

## Option 3: Client → Backend (chunks) → R2
```
Client (5MB chunk 1)
  ↓
Cloudflare Worker (receives 5MB)
  ↓ [Uploads to R2]
R2 Storage

Client (5MB chunk 2)
  ↓
Cloudflare Worker (receives 5MB)
  ↓ [Uploads to R2]
R2 Storage
...
```

**Better than Option 1, but:**
- ⚠️ Still uses Worker memory (5MB per request)
- ⚠️ Worker handles each chunk sequentially
- ✅ Better than receiving entire file
- ❌ Not as efficient as direct upload

---

## Recommended: Presigned URLs (Option 2)

### Flow:

**Step 1: Initiate Upload**
```javascript
// Client → Backend
POST /private/upload/initiate
Body: { filename: "file.zip", size: 52428800 }

// Backend → Client
Response: {
  uploadId: "abc123",
  chunkSize: 5242880, // 5MB
  presignedUrls: [
    "https://r2.example.com/file?part=1&uploadId=abc123&signature=...",
    "https://r2.example.com/file?part=2&uploadId=abc123&signature=...",
    ...
  ]
}
```

**Step 2: Upload Chunks Directly to R2**
```javascript
// Client → R2 (direct, bypasses Worker!)
PUT presignedUrl[0]
Body: chunk1 (5MB)

PUT presignedUrl[1]
Body: chunk2 (5MB)

PUT presignedUrl[2]
Body: chunk3 (5MB)
...
```

**Step 3: Complete Upload**
```javascript
// Client → Backend
POST /private/upload/complete
Body: {
  uploadId: "abc123",
  parts: [
    { partNumber: 1, etag: "..." },
    { partNumber: 2, etag: "..." },
    ...
  ]
}

// Backend → R2 (combines chunks)
// Backend → Client
Response: { key: "file-key", success: true }
```

---

## Current System (What You Have Now)

```javascript
// Client sends entire file to Worker
const formData = new FormData();
formData.append('file', file); // 50MB file
fetch('/private/upload', { body: formData });

// Worker receives entire file
const file = formData.get('file');
const arrayBuffer = await file.arrayBuffer(); // 50MB in memory!
await bucket.put(key, arrayBuffer); // Upload to R2
```

**Limitations:**
- ✅ Works fine for files < 100MB
- ❌ Worker memory limit: 128MB
- ❌ Can't handle very large files
- ❌ All file data goes through Worker

---

## Answer to Your Question

**For a 50MB file with 5MB chunks:**

### If using multipart with presigned URLs (recommended):
- Send **5 chunks directly to R2** (bypass Worker)
- Worker only coordinates (creates presigned URLs, completes upload)
- **No file data goes through Worker**

### If using current system:
- Send **entire 50MB file to Worker** in one request
- Worker receives it, then uploads to R2
- **All 50MB goes through Worker memory**

---

## When to Use Each Approach

### Current System (Single Upload):
- ✅ Files < 100MB
- ✅ Simple implementation
- ✅ Fast for small files
- ✅ Your current setup works fine!

### Multipart with Presigned URLs:
- ✅ Files > 100MB
- ✅ Need to handle large files
- ✅ Want to avoid Worker memory limits
- ✅ Better scalability

---

## Summary

**Your question:** "Do I send 5 chunks to backend or 50MB in one go?"

**Answer:** 
- **Current system:** Send 50MB in one go to backend
- **Multipart system:** Send 5 chunks **directly to R2** (backend only coordinates)

**For Cloudflare Workers, presigned URLs are best** because:
- Worker never touches file data
- No memory limits
- Faster (direct to R2)
- Scales better

Your current system is fine for files under 100MB! Only need multipart if you want to handle larger files.

