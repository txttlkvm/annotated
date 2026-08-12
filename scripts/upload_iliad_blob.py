"""Upload all 24 books' audio + cue JSON to Vercel Blob under iliad/,
skipping anything already there (checked via the REST list API's clean
`pathname` field -- the CLI's own dedup via table-scraping was unreliable,
see the earlier duplicate-upload incident this replaced).
"""
import json
import mimetypes
import os
import urllib.request

with open(r"C:\Users\Rep\annotated\.env.local", encoding="utf-8") as f:
    TOKEN = next(
        line.split("=", 1)[1].strip().strip('"')
        for line in f
        if line.startswith("BLOB_READ_WRITE_TOKEN")
    )

AUDIO_DIR = r"C:\Users\Rep\annotated\build\iliad-audio"
CUES_DIR = r"C:\Users\Rep\annotated\build\iliad-cues"


def list_existing():
    req = urllib.request.Request(
        "https://blob.vercel-storage.com/?prefix=iliad/&limit=1000",
        headers={"Authorization": f"Bearer {TOKEN}", "x-api-version": "7"},
    )
    data = json.loads(urllib.request.urlopen(req).read())
    return {b["pathname"] for b in data["blobs"]}


def upload(file_path, pathname):
    with open(file_path, "rb") as f:
        body = f.read()
    content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    req = urllib.request.Request(
        f"https://blob.vercel-storage.com/{pathname}",
        data=body,
        method="PUT",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "x-api-version": "7",
            "content-type": content_type,
            "x-add-random-suffix": "0",
        },
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())


def main():
    existing = list_existing()
    print(f"{len(existing)} blobs already present")

    for n in range(1, 25):
        book = f"book{n:02d}"
        audio_path = f"iliad/audio/{book}.m4a"
        if audio_path in existing:
            print(f"[skip] {audio_path}")
        else:
            print(f"[upload] {audio_path}")
            upload(os.path.join(AUDIO_DIR, f"{book}.m4a"), audio_path)

        cues_path = f"iliad/cues/{book}.json"
        if cues_path in existing:
            print(f"[skip] {cues_path}")
        else:
            print(f"[upload] {cues_path}")
            upload(os.path.join(CUES_DIR, f"{book}.json"), cues_path)

    print("DONE")


if __name__ == "__main__":
    main()
