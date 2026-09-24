import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const ALLOWED = [".pdf", ".jpg", ".jpeg", ".png"];
const IMAGE_TYPES = [".jpg", ".jpeg", ".png", ".webp"];

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.includes(ext)) return cb(new Error("Unsupported file type"));
    cb(null, true);
  },
});

// Announcement photos: images only.
export const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!IMAGE_TYPES.includes(ext) || !file.mimetype.startsWith("image/")) return cb(new Error("Unsupported file type"));
    cb(null, true);
  },
});

// Only ever deletes a plain file name inside UPLOAD_DIR.
export function removeUpload(storedName) {
  if (!storedName || storedName !== path.basename(storedName)) return;
  fs.promises.unlink(path.join(UPLOAD_DIR, storedName)).catch(() => {});
}
