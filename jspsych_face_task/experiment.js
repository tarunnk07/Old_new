// Old/New Face Recognition Task -- jsPsych (online) version
// Neutral (N) vs Smiling (HO) is set by the link:  index.html?cond=N  or  ?cond=HO
// (if cond is missing, one is picked at random and logged as condition_source = "random").
// SONA: index.html?sona_id=%SURVEY_CODE%&cond=N
// Differences from the PsychoPy lab version: NO practice round, participants are NOT told about the
// test phase in advance, and a short preview of 4 faces (no response) shows them what to expect.

(async function () {
  const EXPERIMENT_VERSION_BASE = 'web-1.0';
  const params = new URLSearchParams(window.location.search);
  const DEV = params.get('dev') === '1';          // dev=1 shrinks all durations x0.05 -- for TESTING ONLY
  const TIME_SCALE = DEV ? 0.05 : 1;
  const ms = (s) => Math.max(1, Math.round(s * 1000 * TIME_SCALE));

  const jsPsych = initJsPsych({
    on_finish: () => {
      finished = true;
      document.body.classList.remove('trial-cursor-hidden');
      if (CONFIG.SONA_COMPLETION_URL && !DEV) {
        const code = encodeURIComponent(jsPsych.data.get().values()[0]?.sona_id || '');
        window.location.href = CONFIG.SONA_COMPLETION_URL + code;
      }
    },
  });
  let finished = false;
  window.addEventListener('beforeunload', (e) => { if (!finished) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- seed, condition, participant id from URL ----------
  const seed = Math.floor(Math.random() * 1000000);
  jsPsych.randomization.setSeed(seed);
  let condition = params.get('cond');
  let conditionSource = 'url';
  if (condition !== 'N' && condition !== 'HO') {
    condition = jsPsych.randomization.sampleWithoutReplacement(['N', 'HO'], 1)[0];
    conditionSource = 'random';
  }
  const version = `${EXPERIMENT_VERSION_BASE}-${condition}${DEV ? '-DEV' : ''}`;
  const sonaFromUrl = params.get('sona_id') || params.get('id') || '';
  const startTime = new Date();
  const stamp = startTime.toISOString().replace(/[:.]/g, '-');

  jsPsych.data.addProperties({
    condition, condition_source: conditionSource, experiment_version: version, random_seed: seed,
    timing_scale: TIME_SCALE, session_start_time: startTime.toISOString(), user_agent: navigator.userAgent,
  });

  // ---------- stimuli ----------
  let manifest;
  try {
    manifest = await (await fetch('stimuli_manifest.json')).json();
  } catch (err) {
    document.body.innerHTML = '<p style="padding:2em">Could not load the stimulus list (stimuli_manifest.json). ' +
      'If you opened this file directly, run a local web server instead (see README).</p>';
    return;
  }
  const img = (e) => e[condition];
  const shuffle = (a) => jsPsych.randomization.shuffle(a);

  const learningSet = shuffle(manifest.learning);
  const testList = shuffle([
    ...manifest.learning.map((e) => ({ ...e, ground_truth: 'old' })),
    ...manifest.test.map((e) => ({ ...e, ground_truth: 'new' })),
  ]);
  // preview: a few extra identities (never used again), balanced by sex when possible
  const pool = manifest.practice;
  const males = shuffle(pool.filter((e) => e.sex === 'M')), females = shuffle(pool.filter((e) => e.sex === 'F'));
  const half = Math.floor(CONFIG.N_PREVIEW_FACES / 2);
  let previewSet = [...males.slice(0, half), ...females.slice(0, half)];
  const leftover = shuffle(pool.filter((e) => !previewSet.includes(e)));
  previewSet = shuffle([...previewSet, ...leftover.slice(0, CONFIG.N_PREVIEW_FACES - previewSet.length)]);

  const nLearn = learningSet.length;
  const learnSec = CONFIG.LEARN_FIRST_CROSS + nLearn * CONFIG.LEARN_FACE + (nLearn - 1) * CONFIG.LEARN_CROSS;
  const learnMin = Math.max(1, Math.ceil(learnSec / 60));
  const faceSec = +CONFIG.LEARN_FACE;

  const imageHeight = () => Math.round(window.innerHeight * 0.5);   // 50% of window height, aspect kept
  const base = (name) => name.split('/').pop();

  // ---------- trial builders ----------
  const cross = (seconds, data) => ({
    type: jsPsychHtmlKeyboardResponse, stimulus: '<div class="cross">+</div>', choices: 'NO_KEYS',
    trial_duration: ms(seconds), data: { phase: 'fixation', ...data },
  });
  const learningFace = (e, phase, i, crossSec) => ({
    type: jsPsychImageKeyboardResponse, stimulus: img(e), choices: 'NO_KEYS', render_on_canvas: false,
    stimulus_height: imageHeight, stimulus_duration: ms(CONFIG.LEARN_FACE), trial_duration: ms(CONFIG.LEARN_FACE),
    data: { phase, trial_num: i + 1, face_id: e.id, face_sex: e.sex, image_filename: base(img(e)),
            exposure_duration: CONFIG.LEARN_FACE, preceding_cross_duration: crossSec },
  });
  const learningBlock = (set, phase) => set.flatMap((e, i) => {
    const c = i === 0 ? CONFIG.LEARN_FIRST_CROSS : CONFIG.LEARN_CROSS;
    return [cross(c, { phase_of_cross: phase, trial_num: i + 1 }), learningFace(e, phase, i, c)];
  });

  const outcome = (truth, resp) =>
    truth === 'old' ? (resp === 'old' ? 'hit' : 'miss') : (resp === 'old' ? 'false_alarm' : 'correct_rejection');
  const testBlock = testList.flatMap((e, i) => [
    cross(CONFIG.TEST_CROSS, { phase_of_cross: 'test', trial_num: i + 1 }),
    {
      type: jsPsychImageKeyboardResponse, stimulus: img(e), choices: ['l', 's'], render_on_canvas: false,
      stimulus_height: imageHeight,           // face stays until L or S is pressed
      data: { phase: 'test', trial_num: i + 1, face_id: e.id, face_sex: e.sex, image_filename: base(img(e)),
              ground_truth: e.ground_truth, preceding_cross_duration: CONFIG.TEST_CROSS },
      on_finish: (d) => {
        d.response_label = d.response === 'l' ? 'old' : 'new';
        d.correct = d.response_label === d.ground_truth;
        d.sdt_outcome = outcome(d.ground_truth, d.response_label);
        d.reaction_time = Math.round(d.rt) / 1000;       // seconds, from face onset
      },
    },
  ]);

  const page = (html, extra = {}) => ({
    type: jsPsychHtmlKeyboardResponse, stimulus: html, choices: [' '], ...extra,
  });

  // ---------- summary statistics (same definitions as the PsychoPy version) ----------
  function qnorm(p) {   // inverse normal CDF (Acklam's approximation, abs. error < 1.2e-9)
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425, ph = 1 - pl; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    if (p > ph) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    q = p - 0.5; r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  function computeSummary() {
    const t = jsPsych.data.get().filter({ phase: 'test' }).values();
    const nOld = t.filter((x) => x.ground_truth === 'old').length;
    const nNew = t.filter((x) => x.ground_truth === 'new').length;
    const hits = t.filter((x) => x.sdt_outcome === 'hit').length;
    const fas = t.filter((x) => x.sdt_outcome === 'false_alarm').length;
    const hr = nOld ? hits / nOld : 0, far = nNew ? fas / nNew : 0;
    const adj = (r, n) => (r === 1 ? 1 - 0.5 / n : r === 0 ? 0.5 / n : r);     // 1/(2N), d' only
    const dprime = nOld && nNew ? qnorm(adj(hr, nOld)) - qnorm(adj(far, nNew)) : '';
    const acc = t.length ? t.filter((x) => x.correct).length / t.length : 0;
    const bc = jsPsych.data.get().filter({ trial_type: 'browser-check' }).values()[0] || {};
    const inter = jsPsych.data.getInteractionData();
    const r4 = (x) => (x === '' ? '' : Math.round(x * 10000) / 10000);
    return {
      hit_rate: r4(hr), miss_rate: r4(nOld ? 1 - hr : 0), false_alarm_rate: r4(far),
      correct_rejection_rate: r4(nNew ? 1 - far : 0), d_prime: r4(dprime), overall_accuracy: r4(acc),
      n_old: nOld, n_new: nNew, excluded: acc <= 0.5, n_test_trials: t.length,
      n_window_blur: inter.filter({ event: 'blur' }).count(), n_fullscreen_exit: inter.filter({ event: 'fullscreenexit' }).count(),
      screen_width: bc.width, screen_height: bc.height, browser: bc.browser, browser_version: bc.browser_version,
      os: bc.os, vsync_rate: bc.vsync_rate, session_end_time: new Date().toISOString(),
      session_duration_min: Math.round(((new Date() - startTime) / 60000) * 100) / 100,
    };
  }
  function downloadCSV() {
    const blob = new Blob([jsPsych.data.get().csv()], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${jsPsych.data.get().values()[0]?.sona_id || 'unknown'}_${condition}_${stamp}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- timeline ----------
  const timeline = [];

  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="left"><h2>Consent</h2><p>[INSERT THE IRB-APPROVED CONSENT / INFORMATION TEXT HERE]</p></div>',
    choices: ['I agree to participate', 'I do not agree'],
    on_finish: (d) => { if (d.response === 1) jsPsych.abortExperiment('<p>Thank you. You chose not to participate. You may close this window.</p>'); },
  });
  timeline.push({ type: jsPsychFullscreen, fullscreen_mode: true,
    message: '<p>The experiment runs in full-screen mode.<br>Please do not leave full-screen until it is over.</p>',
    button_label: 'Continue' });
  timeline.push({
    type: jsPsychBrowserCheck,
    skip_features: ['webcam', 'microphone', 'webaudio'],
    inclusion_function: (d) => d.width >= CONFIG.MIN_WIDTH && d.height >= CONFIG.MIN_HEIGHT && !d.mobile,
    exclusion_message: () => '<p>Sorry, this experiment needs a laptop or desktop computer with a larger screen. ' +
      'Please reopen the link on a computer. You may close this window.</p>',
  });
  timeline.push({
    type: jsPsychSurveyHtmlForm,
    preamble: '<h3>Please enter the following information</h3>',
    html: `<div class="left">
      <label>SONA ID <input name="sona_id" type="text" required value="${sonaFromUrl.replace(/"/g, '')}"></label>
      <label>Age <input name="age" type="number" min="1" max="120" required></label>
      <label>Gender <select name="gender" required><option value="">Select...</option>
        <option>Man</option><option>Woman</option><option>Other</option></select></label></div>`,
    button_label: 'Continue',
    data: { phase: 'demographics' },
    on_finish: (d) => jsPsych.data.addProperties({ sona_id: d.response.sona_id, age: d.response.age, gender: d.response.gender }),
  });
  timeline.push({
    type: jsPsychPreload,
    images: [...previewSet, ...manifest.learning, ...manifest.test].map(img),
    message: '<p>Loading... please wait.</p>', show_progress_bar: true, max_load_time: 120000,
    error_message: '<p>The images could not be loaded. Please check your connection and reload the page.</p>',
  });

  timeline.push(page(
    '<p>In this experiment you will see a series of faces, one at a time.</p>' +
    '<p><b>Throughout the entire experiment, please keep looking at the center of the screen, where the + appears, ' +
    'even when the + is not on screen.</b></p>' +
    '<p>Please sit and watch each face as it appears.</p>' +
    '<p>First you will see a few faces so you know what to expect.</p>' +
    '<p>Press the SPACE BAR to begin.</p>',
    { on_finish: () => document.body.classList.add('trial-cursor-hidden') }));
  timeline.push(...learningBlock(previewSet, 'preview'));
  timeline.push(page(
    "<p>That is what the main part looks like.</p>" +
    `<p>You will now see ${nLearn} faces, one at a time, each for ${faceSec} seconds. This part takes about ${learnMin} minutes.</p>` +
    '<p>Please keep looking at the + whenever it appears, and at the center of the screen the whole time.</p>' +
    '<p>Press the SPACE BAR when you are ready to begin.</p>'));
  timeline.push(...learningBlock(learningSet, 'learning'));

  timeline.push(page(
    '<p>Now you will see a series of faces, one at a time.</p>' +
    '<p>For each face, decide whether you saw it during the first part of the experiment.</p>' +
    '<p>If you think you SAW this face before, press <b>L</b> with your right index finger.<br>' +
    'If you think this face is NEW, press <b>S</b> with your left index finger.</p>' +
    '<p>Please respond as quickly and as accurately as possible.</p>' +
    '<p>Press the SPACE BAR when you are ready to begin.</p>'));
  timeline.push(...testBlock);

  timeline.push({
    type: jsPsychHtmlKeyboardResponse, stimulus: '<p>Saving your data... please do not close this window.</p>',
    choices: 'NO_KEYS', trial_duration: 300, data: { phase: 'summary' },
    on_finish: (d) => Object.assign(d, computeSummary()),
  });
  if (CONFIG.PIPE_EXPERIMENT_ID) {
    timeline.push({
      type: jsPsychPipe, action: 'save', experiment_id: CONFIG.PIPE_EXPERIMENT_ID,
      filename: () => `${jsPsych.data.get().values().find((v) => v.sona_id)?.sona_id || 'unknown'}_${condition}_${stamp}.csv`,
      data_string: () => jsPsych.data.get().csv(),
      on_finish: (d) => { if (!d.success) downloadCSV(); },     // fall back to a local download
    });
  } else {
    timeline.push({ type: jsPsychHtmlKeyboardResponse, stimulus: '<p>(No server configured - downloading data file.)</p>',
      choices: 'NO_KEYS', trial_duration: 500, on_finish: downloadCSV });
  }
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<p>Thank you for participating!</p><p>This part of the experiment is now complete.</p>',
    choices: 'NO_KEYS', trial_duration: DEV ? 500 : 3000,
  });
  timeline.push({ type: jsPsychFullscreen, fullscreen_mode: false });

  jsPsych.run(timeline);
})();
