"""Fetch the current iliad/ blob listing and produce a clean manifest
{bookNum: {audio: url, cues: url}} for the app to bundle. Run again any time
after new books finish uploading -- it's just a snapshot of what's there.
"""
import json
import os
import re
import urllib.request

TOKEN = None
with open(r"C:\Users\Rep\annotated\.env.local", encoding="utf-8") as f:
    for line in f:
        if line.startswith("BLOB_READ_WRITE_TOKEN"):
            TOKEN = line.split("=", 1)[1].strip().strip('"')

req = urllib.request.Request(
    "https://blob.vercel-storage.com/?prefix=iliad/&limit=1000",
    headers={"Authorization": f"Bearer {TOKEN}", "x-api-version": "7"},
)
data = json.loads(urllib.request.urlopen(req).read())

manifest = {}
for blob in data["blobs"]:
    m = re.match(r"iliad/(audio|cues)/book(\d\d)\.(m4a|json)", blob["pathname"])
    if not m:
        continue
    kind, num = m.group(1), m.group(2)
    key = f"kind_{kind}"
    manifest.setdefault(num, {})[kind] = blob["url"]

out_path = r"C:\Users\Rep\annotated\build\iliad-manifest.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, sort_keys=True)

have_audio = sum(1 for v in manifest.values() if "audio" in v)
have_cues = sum(1 for v in manifest.values() if "cues" in v)
print(f"{len(manifest)} books tracked, {have_audio} with audio, {have_cues} with cues -> {out_path}")
