const form = document.getElementById("previewForm");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const loadingEl = document.getElementById("loading");
const img6m = document.getElementById("img6m");
const img1y = document.getElementById("img1y");
const submitBtn = document.getElementById("submitBtn");
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

let cameraStream = null;
let capturedPhotoFile = null;
let currentPreviewUrl = "";
let currentFacingMode = "user";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#4c5568";
}

function setLoading(isLoading, message = "Generating transformation preview...") {
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
    setStatus("Camera opened. Tap Capture when ready.");
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
  setStatus("Photo captured successfully.");
});

cancelCameraBtn.addEventListener("click", async () => {
  await stopCamera();
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
    setStatus("Choose a preconfigured plan or fill a custom workout/diet plan.", true);
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
  setLoading(true, "Generating previews. This can take up to a minute...");

  try {
    const response = await fetch("/api/preview", {
      method: "POST",
      body: data
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to generate previews.");
    }

    img6m.src = payload.sixMonthsImage;
    img1y.src = payload.oneYearImage;
    resultsEl.classList.remove("hidden");
    setLoading(false);
    setStatus(payload.note || "Done.");
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  } finally {
    setLoading(false);
    submitBtn.disabled = false;
  }
});

window.addEventListener("beforeunload", () => {
  stopCamera();
  if (currentPreviewUrl && currentPreviewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(currentPreviewUrl);
  }
});
