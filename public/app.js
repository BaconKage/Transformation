const form = document.getElementById("previewForm");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const loadingEl = document.getElementById("loading");
const transformationDataEl = document.getElementById("transformationData");
const transformationSummaryEl = document.getElementById("transformationSummary");
const metricsGridEl = document.getElementById("metricsGrid");
const img6m = document.getElementById("img6m");
const img1y = document.getElementById("img1y");
const before6m = document.getElementById("before6m");
const before1y = document.getElementById("before1y");
const submitBtn = document.getElementById("submitBtn");
const compareRange6m = document.getElementById("compareRange6m");
const compareRange1y = document.getElementById("compareRange1y");
const compareAfterWrap6m = document.getElementById("compareAfterWrap6m");
const compareAfterWrap1y = document.getElementById("compareAfterWrap1y");
const socialFormat6m = document.getElementById("socialFormat6m");
const socialFormat1y = document.getElementById("socialFormat1y");
const socialPreviewWrap6m = document.getElementById("socialPreviewWrap6m");
const socialPreviewWrap1y = document.getElementById("socialPreviewWrap1y");
const socialPreview6m = document.getElementById("socialPreview6m");
const socialPreview1y = document.getElementById("socialPreview1y");
const generateSocial6m = document.getElementById("generateSocial6m");
const generateSocial1y = document.getElementById("generateSocial1y");
const downloadSocial6m = document.getElementById("downloadSocial6m");
const downloadSocial1y = document.getElementById("downloadSocial1y");
const shareSocial6m = document.getElementById("shareSocial6m");
const shareSocial1y = document.getElementById("shareSocial1y");
const photoInput = document.getElementById("photo");
const uploadBtn = document.getElementById("uploadBtn");
const openCameraBtn = document.getElementById("openCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const cancelCameraBtn = document.getElementById("cancelCameraBtn");
const cameraFacing = document.getElementById("cameraFacing");
const cameraWrap = document.getElementById("cameraWrap");
const cameraFeed = document.getElementById("cameraFeed");
const previewWrap = document.getElementById("previewWrap");
const selectedPreview = document.getElementById("selectedPreview");
const selectedPlanIdInput = document.getElementById("selectedPlanId");
const goalInput = document.getElementById("goalInput");
const planChoiceButtons = document.querySelectorAll(".plan-choice");
const goalChoiceButtons = document.querySelectorAll(".goal-choice");

let cameraStream = null;
let capturedPhotoFile = null;
let currentPreviewUrl = "";
let currentFacingMode = "user";
const socialAssets = {
  sixMonths: null,
  oneYear: null
};

function initializeView() {
  setLoading(false);
  resultsEl.classList.add("hidden");
  transformationDataEl.classList.add("hidden");
  cameraWrap.classList.add("hidden");
  previewWrap.classList.add("hidden");
  socialPreviewWrap6m.classList.add("hidden");
  socialPreviewWrap1y.classList.add("hidden");
  statusEl.textContent = "";
  syncPlanChoiceState();
  syncGoalChoiceState();
}

function setSelectedButton(buttons, selectedButton) {
  buttons.forEach((button) => {
    button.classList.toggle("is-selected", button === selectedButton);
  });
}

function syncPlanChoiceState() {
  const selected = Array.from(planChoiceButtons).find((button) => button.dataset.plan === selectedPlanIdInput.value);
  setSelectedButton(planChoiceButtons, selected || null);
}

function syncGoalChoiceState() {
  const selected = Array.from(goalChoiceButtons).find((button) => button.dataset.goal === goalInput.value);
  setSelectedButton(goalChoiceButtons, selected || null);
}

function formatMetricValue(value, suffix = "") {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }
  return `${value}${suffix}`;
}

function renderTransformationData(payload) {
  const metrics = payload.metricsUsed;
  if (!metrics) {
    transformationDataEl.classList.add("hidden");
    transformationSummaryEl.textContent = "";
    metricsGridEl.innerHTML = "";
    return;
  }

  const sixMonths = metrics.six_months || {};
  const oneYear = metrics.one_year || {};
  const projectionGroups = [
    ["6 months", sixMonths],
    ["1 year", oneYear]
  ];

  transformationSummaryEl.textContent = "Built from your photo, goal, plan, and consistency details.";
  metricsGridEl.innerHTML = "";
  for (const [title, groupMetrics] of projectionGroups) {
    const group = document.createElement("section");
    group.className = "metric-group";

    const heading = document.createElement("h3");
    heading.textContent = title;

    const list = document.createElement("div");
    list.className = "metric-list";

    const metricRows = [
      ["Fat loss", formatMetricValue(groupMetrics.fat_loss_kg, " kg")],
      ["Muscle gain", formatMetricValue(groupMetrics.muscle_gain_kg, " kg")],
      ["Body fat", formatMetricValue(groupMetrics.body_fat_percent_change, "%")],
      ["Fitness score", `${formatMetricValue(groupMetrics.overall_fitness_score, "")}/100`]
    ];

    for (const [label, value] of metricRows) {
      const card = document.createElement("div");
      card.className = "metric-card";

      const labelEl = document.createElement("span");
      labelEl.textContent = label;

      const valueEl = document.createElement("strong");
      valueEl.textContent = value;

      card.append(labelEl, valueEl);
      list.appendChild(card);
    }

    group.append(heading, list);
    metricsGridEl.appendChild(group);
  }

  transformationDataEl.classList.remove("hidden");
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#4c5568";
}

function setComparePosition(rangeInput, afterWrap) {
  const value = Number(rangeInput.value);
  afterWrap.style.width = `${value}%`;
}

function clearSocialAsset(key, previewEl, wrapEl, downloadBtnEl, shareBtnEl) {
  const existing = socialAssets[key];
  if (existing?.objectUrl) {
    URL.revokeObjectURL(existing.objectUrl);
  }
  socialAssets[key] = null;
  previewEl.removeAttribute("src");
  wrapEl.classList.add("hidden");
  downloadBtnEl.classList.add("hidden");
  shareBtnEl.classList.add("hidden");
}

function setLoading(isLoading, message = "Creating your transformation...") {
  if (isLoading) {
    loadingEl.classList.remove("hidden");
    statusEl.classList.add("hidden");
    setStatus(message);
  } else {
    loadingEl.classList.add("hidden");
    statusEl.classList.remove("hidden");
  }
}

function setPreview(url) {
  if (currentPreviewUrl && currentPreviewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(currentPreviewUrl);
  }
  currentPreviewUrl = url;
  selectedPreview.src = url;
  previewWrap.classList.remove("hidden");
}

function setBeforeAndAfterSources(after6mUrl, after1yUrl, beforeUrl) {
  before6m.src = beforeUrl;
  before1y.src = beforeUrl;
  img6m.src = after6mUrl;
  img1y.src = after1yUrl;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image for export."));
    image.src = src;
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCoverImage(ctx, image, x, y, width, height, radius = 0) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;

  ctx.save();
  if (radius > 0) {
    roundRect(ctx, x, y, width, height, radius);
    ctx.clip();
  }
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();
}

function fillGradientBackground(ctx, width, height) {
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#050505");
  base.addColorStop(0.52, "#11100e");
  base.addColorStop(1, "#070604");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const glowLeft = ctx.createRadialGradient(width * 0.12, height * 0.1, 10, width * 0.12, height * 0.1, width * 0.48);
  glowLeft.addColorStop(0, "rgba(201, 107, 34, 0.2)");
  glowLeft.addColorStop(1, "rgba(201, 107, 34, 0)");
  ctx.fillStyle = glowLeft;
  ctx.fillRect(0, 0, width, height);

  const glowRight = ctx.createRadialGradient(width * 0.88, height * 0.18, 10, width * 0.88, height * 0.18, width * 0.38);
  glowRight.addColorStop(0, "rgba(241, 135, 45, 0.12)");
  glowRight.addColorStop(1, "rgba(241, 135, 45, 0)");
  ctx.fillStyle = glowRight;
  ctx.fillRect(0, 0, width, height);

}

function drawLabelPill(ctx, text, x, y) {
  ctx.font = "700 30px Sora, Arial, sans-serif";
  const metrics = ctx.measureText(text);
  const padX = 26;
  const height = 58;
  const width = metrics.width + padX * 2;
  ctx.save();
  ctx.fillStyle = "rgba(10, 10, 10, 0.8)";
  roundRect(ctx, x, y, width, height, 29);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 189, 138, 0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff6eb";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + height / 2);
  ctx.restore();
}

function drawOutlinedCard(ctx, x, y, width, height, radius, fillStyle, strokeStyle) {
  ctx.save();
  ctx.fillStyle = fillStyle;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawBrandBadge(ctx, x, y, brandName) {
  ctx.save();
  const badgeWidth = 252;
  const badgeHeight = 82;
  ctx.fillStyle = "rgba(201, 107, 34, 0.14)";
  roundRect(ctx, x, y, badgeWidth, badgeHeight, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(241, 135, 45, 0.48)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(245, 239, 230, 0.72)";
  ctx.font = "800 18px Sora, Arial, sans-serif";
  ctx.fillText("FIT CHECK", x + 22, y + 29);
  ctx.font = "800 34px Sora, Arial, sans-serif";
  ctx.fillStyle = "#f5efe6";
  ctx.fillText(brandName, x + 22, y + 66);
  ctx.restore();
}

function drawArrowConnector(ctx, x, y, width) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.beginPath();
  ctx.moveTo(x + width, y);
  ctx.lineTo(x + width - 26, y - 16);
  ctx.lineTo(x + width - 26, y + 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount += 1;
      if (lineCount >= maxLines) {
        return;
      }
    } else {
      line = testLine;
    }
  }

  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
  }
}

async function createSocialComparison({ beforeSrc, afterSrc, timelineLabel, format }) {
  const size = format === "story"
    ? { width: 1080, height: 1920, imageHeight: 760, gap: 34, sidePad: 58, topPad: 108 }
    : { width: 1080, height: 1350, imageHeight: 590, gap: 30, sidePad: 52, topPad: 64 };

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");

  fillGradientBackground(ctx, size.width, size.height);

  const outerX = 20;
  const outerY = 20;
  const outerWidth = size.width - 40;
  const outerHeight = size.height - 40;
  drawOutlinedCard(ctx, outerX, outerY, outerWidth, outerHeight, 42, "rgba(8, 8, 7, 0.62)", "rgba(245, 239, 230, 0.16)");

  drawBrandBadge(ctx, size.sidePad, size.topPad - 12, "MY GYM");

  ctx.fillStyle = "#f5efe6";
  ctx.font = format === "story" ? "900 82px Sora, Arial, sans-serif" : "900 64px Sora, Arial, sans-serif";
  ctx.fillText("Quiet progress.", size.sidePad, size.topPad + 150);

  ctx.fillStyle = "#a8a096";
  ctx.font = format === "story" ? "600 34px Sora, Arial, sans-serif" : "600 28px Sora, Arial, sans-serif";
  ctx.fillText(`Current vs projected ${timelineLabel.toLowerCase()} progress`, size.sidePad, size.topPad + (format === "story" ? 208 : 198));

  const cardY = size.topPad + (format === "story" ? 300 : 258);
  const cardWidth = (size.width - size.sidePad * 2 - size.gap) / 2;
  const cardRadius = 32;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
  ctx.shadowBlur = 58;
  ctx.shadowOffsetY = 26;
  ctx.fillStyle = "rgba(17, 16, 14, 0.92)";
  roundRect(ctx, size.sidePad, cardY, cardWidth, size.imageHeight, cardRadius);
  ctx.fill();
  roundRect(ctx, size.sidePad + cardWidth + size.gap, cardY, cardWidth, size.imageHeight, cardRadius);
  ctx.fill();
  ctx.restore();

  const [beforeImage, afterImage] = await Promise.all([loadImage(beforeSrc), loadImage(afterSrc)]);
  drawCoverImage(ctx, beforeImage, size.sidePad, cardY, cardWidth, size.imageHeight, cardRadius);
  drawCoverImage(ctx, afterImage, size.sidePad + cardWidth + size.gap, cardY, cardWidth, size.imageHeight, cardRadius);

  ctx.strokeStyle = "rgba(245, 239, 230, 0.24)";
  ctx.lineWidth = 3;
  roundRect(ctx, size.sidePad, cardY, cardWidth, size.imageHeight, cardRadius);
  ctx.stroke();
  roundRect(ctx, size.sidePad + cardWidth + size.gap, cardY, cardWidth, size.imageHeight, cardRadius);
  ctx.stroke();

  drawArrowConnector(ctx, size.width / 2 - 48, cardY + size.imageHeight / 2, 96);
  drawLabelPill(ctx, "NOW", size.sidePad + 24, cardY + 24);
  drawLabelPill(ctx, timelineLabel.toUpperCase(), size.sidePad + cardWidth + size.gap + 24, cardY + 24);

  const footerY = cardY + size.imageHeight + (format === "story" ? 72 : 54);
  const footerHeight = format === "story" ? 300 : 218;
  drawOutlinedCard(
    ctx,
    size.sidePad,
    footerY,
    size.width - size.sidePad * 2,
    footerHeight,
    34,
    "rgba(17, 16, 14, 0.82)",
    "rgba(245, 239, 230, 0.16)"
  );

  ctx.fillStyle = "#f5efe6";
  ctx.font = format === "story" ? "700 44px Sora, Arial, sans-serif" : "700 36px Sora, Arial, sans-serif";
  ctx.fillText("Transformation preview", size.sidePad + 34, footerY + 72);

  ctx.fillStyle = "#a8a096";
  ctx.font = format === "story" ? "500 28px Sora, Arial, sans-serif" : "500 24px Sora, Arial, sans-serif";
  drawWrappedText(
    ctx,
    "A personalized visual estimate. Real progress depends on consistency, training, nutrition, and recovery.",
    size.sidePad + 34,
    footerY + 126,
    size.width - size.sidePad * 2 - 68,
    format === "story" ? 42 : 34,
    2
  );

  ctx.fillStyle = "#f1872d";
  ctx.font = format === "story" ? "800 30px Sora, Arial, sans-serif" : "800 26px Sora, Arial, sans-serif";
  ctx.fillText(format === "story" ? "READY FOR STORIES" : "READY FOR THE FEED", size.sidePad + 34, footerY + footerHeight - 36);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not create export image."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function renderSocialAsset({
  key,
  beforeSrc,
  afterSrc,
  timelineLabel,
  formatSelect,
  previewEl,
  wrapEl,
  downloadBtnEl,
  shareBtnEl
}) {
  clearSocialAsset(key, previewEl, wrapEl, downloadBtnEl, shareBtnEl);
  const blob = await createSocialComparison({
    beforeSrc,
    afterSrc,
    timelineLabel,
    format: formatSelect.value
  });
  const objectUrl = URL.createObjectURL(blob);
  const safeTimeline = timelineLabel.toLowerCase().replace(/\s+/g, "-");
  const filename = `my-gym-${safeTimeline}-${formatSelect.value}.png`;

  socialAssets[key] = {
    blob,
    objectUrl,
    filename
  };

  previewEl.src = objectUrl;
  wrapEl.classList.remove("hidden");
  downloadBtnEl.classList.remove("hidden");
  shareBtnEl.classList.toggle("hidden", !(navigator.share && navigator.canShare));
}

function downloadSocialAsset(key) {
  const asset = socialAssets[key];
  if (!asset) {
    setStatus("Create the share image first.", true);
    return;
  }
  const anchor = document.createElement("a");
  anchor.href = asset.objectUrl;
  anchor.download = asset.filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
  }, 0);
}

async function shareSocialAsset(key, timelineLabel) {
  const asset = socialAssets[key];
  if (!asset) {
    setStatus("Create the share image first.", true);
    return;
  }
  if (!navigator.share || !navigator.canShare) {
    setStatus("Share is not available here. Download the image and post it on Instagram.", true);
    return;
  }

  const file = new File([asset.blob], asset.filename, { type: "image/png" });
  if (!navigator.canShare({ files: [file] })) {
    setStatus("Sharing this file is not supported on this device. Download it instead.", true);
    return;
  }

  await navigator.share({
    files: [file],
    title: `My Gym ${timelineLabel} transformation`,
    text: `Current vs projected ${timelineLabel.toLowerCase()} transformation`
  });
}

compareRange6m.addEventListener("input", () => {
  setComparePosition(compareRange6m, compareAfterWrap6m);
});

compareRange1y.addEventListener("input", () => {
  setComparePosition(compareRange1y, compareAfterWrap1y);
});

async function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraFeed.srcObject = null;
  cameraWrap.classList.add("hidden");
}

async function startCamera(facingMode) {
  await stopCamera();
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facingMode } },
    audio: false
  });
  cameraFeed.srcObject = cameraStream;
  cameraWrap.classList.remove("hidden");
}

uploadBtn.addEventListener("click", () => {
  photoInput.click();
});

photoInput.addEventListener("change", async () => {
  if (!photoInput.files || !photoInput.files[0]) {
    return;
  }
  capturedPhotoFile = null;
  await stopCamera();
  setPreview(URL.createObjectURL(photoInput.files[0]));
});

openCameraBtn.addEventListener("click", async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Camera not supported here. Please use Upload Photo.", true);
    return;
  }
  try {
    currentFacingMode = cameraFacing.value || "user";
    await startCamera(currentFacingMode);
    setStatus("Camera is ready. Tap Use Photo when it looks good.");
  } catch (error) {
    setStatus("Could not open camera. Please allow permission or use Upload Photo.", true);
  }
});

cameraFacing.addEventListener("change", async () => {
  currentFacingMode = cameraFacing.value || "user";
  if (!cameraStream) {
    return;
  }
  try {
    await startCamera(currentFacingMode);
    setStatus(`Switched to ${currentFacingMode === "user" ? "selfie" : "back"} camera.`);
  } catch {
    setStatus("Could not switch camera on this device.", true);
  }
});

captureBtn.addEventListener("click", async () => {
  if (!cameraStream) {
    return;
  }
  const width = cameraFeed.videoWidth || 720;
  const height = cameraFeed.videoHeight || 960;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraFeed, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) {
    setStatus("Capture failed. Try again.", true);
    return;
  }

  capturedPhotoFile = new File([blob], "captured-photo.jpg", { type: "image/jpeg" });
  photoInput.value = "";
  await stopCamera();
  setPreview(URL.createObjectURL(capturedPhotoFile));
    setStatus("Photo added.");
});

cancelCameraBtn.addEventListener("click", async () => {
  await stopCamera();
});

planChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedPlanIdInput.value = button.dataset.plan || "";
    syncPlanChoiceState();
  });
});

goalChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    goalInput.value = button.dataset.goal || "";
    syncGoalChoiceState();
  });
});

selectedPlanIdInput.addEventListener("change", syncPlanChoiceState);
goalInput.addEventListener("input", syncGoalChoiceState);

generateSocial6m.addEventListener("click", async () => {
  if (!before6m.src || !img6m.src) {
    setStatus("Create your preview first.", true);
    return;
  }
  try {
    setStatus("Creating your 6-month share image...");
    await renderSocialAsset({
      key: "sixMonths",
      beforeSrc: before6m.src,
      afterSrc: img6m.src,
      timelineLabel: "6 Months",
      formatSelect: socialFormat6m,
      previewEl: socialPreview6m,
      wrapEl: socialPreviewWrap6m,
      downloadBtnEl: downloadSocial6m,
      shareBtnEl: shareSocial6m
    });
    setStatus("6-month share image is ready.");
  } catch (error) {
    setStatus(error.message || "Could not create the share image.", true);
  }
});

generateSocial1y.addEventListener("click", async () => {
  if (!before1y.src || !img1y.src) {
    setStatus("Create your preview first.", true);
    return;
  }
  try {
    setStatus("Creating your 1-year share image...");
    await renderSocialAsset({
      key: "oneYear",
      beforeSrc: before1y.src,
      afterSrc: img1y.src,
      timelineLabel: "1 Year",
      formatSelect: socialFormat1y,
      previewEl: socialPreview1y,
      wrapEl: socialPreviewWrap1y,
      downloadBtnEl: downloadSocial1y,
      shareBtnEl: shareSocial1y
    });
    setStatus("1-year share image is ready.");
  } catch (error) {
    setStatus(error.message || "Could not create the share image.", true);
  }
});

socialFormat6m.addEventListener("change", () => {
  clearSocialAsset("sixMonths", socialPreview6m, socialPreviewWrap6m, downloadSocial6m, shareSocial6m);
});

socialFormat1y.addEventListener("change", () => {
  clearSocialAsset("oneYear", socialPreview1y, socialPreviewWrap1y, downloadSocial1y, shareSocial1y);
});

downloadSocial6m.addEventListener("click", () => {
  downloadSocialAsset("sixMonths");
});

downloadSocial1y.addEventListener("click", () => {
  downloadSocialAsset("oneYear");
});

shareSocial6m.addEventListener("click", async () => {
  try {
    await shareSocialAsset("sixMonths", "6 Months");
  } catch (error) {
    if (error?.name !== "AbortError") {
      setStatus(error.message || "Could not share the image.", true);
    }
  }
});

shareSocial1y.addEventListener("click", async () => {
  try {
    await shareSocialAsset("oneYear", "1 Year");
  } catch (error) {
    if (error?.name !== "AbortError") {
      setStatus(error.message || "Could not share the image.", true);
    }
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const selectedPlanId = data.get("selectedPlanId");
  const customWorkout = (data.get("customWorkout") || "").toString().trim();
  const customDiet = (data.get("customDiet") || "").toString().trim();
  const workoutDaysPerWeek = Number((data.get("workoutDaysPerWeek") || "").toString());
  const workoutAdherence = Number((data.get("workoutAdherence") || "").toString());
  const dietAdherence = Number((data.get("dietAdherence") || "").toString());
  const weeksOnPlan = Number((data.get("weeksOnPlan") || "").toString());

  if (!selectedPlanId && !customWorkout && !customDiet) {
    setStatus("Choose a plan or add your own workout and diet.", true);
    return;
  }
  if (!Number.isNaN(workoutDaysPerWeek) && workoutDaysPerWeek !== 0 && (workoutDaysPerWeek < 0 || workoutDaysPerWeek > 14)) {
    setStatus("Workout days per week must be between 0 and 14.", true);
    return;
  }
  if (!Number.isNaN(workoutAdherence) && workoutAdherence !== 0 && (workoutAdherence < 0 || workoutAdherence > 100)) {
    setStatus("Workout adherence must be between 0 and 100.", true);
    return;
  }
  if (!Number.isNaN(dietAdherence) && dietAdherence !== 0 && (dietAdherence < 0 || dietAdherence > 100)) {
    setStatus("Diet adherence must be between 0 and 100.", true);
    return;
  }
  if (!Number.isNaN(weeksOnPlan) && weeksOnPlan !== 0 && (weeksOnPlan < 0 || weeksOnPlan > 520)) {
    setStatus("Weeks on plan must be between 0 and 520.", true);
    return;
  }

  const uploadedFile = photoInput.files?.[0];
  const finalPhoto = capturedPhotoFile || uploadedFile;
  if (!finalPhoto) {
    setStatus("Please upload a photo or take one now.", true);
    return;
  }
  data.set("photo", finalPhoto);

  submitBtn.disabled = true;
  resultsEl.classList.add("hidden");
  transformationDataEl.classList.add("hidden");
  clearSocialAsset("sixMonths", socialPreview6m, socialPreviewWrap6m, downloadSocial6m, shareSocial6m);
  clearSocialAsset("oneYear", socialPreview1y, socialPreviewWrap1y, downloadSocial1y, shareSocial1y);
  setComparePosition(compareRange6m, compareAfterWrap6m);
  setComparePosition(compareRange1y, compareAfterWrap1y);
  setLoading(true, "Creating your transformation. This can take about a minute...");

  try {
    const response = await fetch("/api/preview", {
      method: "POST",
      body: data
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not create your preview.");
    }

    renderTransformationData(payload);
    if (payload.sixMonthsImage && payload.oneYearImage) {
      setBeforeAndAfterSources(payload.sixMonthsImage, payload.oneYearImage, selectedPreview.src);
      resultsEl.classList.remove("hidden");
    }
    setLoading(false);
    setStatus(payload.note || "Your preview is ready.");
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  } finally {
    setLoading(false);
    submitBtn.disabled = false;
  }
});

window.addEventListener("beforeunload", () => {
  stopCamera();
  clearSocialAsset("sixMonths", socialPreview6m, socialPreviewWrap6m, downloadSocial6m, shareSocial6m);
  clearSocialAsset("oneYear", socialPreview1y, socialPreviewWrap1y, downloadSocial1y, shareSocial1y);
  if (currentPreviewUrl && currentPreviewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(currentPreviewUrl);
  }
});

initializeView();
