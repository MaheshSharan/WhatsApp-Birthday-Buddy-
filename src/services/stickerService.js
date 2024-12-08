const sharp = require('sharp');
const { RemoveBgError, removeBackgroundFromImageFile } = require('remove.bg');
const ffmpeg = require('fluent-ffmpeg');
const FileType = require('file-type');
const fs = require('fs-extra');
const path = require('path');
const temp = require('temp').track(); // Auto-cleanup on exit
const config = require('../config/stickerConfig');
const logger = require('../utils/logger');

class StickerService {
    constructor() {
        this.initTempDir();
    }

    async initTempDir() {
        await fs.ensureDir(config.tempDir);
    }

    async createSticker(mediaPath, options = {}) {
        try {
            // Check file size
            const stats = await fs.stat(mediaPath);
            if (stats.size > config.defaults.maxSize) {
                throw new Error(`File too large. Maximum size is ${config.defaults.maxSize / (1024 * 1024)}MB`);
            }

            // Detect file type
            const fileType = await FileType.fromFile(mediaPath);
            if (!fileType) throw new Error('Unable to determine file type');

            // Create temp directory for processing
            const tempDir = temp.mkdirSync('sticker-');
            const outputPath = path.join(tempDir, 'output.webp');

            let result;
            if (config.supported.image.includes(fileType.ext)) {
                result = await this.processImage(mediaPath, outputPath, options);
            } else if (config.supported.video.includes(fileType.ext)) {
                result = await this.processVideo(mediaPath, outputPath, options);
            } else {
                throw new Error('Unsupported file type');
            }

            return result;
        } catch (error) {
            logger.logSecurity('STICKER_ERROR', {
                error: error.message,
                options
            });
            throw error;
        }
    }

    async processImage(inputPath, outputPath, options) {
        let image = sharp(inputPath);
        
        // Apply transformations based on options
        if (options.circle) {
            // Create circular mask
            image = await this.makeCircular(image);
        }

        if (options.nobg) {
            // Check if API key is set
            if (!config.removeBg.apiKey) {
                throw new Error('Background removal feature requires REMOVE_BG_API_KEY in .env file');
            }
            // Remove background
            const tempFile = temp.path({ suffix: '.png' });
            await image.toFile(tempFile);
            await this.removeBackground(tempFile, tempFile);
            image = sharp(tempFile);
        }

        if (!options.full) {
            // Resize to standard sticker size
            image = image.resize(config.defaults.dimensions.width, config.defaults.dimensions.height, {
                fit: options.crop ? 'cover' : 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            });
        }

        // Convert to WebP with metadata
        await image
            .webp({
                quality: options.quality || config.defaults.quality,
                lossless: false
            })
            .toFile(outputPath);

        return outputPath;
    }

    async processVideo(inputPath, outputPath, options) {
        const duration = options.duration || config.defaults.maxDuration;
        
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .setStartTime(0)
                .setDuration(duration)
                .size(`${config.defaults.dimensions.width}x${config.defaults.dimensions.height}`)
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (err) => reject(err))
                .run();
        });
    }

    async makeCircular(image) {
        const width = config.defaults.dimensions.width;
        const height = config.defaults.dimensions.height;
        
        // Create circular mask
        const circle = Buffer.from(
            `<svg><circle cx="${width/2}" cy="${height/2}" r="${width/2}" /></svg>`
        );

        return image
            .resize(width, height)
            .composite([{
                input: circle,
                blend: 'dest-in'
            }]);
    }

    async removeBackground(inputPath, outputPath) {
        try {
            if (!config.removeBg.apiKey) {
                throw new Error('REMOVE_BG_API_KEY not set in environment variables');
            }

            await removeBackgroundFromImageFile({
                path: inputPath,
                apiKey: config.removeBg.apiKey,
                size: 'regular',
                outputFile: outputPath
            });
        } catch (error) {
            if (error instanceof RemoveBgError) {
                console.error('Remove.bg error:', error.message);
                throw new Error('Failed to remove background: ' + error.message);
            } else {
                throw error;
            }
        }
    }

    parseOptions(text) {
        try {
            const options = {
                crop: false,
                circle: false,
                nobg: false,
                full: false,
                quality: config.defaults.quality,
                duration: config.defaults.maxDuration,
                author: config.defaults.author,
                pack: 'WhatsApp Stickers'
            };

            if (!text) return options;

            const args = text.split(' ');
            args.forEach(arg => {
                if (arg.includes('=')) {
                    const [key, value] = arg.split('=');
                    if (key === 'quality') options.quality = parseInt(value);
                    if (key === 'duration') options.duration = parseInt(value);
                    if (key === 'pack') options.pack = value.replace(/"/g, '');
                    if (key === 'author') options.author = value.replace(/"/g, '');
                } else {
                    if (arg === 'crop') options.crop = true;
                    if (arg === 'circle') options.circle = true;
                    if (arg === 'nobg') options.nobg = true;
                    if (arg === 'full') options.full = true;
                }
            });

            return options;
        } catch (error) {
            logger.logSecurity('STICKER_ERROR', {
                error: error.message,
                text
            });
            throw new Error('Failed to parse options: ' + error.message);
        }
    }

    async cleanup() {
        await fs.remove(config.tempDir).catch(console.error);
    }
}

module.exports = new StickerService();
