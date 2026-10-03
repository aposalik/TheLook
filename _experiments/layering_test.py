"""
Phase 1 — multi-garment layering test.
Render a TOP (upper_body) on the body photo, then feed that result back as the
source and render a BOTTOM (lower_body) on it. Check whether a 2-step chain
holds up or compounds artifacts. Reuses spike_cloth's verified API helpers.
"""
import spike_cloth as S

S.resolve_token()

body  = S.upload("testimg/full-body.jpg")
top   = S.upload("capsule/top_shirt-blue.jpg")
pant  = S.upload("capsule/bottom_trousers-brown.jpg")

print("\n--- Step 1: upper_body (blue shirt) on the body photo ---")
r1 = S.poll(S.run_task("upper_body", src_id=body, ref_id=top), "layer1_top")
if not r1:
    raise SystemExit("step 1 failed")

print("\n--- Step 2: lower_body (brown trousers) on the Step-1 RESULT ---")
r1_fid = S.upload(r1)                      # re-upload step-1 output as new source
r2 = S.poll(S.run_task("lower_body", src_id=r1_fid, ref_id=pant), "layer2_full")
print("\nDONE:", r2)
