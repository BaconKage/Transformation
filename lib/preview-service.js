import {
  buildStructuredTransformationPrompt,
  createTransformationProjection
} from "./transformation-engine.js";

function dataUrlToBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    throw new Error("Invalid generated image format.");
  }
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Missing base64 image content.");
  }
  return Buffer.from(base64, "base64");
}

function parseOptionalNumber(value, { min, max }) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

async function generatePreview({ apiKey, imageBuffer, imageMimeType = "image/jpeg", prompt }) {
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt
          },
          {
            inline_data: {
              mime_type: imageMimeType,
              data: imageBuffer.toString("base64")
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["IMAGE"]
    }
  };

  const response = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(errText);
    } catch {
      parsed = null;
    }
    const error = new Error(parsed?.error?.message || errText || "Gemini image generation failed.");
    error.httpStatus = response.status;
    error.code = parsed?.error?.code;
    error.type = parsed?.error?.type;
    error.messageDetail = parsed?.error?.message;
    throw error;
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const inline = parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
  const base64 = inline?.inlineData?.data || inline?.inline_data?.data;
  if (!base64) {
    throw new Error("No image returned from Gemini.");
  }
  return `data:image/png;base64,${base64}`;
}

function isSexualModerationBlock(error) {
  return /safety|sexual|image policy|policy/i.test(error?.message || "") || /safety/i.test(error?.messageDetail || "");
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

export async function handlePreviewRequest(req, res) {
  try {
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
      goal,
      workoutDaysPerWeek,
      workoutAdherence,
      dietAdherence,
      weeksOnPlan
    } = req.body;

    const picked = PRECONFIGURED_PLANS[selectedPlanId];
    const hasCustom = Boolean(customWorkout || customDiet);

    if (!picked && !hasCustom) {
      return res.status(400).json({ error: "Pick a preconfigured plan or provide a custom plan." });
    }

    const planText = picked
      ? `Preconfigured plan. Workout: ${picked.workout}. Diet: ${picked.diet}.`
      : `Custom plan. Workout: ${customWorkout || "not provided"}. Diet: ${customDiet || "not provided"}.`;
    const workoutText = picked?.workout || customWorkout || "";
    const dietText = picked?.diet || customDiet || "";

    const normalizedWorkoutDaysPerWeek = parseOptionalNumber(workoutDaysPerWeek, { min: 0, max: 14 });
    const normalizedWorkoutAdherence = parseOptionalNumber(workoutAdherence, { min: 0, max: 100 });
    const normalizedDietAdherence = parseOptionalNumber(dietAdherence, { min: 0, max: 100 });
    const normalizedWeeksOnPlan = parseOptionalNumber(weeksOnPlan, { min: 0, max: 520 });

    const progressBits = [];
    if (normalizedWorkoutDaysPerWeek !== null) {
      progressBits.push(`workout frequency is about ${normalizedWorkoutDaysPerWeek} days per week`);
    }
    if (normalizedWorkoutAdherence !== null) {
      progressBits.push(`workout adherence is around ${normalizedWorkoutAdherence}%`);
    }
    if (normalizedDietAdherence !== null) {
      progressBits.push(`diet adherence is around ${normalizedDietAdherence}%`);
    }
    if (normalizedWeeksOnPlan !== null) {
      progressBits.push(`the person has already followed the plan for ${normalizedWeeksOnPlan} weeks`);
    }
    const progressText = progressBits.length
      ? `${progressBits.join(", ")}.`
      : "No historical app tracking data is available yet; infer progress only from stated goal and plan with realistic consistency.";

    const baseTransformationInput = {
      age,
      weight,
      height,
      workoutType: workoutText,
      diet: dietText,
      workoutDaysPerWeek: normalizedWorkoutDaysPerWeek,
      workoutAdherence: normalizedWorkoutAdherence,
      dietAdherence: normalizedDietAdherence,
      goal
    };
    const sixMonthProjection = createTransformationProjection({
      ...baseTransformationInput,
      durationMonths: 6
    });
    const oneYearProjection = createTransformationProjection({
      ...baseTransformationInput,
      durationMonths: 12
    });
    const userProfile = { gender, age, height, weight };

    const prompt6m = buildStructuredTransformationPrompt({
      userProfile,
      transformationScore: sixMonthProjection.transformation_score,
      bodyMap: sixMonthProjection.body_map,
      planText,
      timeline: "6 months",
      timelineStage: "six_months",
      progressText
    });
    const prompt6mStrict = buildStructuredTransformationPrompt({
      userProfile,
      transformationScore: sixMonthProjection.transformation_score,
      bodyMap: sixMonthProjection.body_map,
      planText,
      timeline: "6 months",
      timelineStage: "six_months",
      progressText,
      strictSafety: true
    });

    const prompt1y = buildStructuredTransformationPrompt({
      userProfile,
      transformationScore: oneYearProjection.transformation_score,
      bodyMap: oneYearProjection.body_map,
      planText,
      timeline: "1 year",
      timelineStage: "one_year",
      progressText
    });
    const prompt1yStrict = buildStructuredTransformationPrompt({
      userProfile,
      transformationScore: oneYearProjection.transformation_score,
      bodyMap: oneYearProjection.body_map,
      planText,
      timeline: "1 year",
      timelineStage: "one_year",
      progressText,
      strictSafety: true
    });

    const transformation = {
      six_months: sixMonthProjection,
      one_year: oneYearProjection
    };
    const transformationSummary = [
      sixMonthProjection.transformation_summary,
      oneYearProjection.transformation_summary
    ].join(" ");
    const metricsUsed = {
      six_months: sixMonthProjection.transformation_score,
      one_year: oneYearProjection.transformation_score
    };

    console.log("[FitJourney] transformation_score", JSON.stringify(metricsUsed, null, 2));
    console.log("[FitJourney] body_map", JSON.stringify({
      six_months: sixMonthProjection.body_map,
      one_year: oneYearProjection.body_map
    }, null, 2));
    console.log("[FitJourney] final_prompt", JSON.stringify({
      six_months: prompt6m,
      one_year: prompt1y
    }, null, 2));

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        sixMonthsImage: null,
        oneYearImage: null,
        transformation,
        transformationSummary,
        metricsUsed,
        note: "Your progress estimate is ready. Image rendering is not enabled in this environment."
      });
    }

    const sixMonthsImage = await generatePreviewWithFallback({
      apiKey: process.env.GEMINI_API_KEY,
      imageBuffer: req.file.buffer,
      imageMimeType: req.file.mimetype || "image/jpeg",
      normalPrompt: prompt6m,
      fallbackPrompt: prompt6mStrict
    });

    const oneYearImage = await generatePreviewWithFallback({
      apiKey: process.env.GEMINI_API_KEY,
      imageBuffer: dataUrlToBuffer(sixMonthsImage),
      imageMimeType: "image/png",
      normalPrompt: prompt1y,
      fallbackPrompt: prompt1yStrict
    });

    return res.json({
      sixMonthsImage,
      oneYearImage,
      transformation,
      transformationSummary,
      metricsUsed,
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
    return res.status(500).json({ error: error.message || "Failed to generate previews." });
  }
}
