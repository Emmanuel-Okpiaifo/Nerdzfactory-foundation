const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'opportunities');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (/^image\/(jpeg|png|webp|gif|avif)/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'));
    }
  },
});

router.post('/', authRequired, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    const filename = `${uuidv4()}.webp`;
    const filepath = path.join(uploadDir, filename);

    await sharp(req.file.buffer)
      .rotate()
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(filepath);

    res.status(201).json({
      url: `/uploads/opportunities/${filename}`,
      filename,
    });
  } catch (err) {
    console.error('Image upload failed:', err);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

module.exports = router;
