import heicConvert from "heic-convert";

export function isHeicUpload(file) {
  const mimetype = (file?.mimetype || "").toLowerCase();
  const originalname = (file?.originalname || "").toLowerCase();
  return mimetype.includes("heic")
    || mimetype.includes("heif")
    || originalname.endsWith(".heic")
    || originalname.endsWith(".heif");
}

export async function convertHeicBufferToJpeg(buffer) {
  const outputBuffer = await heicConvert({
    buffer,
    format: "JPEG",
    quality: 0.92
  });
  return Buffer.from(outputBuffer);
}

export async function handlePhotoConvertRequest(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Upload a photo first." });
  }

  try {
    if (!isHeicUpload(req.file)) {
      const mimetype = req.file.mimetype || "image/jpeg";
      return res.json({
        image: `data:${mimetype};base64,${req.file.buffer.toString("base64")}`,
        mimeType: mimetype,
        filename: req.file.originalname || "photo.jpg"
      });
    }

    const jpegBuffer = await convertHeicBufferToJpeg(req.file.buffer);
    return res.json({
      image: `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`,
      mimeType: "image/jpeg",
      filename: (req.file.originalname || "photo.heic").replace(/\.(heic|heif)$/i, ".jpg")
    });
  } catch (error) {
    console.error(error);
    return res.status(422).json({
      error: "Could not convert that HEIC photo. Try another photo or export it as JPG."
    });
  }
}
