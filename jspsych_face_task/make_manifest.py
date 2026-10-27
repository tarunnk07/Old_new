"""
Build the web stimuli from your local Practice / Learning / Test folders.

Usage (from this folder):
    python make_manifest.py "/path/to/old_new_face_task/stimuli"

What it does
  1. Finds every identity folder (M-### / F-###) and its N (neutral) and
     HO (open-mouth smile) image -- same matching rules as the PsychoPy
     script (so 'N' never matches 'NM'; 'F-065-HO-fixed.jpg' is found).
  2. Skips identities missing either image and PRINTS which ones and why.
  3. Removes any identity that appears in more than one set, with a warning.
  4. Copies the images into ./stimuli/<Set>/<ID>_<N|HO>.jpg (simple
     filenames, no spaces) and shrinks them to MAX_HEIGHT px tall so the
     experiment loads quickly online. Aspect ratio is preserved.
  5. Writes stimuli_manifest.json, which experiment.js reads.
Requires: pip install pillow
"""
import os, re, sys, json, shutil
from PIL import Image

MAX_HEIGHT = 800      # px; faces are shown at 50% of the screen height
SETS = ['Practice', 'Learning', 'Test']


def find_expression_file(files, code):
    pat = re.compile(r'-' + code + r'(?:\s|\.|-|$)', re.IGNORECASE)
    for f in sorted(files):
        if pat.search(f) and f.lower().endswith(('.jpg', '.jpeg', '.png')):
            return f
    return None


def scan(folder, label):
    cat, skipped = [], []
    for root, dirs, files in os.walk(folder):
        name = os.path.basename(root)
        if not re.match(r'^[MF]-\d+$', name):
            continue
        n, ho = find_expression_file(files, 'N'), find_expression_file(files, 'HO')
        if n and ho:
            cat.append({'id': name, 'sex': name[0],
                        'N_src': os.path.join(root, n), 'HO_src': os.path.join(root, ho)})
        else:
            miss = [c for c, f in (('N', n), ('HO', ho)) if not f]
            skipped.append((name, miss, sorted(files)))
    cat.sort(key=lambda e: e['id'])
    m = sum(e['sex'] == 'M' for e in cat)
    print(f"{label}: {len(cat)} usable identities ({m} male, {len(cat)-m} female)")
    for name, miss, files in sorted(skipped):
        print(f"  SKIPPED {name}: no usable {' / '.join(miss)} image. Files: {files}")
    return cat


def drop_overlap(cat, label, other, other_label):
    ids = {e['id'] for e in other}
    dupes = sorted(e['id'] for e in cat if e['id'] in ids)
    if dupes:
        print(f"WARNING: {label} identities also in {other_label}: {dupes} -> removed from {label}")
    return [e for e in cat if e['id'] not in ids]


def export(cat, set_name, out_root):
    out = []
    os.makedirs(os.path.join(out_root, 'stimuli', set_name), exist_ok=True)
    for e in cat:
        entry = {'id': e['id'], 'sex': e['sex']}
        for code in ('N', 'HO'):
            rel = f"stimuli/{set_name}/{e['id']}_{code}.jpg"
            with Image.open(e[f'{code}_src']) as im:
                im = im.convert('RGB')
                if im.height > MAX_HEIGHT:
                    im = im.resize((round(im.width * MAX_HEIGHT / im.height), MAX_HEIGHT), Image.LANCZOS)
                im.save(os.path.join(out_root, rel), quality=92)
            entry[code] = rel
        out.append(entry)
    return out


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    here = os.path.dirname(os.path.abspath(__file__))
    cats = {s: scan(os.path.join(src, s), s) for s in SETS}
    cats['Practice'] = drop_overlap(cats['Practice'], 'Practice', cats['Learning'], 'Learning')
    cats['Practice'] = drop_overlap(cats['Practice'], 'Practice', cats['Test'], 'Test')
    cats['Test'] = drop_overlap(cats['Test'], 'Test', cats['Learning'], 'Learning')
    shutil.rmtree(os.path.join(here, 'stimuli'), ignore_errors=True)
    manifest = {s.lower(): export(cats[s], s, here) for s in SETS}
    with open(os.path.join(here, 'stimuli_manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    print("\nWrote stimuli_manifest.json -- "
          f"preview pool {len(manifest['practice'])}, learning {len(manifest['learning'])}, "
          f"test foils {len(manifest['test'])}")
    if len(manifest['practice']) < 4:
        print("WARNING: fewer than 4 preview identities; the preview will show fewer faces.")


main()
