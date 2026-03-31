function buildTransformationPrompt({
  gender,
  age,
  height,
  weight,
  goal,
  planText,
  timeline,
  timelineStage,
  progressText,
  visualChangeGuidance,
  strictSafety = false
}) {
  const stageInstruction =
    timelineStage === "one_year"
      ? "Using the uploaded full-body image as base, create a realistic 1-year fitness progress projection. This must look like a noticeably more advanced version of the same person than the current photo, with clear but believable additional improvement beyond 6 months."
      : "Using the uploaded full-body image as base, create a realistic 6-month fitness progress projection. The result should be visibly fitter at a glance than the current photo while remaining plausible and natural.";

  return [
    "Create a realistic simulated future fitness progress portrait from the provided real person photo.",
    `Timeline: ${timeline}.`,
    `Person details: gender=${gender || "not specified"}, age=${age || "not specified"}, height=${height || "not specified"}, weight=${weight || "not specified"}.`,
    `Goal: ${goal || "general fitness improvement"}.`,
    `Workout + Diet Plan: ${planText}.`,
    `Progress consistency context: ${progressText}.`,
    stageInstruction,
    `Expected visible transformation guidance: ${visualChangeGuidance}.`,
    "Identity preservation is strict: preserve face exactly, preserve skin tone exactly, preserve bone structure, preserve height and natural body proportions.",
    "Do not change facial features. Do not change hair. Do not change ethnicity or skin tone. Do not change age. No facial enhancement. No beauty filters.",
    "Keep the same posture, clothing style, and background. Keep pose framing and lighting as close to the original as possible.",
    "The output must not look identical to the source image. The body change should be visible immediately when comparing before and after.",
    "Reduce overall body fat or improve body composition in a realistic way while maintaining natural fat distribution patterns.",
    "Show clearer waist definition, improved midsection tightness, slightly leaner face and neck, and better arm and shoulder definition when plausible for the plan.",
    "If the stated goal includes muscle gain or recomposition, show more athletic shape, stronger shoulders, chest, arms, and legs, and slightly improved posture while keeping proportions realistic.",
    "If the stated goal includes fat loss, show a slimmer waist, reduced lower-belly fullness, leaner arms, and clothing fitting a bit looser, while staying believable.",
    "If the stated goal includes toning or recomposition, show moderate fat loss plus moderate muscle definition so the result looks noticeably more trained.",
    "Improve muscle definition more clearly than before, but do not exaggerate muscle size.",
    "Do not create unrealistic six-pack abs unless body fat is very low.",
    "Maintain natural skin texture, realistic human anatomy, and believable transformation quality.",
    "Show healthy, plausible progress according to timeline, plan, and adherence, not an extreme fitness-model transformation.",
    "Make the 1-year output clearly more transformed than the 6-month output in body composition, muscle tone, and overall fitness look.",
    "Person must remain fully clothed in a normal gym or casual outfit. No swimwear, underwear, lingerie, nudity, cleavage emphasis, or suggestive styling.",
    strictSafety
      ? "Use conservative, non-revealing clothing and avoid shirtless or skin-exposing presentation."
      : "Keep the clothing natural and non-revealing.",
    "Photorealistic output. Non-sexual, non-suggestive. No text overlays, no logos, no watermarks."
  ].join(" ");
}

function buildVisualChangeGuidance({ goal, workoutAdherence, dietAdherence, timelineStage }) {
  const normalizedGoal = (goal || "").toLowerCase();
  const adherenceValues = [workoutAdherence, dietAdherence].filter((value) => value !== null);
  const averageAdherence = adherenceValues.length
    ? adherenceValues.reduce((sum, value) => sum + value, 0) / adherenceValues.length
    : null;

  let intensityText = "moderate visible change";
  if (averageAdherence !== null) {
    if (averageAdherence >= 85) {
      intensityText = timelineStage === "one_year"
        ? "strong but believable visible change"
        : "clear visible change";
    } else if (averageAdherence <= 55) {
      intensityText = "subtle-to-moderate visible change";
    }
  } else if (timelineStage === "one_year") {
    intensityText = "clear visible change";
  }

  if (/muscle|bulk|gain|mass/.test(normalizedGoal)) {
    return `${intensityText} with broader shoulders, firmer arms, improved chest and leg shape, and an overall more athletic build, while keeping the same person and realistic proportions.`;
  }

  if (/fat|lose|loss|slim|weight/.test(normalizedGoal)) {
    return `${intensityText} with a leaner waistline, reduced belly fullness, slimmer arms and face, and clothing fitting slightly looser, while staying realistic.`;
  }

  if (/recomp|tone|toned|definition|defined|athletic/.test(normalizedGoal)) {
    return `${intensityText} with both reduced body fat and more muscle tone, especially around the waist, shoulders, arms, and legs, while remaining natural.`;
  }

  return `${intensityText} with better body composition, a more trained silhouette, improved waist definition, slightly leaner limbs, and a fitter overall appearance.`;
}

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
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing in environment." });
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
    const visualChangeGuidance6m = buildVisualChangeGuidance({
      goal,
      workoutAdherence: normalizedWorkoutAdherence,
      dietAdherence: normalizedDietAdherence,
      timelineStage: "six_months"
    });
    const visualChangeGuidance1y = buildVisualChangeGuidance({
      goal,
      workoutAdherence: normalizedWorkoutAdherence,
      dietAdherence: normalizedDietAdherence,
      timelineStage: "one_year"
    });

    const prompt6m = buildTransformationPrompt({
      gender,
      age,
      height,
      weight,
      goal,
      planText,
      timeline: "6 months",
      timelineStage: "six_months",
      progressText,
      visualChangeGuidance: visualChangeGuidance6m
    });
    const prompt6mStrict = buildTransformationPrompt({
      gender,
      age,
      height,
      weight,
      goal,
      planText,
      timeline: "6 months",
      timelineStage: "six_months",
      progressText,
      visualChangeGuidance: visualChangeGuidance6m,
      strictSafety: true
    });

    const prompt1y = buildTransformationPrompt({
      gender,
      age,
      height,
      weight,
      goal,
      planText,
      timeline: "1 year",
      timelineStage: "one_year",
      progressText,
      visualChangeGuidance: visualChangeGuidance1y
    });
    const prompt1yStrict = buildTransformationPrompt({
      gender,
      age,
      height,
      weight,
      goal,
      planText,
      timeline: "1 year",
      timelineStage: "one_year",
      progressText,
      visualChangeGuidance: visualChangeGuidance1y,
      strictSafety: true
    });

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
