"""Dekodiert die von scripts/test-qr.js erzeugten PNGs und vergleicht sie Byte für Byte.
Aufruf (nur indirekt): python scripts/test-qr-decode.py <ordner>
zxing-cpp ist maßgeblich (liefert Rohbytes); OpenCV wird zusätzlich befragt und nur gemeldet."""
import base64
import json
import os
import sys

import cv2
import numpy as np
import zxingcpp

folder = sys.argv[1]
manifest = json.load(open(os.path.join(folder, "manifest.json"), encoding="utf-8"))
bad = 0
cv_ok = 0
cv_miss = []
cv_det = cv2.QRCodeDetector()
for item in manifest:
    expected = base64.b64decode(item["text"])
    img = cv2.imdecode(np.fromfile(os.path.join(folder, item["file"]), dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    results = zxingcpp.read_barcodes(img)
    got = results[0].bytes if results else None
    if got != expected:
        bad += 1
        print("FEHLER", item["name"], "erwartet", expected[:60], "gelesen", (got or b"")[:60])
        continue
    try:
        text, _, _ = cv_det.detectAndDecode(img)
        if text.encode("utf-8", "surrogateescape") == expected or text.encode("latin-1", "ignore") == expected:
            cv_ok += 1
        else:
            cv_miss.append(item["name"])
    except Exception:
        cv_miss.append(item["name"])
print("zxing-cpp: %d/%d identisch gelesen; OpenCV zusätzlich: %d/%d" % (len(manifest) - bad, len(manifest), cv_ok, len(manifest)))
if cv_miss:
    print("OpenCV nicht gelesen (nur Info):", ", ".join(cv_miss))
sys.exit(1 if bad else 0)
