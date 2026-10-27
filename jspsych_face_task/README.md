# Old/New Face Task — jsPsych (online) version

Online port of the lab PsychoPy task, following Inbal's email (Oct 2026):
- **No practice round**, and participants are **not told about the test phase** until it starts.
- A short **preview of 4 faces** (same timing as learning, no response) shows participants what to expect.
- Same timings as the lab version: learning = 3 s cross, then each face 3 s with a 1.5 s cross between faces, no response; test = 0.5 s cross, then the face stays until **L (old)** or **S (new)**, RT measured from face onset.
- Neutral vs smiling is set by the link: `index.html?cond=N` or `index.html?cond=HO` (two separate links, same code).
  If `cond` is missing, one is picked at random and logged as `condition_source = random`.

## Files
| File | What it is |
|---|---|
| `index.html` | Page that loads everything |
| `experiment.js` | The whole experiment (instructions, trials, summary stats, saving) |
| `config.js` | Timings, DataPipe ID, SONA completion link, minimum screen size |
| `make_manifest.py` | Builds `stimuli/` + `stimuli_manifest.json` from your Practice/Learning/Test folders |
| `lib/` | jsPsych 8.3.0 and plugins (kept local so nothing depends on a CDN) |

## Steps
1. **Build the stimuli** (needs `pip install pillow`):
   `python make_manifest.py "/path/to/old_new_face_task/stimuli"`
   It prints skipped identities (missing N/HO), removes any identity that appears in more than one set, copies and shrinks the images to `stimuli/`, and writes `stimuli_manifest.json`. The Practice folder is only used as a pool for the 4 preview faces.
2. **Try it locally** (browsers block `fetch` from `file://`, so use a tiny server):
   `python -m http.server 8000` in this folder, then open
   `http://localhost:8000/index.html?cond=N&sona_id=TEST1&dev=1`
   `dev=1` shrinks every duration ×0.05 so you can click through quickly. **Never use `dev=1` for real participants** (it is also written into the version column as `-DEV`).
   With no DataPipe ID set, the CSV is downloaded at the end instead of uploaded.
3. **Host it and store data** — see below.
4. **SONA**: set the study URL to `https://YOUR-SITE/index.html?cond=N&sona_id=%SURVEY_CODE%` (and a second study with `cond=HO`), and paste SONA's completion URL (ending `survey_code=`) into `config.js`.
5. **Fill in the consent text** in `experiment.js` (search for `INSERT THE IRB-APPROVED`). It is a placeholder.

## Hosting / data options (what I could and could not verify)
I could not open the DataPipe, JATOS or GitHub documentation from my environment, so check the current terms before committing.
- **GitHub Pages (or Netlify) for the page + DataPipe for the data** — the combination built for jsPsych. DataPipe (de Leeuw, Vassar) saves each participant's file to an OSF project; the code to use it is already in `experiment.js` (set `PIPE_EXPERIMENT_ID`). Free as far as I know, but I could not confirm limits or pricing. Setup: OSF account → project → DataPipe → new experiment → paste its ID in `config.js` (docs: pipe.jspsych.org).
- **Pavlovia** — the PsychoPy/jsPsych host from Nottingham. An (undated) Sussex page says roughly 20p per participant, with a £1500 institutional licence. Check whether Cornell already has a licence.
- **JATOS / MindProbe** — a self-hostable server built for jsPsych; I could not verify whether a free hosted tier exists.
- **cognition.run** — free, but an undated Sussex page says it is run by one person and may not stay free.

**Decide before using any public host: the face images.** On GitHub Pages/Netlify the images are publicly downloadable. I could not find the Israeli Face Database's terms of use. Check them (or ask the database authors) before posting images publicly. If redistribution is restricted, use a host with access control, or a participant-only login.

## Data (one CSV per participant)
jsPsych writes one row per trial. Use `phase`:
`demographics`, `preview` (4 preview faces), `learning`, `test`, `summary` (one row), plus `fixation` rows.
Test rows: `face_id, face_sex, image_filename, ground_truth, response (l/s), response_label (old/new), correct, sdt_outcome, reaction_time (s), rt (ms)`.
Summary row: hit/miss/false-alarm/correct-rejection rates, d′ (1/(2N) adjustment, same as PsychoPy version), overall_accuracy, n_old, n_new, `excluded` (accuracy ≤ 50%), `n_window_blur`, `n_fullscreen_exit`, screen size, browser, OS, `vsync_rate`, session duration.
On every row: `sona_id, age, gender, condition, condition_source, experiment_version, random_seed, user_agent`.

## Things to know
- **Timing**: durations use browser timers, not frame counting, so expect millisecond-to-one-frame jitter. Actual durations can be recovered from `time_elapsed` differences. RT is also browser-timed; the meeting notes' plan (check network/device, drop RTs > 3 SD) is not applied automatically — do it in analysis.
- The experiment runs full screen; screens under 900×600 and phones are turned away. Leaving the window or full screen is logged, not blocked.
- Keys are `L` and `S` (QWERTY assumed). Closing/reloading mid-session loses the data (no partial save).
- Beyond Inbal's email, I added "even when the + is not on screen" to the first instruction, from your meeting notes ("always direct their gaze to the cross even if it's not there"). Delete it in `experiment.js` if she doesn't want it.
