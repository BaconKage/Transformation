# Body Transformation Preview (OpenAI)

This project lets a user:
- take/upload a current photo
- choose a preconfigured workout+diet plan or add a custom plan
- generate AI-based transformation previews for:
  - 6 months
  - 1 year

## 1) Setup

```bash
npm install
```

Create `.env` from `.env.example` and set your key:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
```

## 2) Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## 3) API details

`POST /api/preview` (multipart/form-data)
- `photo` (required image)
- `selectedPlanId` (optional: `beginner_fat_loss`, `lean_muscle_gain`, `athletic_recomp`)
- `customWorkout` (optional)
- `customDiet` (optional)
- additional optional fields: `gender`, `age`, `height`, `weight`, `goal`

Returns:

```json
{
  "sixMonthsImage": "data:image/png;base64,...",
  "oneYearImage": "data:image/png;base64,...",
  "note": "AI output is a simulation, not a guaranteed real-world outcome."
}
```

## Important
- This is a visual simulation, not medical advice or a guaranteed result.
- Ask users for consent before uploading personal photos.
- Add age gating and moderation checks before production use.
