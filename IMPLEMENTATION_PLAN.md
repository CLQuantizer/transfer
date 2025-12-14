# Multipart Upload Implementation Plan

## Option 1: R2 Native Multipart (Recommended - Simpler)
- Uses R2 binding API directly
- No AWS SDK needed
- Chunks still go through Worker (but smaller chunks = less memory)
- Easier to implement

## Option 2: Presigned URLs (More Complex)
- Requires AWS SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- Chunks upload directly to R2 (bypass Worker)
- Requires R2 credentials in Worker
- More setup but better for very large files

## Recommendation
Start with Option 1 (R2 Native Multipart) - it's a huge improvement over single upload and doesn't require AWS SDK setup.

If you need to handle files > 500MB regularly, then add presigned URLs later.

