import base64, json, urllib.request, urllib.error
img = open("/Users/abdullahsalik/.openclaw/workspace/FitRoom-YouCam/_experiments/testimg/full-body.jpg", "rb").read()
b64 = "data:image/jpeg;base64," + base64.b64encode(img).decode()
body = json.dumps({"photoBase64": b64, "garmentId": "top_shirt-blue"}).encode()
req = urllib.request.Request("http://localhost:3000/api/tryon", data=body,
                            headers={"content-type": "application/json"})
try:
    r = urllib.request.urlopen(req, timeout=240)
    print("HTTP", r.status, r.read().decode()[:500])
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:800])
