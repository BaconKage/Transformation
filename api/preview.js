import multer from "multer";
import { handlePreviewRequest } from "../lib/preview-service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

function runMiddleware(req, res, middleware) {
  return new Promise((resolve, reject) => {
    middleware(req, res, (result) => {
      if (result instanceof Error) {
        reject(result);
        return;
      }
      resolve(result);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    await runMiddleware(req, res, upload.single("photo"));
    return await handlePreviewRequest(req, res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Failed to process upload." });
  }
}
