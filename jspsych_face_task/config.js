// ---- Settings you may need to edit before going live ----
const CONFIG = {
  // Timings (seconds) -- identical to the PsychoPy version
  LEARN_FIRST_CROSS: 3.0,   // cross before the very first learning face
  LEARN_CROSS: 1.5,         // cross between learning faces
  LEARN_FACE: 3.0,          // each learning face
  TEST_CROSS: 0.5,          // cross before each test face
  N_PREVIEW_FACES: 4,       // faces shown in the "what to expect" preview

  // DataPipe (https://pipe.jspsych.org) experiment ID. Leave '' while testing:
  // the data file will then be DOWNLOADED to the participant's computer instead.
  PIPE_EXPERIMENT_ID: '',

  // SONA completion link. Leave '' to skip the redirect. In SONA, set the study's
  // URL to  https://YOUR-SITE/index.html?sona_id=%SURVEY_CODE%&cond=N  (or cond=HO)
  // and paste SONA's "completion URL" here, ending in survey_code=
  SONA_COMPLETION_URL: '',   // e.g. 'https://cornell.sona-systems.com/webstudy_credit.aspx?experiment_id=123&credit_token=abc&survey_code='

  // Minimum browser window (px). Smaller windows / phones are turned away.
  MIN_WIDTH: 900,
  MIN_HEIGHT: 600,
};
