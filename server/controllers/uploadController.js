const fs = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

// Ensure uploads/products directory exists
const uploadsDir = path.join(__dirname, '../uploads/products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Upload single image (Cloudinary with Local Disk Fallback)
exports.uploadImage = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, 'No image file provided.'));
  }

  console.log(`[IMAGE UPLOAD] Processing file: ${req.file.originalname}, Size: ${req.file.size} bytes`);

  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const isRealCloudinary = cloudName && cloudName !== 'demo' && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_KEY !== 'demo';

  // 1. Attempt Cloudinary Upload if valid keys exist
  if (isRealCloudinary) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'styleverse/products',
            resource_type: 'image',
            quality: 'auto:best',
            fetch_format: 'auto',
            transformation: [{ width: 1600, height: 2000, crop: 'limit', quality: 'auto:best' }],
          },
          (error, res) => {
            if (error) reject(error);
            else resolve(res);
          }
        );
        stream.end(req.file.buffer);
      });

      console.log(`[IMAGE UPLOAD SUCCESS - CLOUDINARY] URL: ${result.secure_url}`);
      return res.status(200).json({
        success: true,
        message: 'Image uploaded successfully to Cloudinary.',
        url: result.secure_url,
        publicId: result.public_id,
      });
    } catch (err) {
      console.warn('[CLOUDINARY UPLOAD FAILED - FALLING BACK TO LOCAL DISK]', err.message);
    }
  }

  // 2. Base64 Data URL Fallback (Permanent — survives Render redeploys)
  // Render.com has an ephemeral filesystem: files saved to disk are deleted on every redeploy.
  // By converting to Base64 Data URL, the image data is stored directly in the database,
  // making it permanent and instantly visible on all devices.
  try {
    // Use sharp if available to optimize the image before base64 encoding
    let optimizedBuffer = req.file.buffer;
    let mimeType = 'image/webp';
    try {
      const sharp = require('sharp');
      optimizedBuffer = await sharp(req.file.buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (sharpErr) {
      // sharp not available, use raw buffer
      mimeType = req.file.mimetype || 'image/webp';
      optimizedBuffer = req.file.buffer;
    }

    const base64String = optimizedBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64String}`;

    console.log(`[IMAGE UPLOAD SUCCESS - BASE64] Size: ${base64String.length} chars, MIME: ${mimeType}`);

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully as Base64 Data URL.',
      url: dataUrl,
      publicId: `base64-${Date.now()}`,
    });
  } catch (b64Err) {
    console.error('[BASE64 CONVERSION FAILED]', b64Err);
    return next(new ApiError(500, 'Failed to process uploaded image.'));
  }
});
