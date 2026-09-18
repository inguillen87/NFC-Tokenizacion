"""Build an allowlisted, reproducible private starter artifact. No network or secrets."""
from pathlib import Path
import io, json, tarfile, gzip, hashlib, base64, argparse
ROOT = Path(__file__).resolve().parents[1]
STARTER = ROOT / 'examples/integration-kit'
SDK = ROOT / 'packages/sdk'
def sha(data): return hashlib.sha256(data).hexdigest()
def archive(files):
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for path, data in sorted(files.items()):
            item = tarfile.TarInfo(path); item.size=len(data); item.mode=0o644; item.mtime=0
            item.uid=item.gid=0; item.uname=item.gname=''
            tar.addfile(item, io.BytesIO(data))
    return gzip.compress(raw.getvalue(), compresslevel=9, mtime=0)
def build():
    package = json.loads((SDK/'package.json').read_text(encoding='utf-8'))
    if package['name']!='@product/nexid-server-sdk' or package['version']!='0.2.0' or not package['private'] or package.get('dependencies'): raise ValueError('Unexpected SDK contract')
    sdk_files = {f'package/{p}':(SDK/p).read_bytes() for p in ['package.json','README.md','dist/index.js','dist/index.js.map','dist/index.d.ts','dist/index.d.ts.map']}
    sdk_files={name:data.replace(b'\r\n',b'\n') for name,data in sdk_files.items()}
    for name in list(sdk_files):
        if name.endswith('.map'):
            mapping=json.loads(sdk_files[name]); mapping['sourcesContent']=[text.replace('\r\n','\n') for text in mapping.get('sourcesContent',[])]
            sdk_files[name]=json.dumps(mapping,separators=(',',':'),ensure_ascii=False).encode()
    sdk_tar = archive(sdk_files)
    names = ['package.json','.gitignore','README.md','receipts.example.csv','verify-kit.mjs',
             'src/receipts.mjs','src/ledger.mjs','src/connector.mjs','src/webhook.mjs','src/cli.mjs',
             'test/helpers.mjs','test/connector.test.mjs','test/webhook.test.mjs']
    files={name:(STARTER/name).read_bytes() for name in names}
    files['vendor/product-nexid-server-sdk-0.2.0.tgz']=sdk_tar
    files['contracts/openapi.json']=(ROOT/'apps/api/public/openapi/nexid-sdk-v1.json').read_bytes()
    files['contracts/asyncapi.json']=(ROOT/'apps/api/public/asyncapi/nexid-webhooks-v1.json').read_bytes()
    for name in list(files):
        if not name.endswith('.tgz'): files[name]=files[name].replace(b'\r\n',b'\n')
    spec=json.loads(files['package.json'])
    lock={'name':spec['name'],'version':spec['version'],'lockfileVersion':3,'requires':True,'packages':{
        '':{k:spec[k] for k in ['name','version','dependencies','engines']},
        'node_modules/@product/nexid-server-sdk':{'version':'0.2.0','resolved':'file:vendor/product-nexid-server-sdk-0.2.0.tgz','integrity':'sha512-'+base64.b64encode(hashlib.sha512(sdk_tar).digest()).decode(),'engines':package['engines']}}}
    files['package-lock.json']=(json.dumps(lock,indent=2)+'\n').encode()
    manifest={'kitVersion':'1.0.0','sdkVersion':package['version'],'nodeRequired':'>=24.14.0','publicNpmPackage':False,
              'files':[{'path':name,'bytes':len(data),'sha256':sha(data)} for name,data in sorted(files.items())]}
    files['manifest.json']=(json.dumps(manifest,indent=2)+'\n').encode()
    artifact=archive({'nexid-integration-starter/'+name:data for name,data in files.items()})
    if len(artifact)>512000: raise ValueError('Starter unexpectedly large')
    out=ROOT/'apps/dashboard/resources/integration-kit';out.mkdir(parents=True,exist_ok=True)
    name='nexid-integration-starter-1.0.0.tgz';(out/name).write_bytes(artifact)
    summary={'filename':name,'version':'1.0.0','sdkVersion':package['version'],'bytes':len(artifact),'sha256':sha(artifact),
             'runtime':'Node.js 24.14+','files':len(files),'apiOrigin':'https://api.nexid.lat',
             'sourceDigest':sha(json.dumps(manifest,sort_keys=True).encode()),'publicNpmPackage':False}
    (ROOT/'apps/dashboard/src/lib/integration-kit-manifest.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,indent=2))
if __name__=='__main__': build()
