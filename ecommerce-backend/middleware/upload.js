const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 10,
        fieldSize: 100 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG or WEBP images are allowed'));
        }
    },
});

// Checks the file's real first bytes, not the label the sender gave it.
function looksLikeImage(buffer) {
    if (!buffer || buffer.length < 12) return false;

    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp =
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    return isJpeg || isPng || isWebp;
}

function uploadImage(req, res, next) {
    upload.single('image')(req, res, err => {
        if (err) {
            let message = err.message;
            if (err.code === 'LIMIT_FILE_SIZE') {
                message = 'Image must be under 5 MB';
            } else if (err instanceof multer.MulterError) {
                message = 'Invalid upload';
            }
            return res.status(400).json({ message });
        }
        if (req.file && !looksLikeImage(req.file.buffer)) {
            return res.status(400).json({ message: 'That file is not a valid image' });
        }
        next();
    });
}

module.exports = uploadImage;