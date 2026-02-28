import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(publicDir));

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const PRECONFIGURED_PLANS = {
  beginner_fat_loss: {
    workout: "4-day split: strength + 2 cardio sessions weekly",
    diet: "Moderate calorie deficit, high protein, whole foods"
  },
  lean_muscle_gain: {
    workout: "5-day hypertrophy with progressive overload",
    diet: "Slight calorie surplus, high protein, carb timing around workouts"
  },
  athletic_recomp: {
    workout: "3 strength + 2 conditioning sessions weekly",
    diet: "Maintenance calories, high protein, low added sugar"
  }
};

function buildTransformationPrompt({
  gender,
  age,
  height,
  weight,
  goal,
  planText,
  timeline,
  strictSafety = false
}) {
  return [
    "Create a realistic simulated future fitness progress portrait from the provided real person photo.",
    `Timeline: ${timeline}.`,
    `Person details: gender=${gender || "not specified"}, age=${age || "not specified"}, height=${height || "not specified"}, weight=${weight || "not specified"}.`,
    `Goal: ${goal || "general fitness improvement"}.`,
    `Workout + Diet Plan: ${planText}.`,
    "Keep the same person identity, facial features, skin tone, pose framing, and background as much as possible.",
    "Show healthy, plausible progress according to the timeline and plan.",
    "Person must remain fully clothed in a normal gym or casual outfit. No swimwear, underwear, lingerie, nudity, cleavage emphasis, or suggestive styling.",
    strictSafety
      ? "Use conservative, non-revealing clothing and avoid shirtless or skin-exposing presentation."
      : "Keep the clothing natural and non-revealing.",
    "Photorealistic output. Non-sexual, non-suggestive. No text overlays, no logos, no watermarks."
  ].join(" ");
}

async function generatePreview({ apiKey, imageBuffer, prompt }) {
  const form = new FormData();
  const imageBlob = new Blob([imageBuffer], { type: "image/jpeg" });

  form.append("model", "gpt-image-1");
  form.append("image", imageBlob, "input.jpg");
  form.append("prompt", prompt);
  form.append("size", "1024x1024");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(errText);
    } catch {
      parsed = null;
    }
    const error = new Error(parsed?.error?.message || errText || "OpenAI image generation failed.");
    error.httpStatus = response.status;
    error.code = parsed?.error?.code;
    error.type = parsed?.error?.type;
    throw error;
  }

  const data = await response.json();
  const base64 = data?.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error("No image returned from OpenAI.");
  }
  return `data:image/png;base64,${base64}`;
}

function isSexualModerationBlock(error) {
  return error?.code === "moderation_blocked" && /sexual/i.test(error?.message || "");
}

async function generatePreviewWithFallback({ apiKey, imageBuffer, normalPrompt, fallbackPrompt }) {
  try {
    return await generatePreview({ apiKey, imageBuffer, prompt: normalPrompt });
  } catch (error) {
    if (!isSexualModerationBlock(error)) {
      throw error;
    }
    return generatePreview({ apiKey, imageBuffer, prompt: fallbackPrompt });
  }
}

app.post("/api/preview", upload.single("photo"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is missing in environment." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Photo is required." });
    }

    const {
      selectedPlanId,
      customWorkout,
      customDiet,
      gender,
      age,
      height,
      weight,
      goal
    } = req.body;

    const picked = PRECONFIGURED_PLANS[selectedPlanId];
    const hasCustom = Boolean(customWorkout || customDiet);

    if (!picked && !hasCustom) {
      return res.status(400).json({ error: "Pick a preconfigured plan or provide a custom plan." });
    }

    const planText = picked
      ? `Preconfigured plan. Workout: ${picked.workout}. Diet: ${picked.diet}.`
      : `Custom plan. Workout: ${customWorkout || "not provided"}. Diet: ${customDiet || "not provided"}.`;

    const prompt6m = buildTransformationPrompt({
      gender,
      age,
      height,
      weight,
      goal,
      planText,
      timeline: "6 months"
    });
    const prompt6mStrict = buildTransformationPrompt({
      gender,
      age,
      height,
      weight,
      goal,
      planText,
      timeline: "6 months",
      strictSafety: true
    });

    const prompt1y = buildTransformationPrompt({
      gender,
      age,
      height,
      weight,
      goal,
      planText,
      timeline: "1 year"
    });
    const prompt1yStrict = buildTransformationPrompt({
      gender,
      age,
      height,
      weight,
      goal,
      planText,
      timeline: "1 year",
      strictSafety: true
    });

    const [sixMonthsImage, oneYearImage] = await Promise.all([
      generatePreviewWithFallback({
        apiKey: process.env.OPENAI_API_KEY,
        imageBuffer: req.file.buffer,
        normalPrompt: prompt6m,
        fallbackPrompt: prompt6mStrict
      }),
      generatePreviewWithFallback({
        apiKey: process.env.OPENAI_API_KEY,
        imageBuffer: req.file.buffer,
        normalPrompt: prompt1y,
        fallbackPrompt: prompt1yStrict
      })
    ]);

    res.json({
      sixMonthsImage,
      oneYearImage,
      note: "AI output is a simulation, not a guaranteed real-world outcome."
    });
  } catch (error) {
    console.error(error);
    if (error?.code === "moderation_blocked") {
      return res.status(422).json({
        error:
          "Image request was blocked by safety checks. Try a fully clothed, non-revealing photo with neutral pose and plain background."
      });
    }
    res.status(500).json({ error: error.message || "Failed to generate previews." });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
