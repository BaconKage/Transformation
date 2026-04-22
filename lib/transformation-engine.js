function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseNumberFromText(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(String(value).match(/-?\d+(\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseWeightKg(weight) {
  const numeric = parseNumberFromText(weight);
  if (numeric === null) {
    return null;
  }

  return /lb|pound/i.test(String(weight)) ? numeric * 0.453592 : numeric;
}

function parseHeightCm(height) {
  const raw = String(height || "").trim();
  if (!raw) {
    return null;
  }

  const feetMatch = raw.match(/(\d+)\s*(?:'|ft)\s*(\d+)?/i);
  if (feetMatch) {
    const feet = Number(feetMatch[1]);
    const inches = Number(feetMatch[2] || 0);
    return feet * 30.48 + inches * 2.54;
  }

  const numeric = parseNumberFromText(raw);
  if (numeric === null) {
    return null;
  }

  if (/m\b/i.test(raw) && !/cm/i.test(raw)) {
    return numeric * 100;
  }

  return numeric;
}

function getGoalBias(text) {
  const normalized = String(text || "").toLowerCase();
  const mentionsFatLoss = /fat|lose|loss|slim|cut|weight loss|deficit/.test(normalized);
  const mentionsMuscleGain = /bulk|muscle gain|gain muscle|mass|hypertrophy|bigger/.test(normalized);

  if ((mentionsFatLoss && mentionsMuscleGain) || /recomp|tone|toned|definition|defined|athletic|lean/.test(normalized)) {
    return "recomposition";
  }

  if (mentionsMuscleGain) {
    return "muscle_gain";
  }

  if (mentionsFatLoss) {
    return "fat_loss";
  }

  return "general";
}

function getTrainingFactor(workoutText, workoutDaysPerWeek) {
  const normalized = String(workoutText || "").toLowerCase();
  let factor = 0.95;

  if (/hypertrophy|progressive|weights|resistance|strength|lifting|gym/.test(normalized)) {
    factor += 0.18;
  }
  if (/cardio|conditioning|hiit|running|walk|cycling/.test(normalized)) {
    factor += 0.08;
  }
  if (/beginner|starter|basic/.test(normalized)) {
    factor -= 0.04;
  }

  if (workoutDaysPerWeek !== null) {
    if (workoutDaysPerWeek >= 5) {
      factor += 0.16;
    } else if (workoutDaysPerWeek >= 3) {
      factor += 0.08;
    } else if (workoutDaysPerWeek > 0) {
      factor -= 0.08;
    }
  }

  return clamp(factor, 0.65, 1.35);
}

function getDietFactor(dietText) {
  const normalized = String(dietText || "").toLowerCase();
  let factor = 0.95;

  if (/deficit|calorie deficit|high protein|protein|whole foods|low sugar|maintenance/.test(normalized)) {
    factor += 0.16;
  }
  if (/surplus|bulk|carb timing/.test(normalized)) {
    factor += 0.08;
  }
  if (/not provided|none|unclear/.test(normalized)) {
    factor -= 0.1;
  }

  return clamp(factor, 0.7, 1.25);
}

function getAdherenceFactor(workoutAdherence, dietAdherence) {
  const values = [workoutAdherence, dietAdherence].filter((value) => value !== null);
  if (!values.length) {
    return 0.78;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return clamp(average / 100, 0.35, 1);
}

function estimateStartingBodyFat({ weightKg, heightCm, age }) {
  if (!weightKg || !heightCm) {
    return 27;
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const ageAdjustment = age ? clamp((age - 30) * 0.08, -1.2, 2) : 0;
  return clamp(18 + (bmi - 22) * 1.45 + ageAdjustment, 14, 38);
}

export function createTransformationScore({
  age,
  weight,
  height,
  workoutType,
  diet,
  durationMonths = 6,
  workoutDaysPerWeek = null,
  workoutAdherence = null,
  dietAdherence = null,
  goal = ""
}) {
  const normalizedAge = parseNumberFromText(age);
  const weightKg = parseWeightKg(weight);
  const heightCm = parseHeightCm(height);
  const months = clamp(Number(durationMonths) || 6, 1, 24);
  const adherenceFactor = getAdherenceFactor(workoutAdherence, dietAdherence);
  const trainingFactor = getTrainingFactor(workoutType, workoutDaysPerWeek);
  const dietFactor = getDietFactor(diet);
  const goalBias = getGoalBias(`${goal} ${workoutType} ${diet}`);
  const currentBodyFat = estimateStartingBodyFat({ weightKg, heightCm, age: normalizedAge });

  let fatLossRate = 0.55;
  let muscleGainRate = 0.18;

  if (goalBias === "fat_loss") {
    fatLossRate += 0.3;
    muscleGainRate -= 0.04;
  } else if (goalBias === "muscle_gain") {
    fatLossRate -= 0.16;
    muscleGainRate += 0.22;
  } else if (goalBias === "recomposition") {
    fatLossRate += 0.16;
    muscleGainRate += 0.12;
  }

  const ageFactor = normalizedAge && normalizedAge > 45 ? 0.9 : 1;
  const weightFactor = weightKg ? clamp(weightKg / 78, 0.75, 1.25) : 1;
  const fatLossKg = fatLossRate * months * adherenceFactor * dietFactor * weightFactor;
  const muscleGainKg = muscleGainRate * months * adherenceFactor * trainingFactor * ageFactor;
  const bodyFatPercentChange = -1 * ((fatLossKg / (weightKg || 78)) * 100 + muscleGainKg * 0.18);
  const startingFitnessScore = clamp(
    42 + (22 - Math.max(currentBodyFat - 18, 0)) * 0.65 + (adherenceFactor - 0.6) * 12,
    35,
    72
  );
  const progressScore = fatLossKg * 1.4 + muscleGainKg * 2.2 + Math.abs(bodyFatPercentChange) * 1.1;
  const consistencyScore = adherenceFactor * 5 + (trainingFactor - 1) * 4 + (dietFactor - 1) * 4;
  const overallFitnessScore = clamp(startingFitnessScore + progressScore + consistencyScore, 0, 92);

  return {
    fat_loss_kg: round(fatLossKg),
    muscle_gain_kg: round(muscleGainKg),
    body_fat_percent_change: round(bodyFatPercentChange),
    overall_fitness_score: Math.round(overallFitnessScore),
    inputs: {
      age: normalizedAge,
      weight_kg: weightKg === null ? null : round(weightKg),
      height_cm: heightCm === null ? null : round(heightCm),
      duration_months: months,
      goal_bias: goalBias
    }
  };
}

export function createBodyMap(transformationScore) {
  const fatLoss = transformationScore.fat_loss_kg;
  const muscleGain = transformationScore.muscle_gain_kg;
  const bodyFatDrop = Math.abs(transformationScore.body_fat_percent_change);
  const score = transformationScore.overall_fitness_score;

  return {
    face: fatLoss >= 3 || bodyFatDrop >= 3 ? "leaner" : muscleGain > fatLoss + 1.5 ? "fuller" : "leaner",
    waist: fatLoss >= 4 || bodyFatDrop >= 3 ? "reduced" : fatLoss <= 1 && muscleGain >= 3 ? "same" : "reduced",
    arms: muscleGain >= 3 ? "muscular" : muscleGain >= 1 || score >= 62 ? "toned" : "unchanged",
    chest: muscleGain >= 3 ? "bigger" : muscleGain >= 1.2 || score >= 64 ? "defined" : "unchanged",
    posture: score >= 58 || muscleGain >= 1 ? "improved" : "same"
  };
}

export function buildStructuredTransformationPrompt({
  userProfile,
  transformationScore,
  bodyMap,
  timeline,
  timelineStage,
  planText,
  progressText,
  strictSafety = false
}) {
  const bodyFatChange = Math.abs(transformationScore.body_fat_percent_change);
  const muscleDefinitionLevel =
    transformationScore.muscle_gain_kg >= 3 || transformationScore.overall_fitness_score >= 78
      ? "high but natural"
      : transformationScore.muscle_gain_kg >= 1.2 || transformationScore.overall_fitness_score >= 62
        ? "moderate and clearly visible"
        : "subtle but visible";
  const physiqueType =
    transformationScore.inputs.goal_bias === "muscle_gain"
      ? "lean athletic muscle-gain physique"
      : transformationScore.inputs.goal_bias === "fat_loss"
        ? "leaner fat-loss physique"
        : "athletic body-recomposition physique";
  const realismLevel =
    transformationScore.overall_fitness_score >= 82
      ? "ambitious but still biologically plausible"
      : "realistic, healthy, and non-extreme";
  const stageInstruction =
    timelineStage === "one_year"
      ? "Use the uploaded 6-month result as the base and render a realistic 1-year progression with additional visible improvement."
      : "Use the uploaded current full-body photo as the base and render a realistic 6-month progression.";

  return [
    "Create a photorealistic simulated future fitness progress portrait from the provided real person photo.",
    `Timeline: ${timeline}.`,
    `Person details: gender=${userProfile.gender || "not specified"}, age=${userProfile.age || "not specified"}, height=${userProfile.height || "not specified"}, weight=${userProfile.weight || "not specified"}.`,
    `Plan context: ${planText}`,
    `Progress consistency context: ${progressText}`,
    stageInstruction,
    `Transformation metrics: fat_loss_kg=${transformationScore.fat_loss_kg}, muscle_gain_kg=${transformationScore.muscle_gain_kg}, body_fat_percent_change=${transformationScore.body_fat_percent_change}, overall_fitness_score=${transformationScore.overall_fitness_score}.`,
    `Body-region map: face=${bodyMap.face}, waist=${bodyMap.waist}, arms=${bodyMap.arms}, chest=${bodyMap.chest}, posture=${bodyMap.posture}.`,
    `Body fat distribution changes: show ${round(bodyFatChange)} percentage points less visible body fat, with reduction concentrated around waist, lower belly, neck/face softness, and limb softness where anatomically plausible.`,
    `Muscle definition level: ${muscleDefinitionLevel}; show definition through shoulders, arms, chest, waistline, and legs according to the body-region map.`,
    `Physique type: ${physiqueType}.`,
    `Realism level: ${realismLevel}; no extreme fitness-model body, no impossible anatomy, no exaggerated abs unless the body-fat reduction supports it.`,
    "Identity preservation is strict: preserve face identity, skin tone, bone structure, height, age, hair, ethnicity, and natural proportions.",
    "Keep pose framing, background, clothing style, and lighting close to the input image while making the body-composition change visible.",
    strictSafety
      ? "Use conservative, fully clothed, non-revealing clothing. Avoid shirtless, swimwear, underwear, lingerie, cleavage emphasis, or suggestive styling."
      : "Person must remain fully clothed in normal gym or casual clothing. Non-sexual, non-suggestive styling only.",
    "No text overlays, no logos, no watermarks."
  ].join(" ");
}

export function createTransformationSummary({ timeline, transformationScore, bodyMap }) {
  return `${timeline}: projected ${transformationScore.fat_loss_kg} kg fat loss, ${transformationScore.muscle_gain_kg} kg muscle gain, ${Math.abs(transformationScore.body_fat_percent_change)} percentage-point body-fat reduction, and fitness score ${transformationScore.overall_fitness_score}/100. Expected visible changes: ${bodyMap.face} face, ${bodyMap.waist} waist, ${bodyMap.arms} arms, ${bodyMap.chest} chest, and ${bodyMap.posture} posture.`;
}

export function createTransformationProjection(input) {
  const transformationScore = createTransformationScore(input);
  const bodyMap = createBodyMap(transformationScore);

  return {
    transformation_score: transformationScore,
    body_map: bodyMap,
    transformation_summary: createTransformationSummary({
      timeline: `${transformationScore.inputs.duration_months} months`,
      transformationScore,
      bodyMap
    })
  };
}
