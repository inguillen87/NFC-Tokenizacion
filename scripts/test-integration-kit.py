"""Install and exercise the shipped kit from a fresh directory outside the monorepo."""
from pathlib import Path
import hashlib, json, os, shutil, subprocess, tarfile, tempfile
ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/'apps/dashboard/src/lib/integration-kit-manifest.json'
def run(command,cwd):
    result=subprocess.run(command,cwd=cwd,text=True,encoding='utf-8',errors='replace',capture_output=True,timeout=120)
    if result.returncode:
        print(result.stdout);print(result.stderr)
        raise RuntimeError('External kit acceptance failed')
    print(result.stdout.strip())
def main():
    spec=json.loads(MANIFEST.read_text(encoding='utf-8'))
    artifact=ROOT/'apps/dashboard/resources/integration-kit'/spec['filename']
    content=artifact.read_bytes()
    assert len(content)==spec['bytes'] and hashlib.sha256(content).hexdigest()==spec['sha256']
    npm=shutil.which('npm.cmd') if os.name=='nt' else shutil.which('npm')
    node=shutil.which('node')
    assert npm and node
    with tempfile.TemporaryDirectory(prefix='nexid-kit-acceptance-') as destination:
        dest=Path(destination)
        with tarfile.open(artifact) as tar:
            for item in tar.getmembers():
                assert item.isfile() and item.name.startswith('nexid-integration-starter/') and '..' not in item.name
            tar.extractall(dest,filter='data')
        consumer=dest/'nexid-integration-starter'
        run([node,'verify-kit.mjs'],consumer)
        run([npm,'ci','--offline','--ignore-scripts','--no-audit','--no-fund'],consumer)
        run([node,'--input-type=module','-e',"import {fileURLToPath} from 'node:url';import {resolve,sep} from 'node:path';const p=fileURLToPath(import.meta.resolve('@product/nexid-server-sdk'));if(!p.startsWith(resolve('node_modules')+sep))throw Error('external_package_resolution_failed');console.log('external package resolution verified');"],consumer)
        run([npm,'test'],consumer)
        run([node,'src/cli.mjs','plan','--tenant','company-local','--connector','erp-main','--file','receipts.example.csv'],consumer)
        run([node,'src/cli.mjs','status','--tenant','company-local','--connector','erp-main'],consumer)
        run([node,'src/cli.mjs','plan','--tenant','company-local','--connector','erp-main','--file','receipts.example.csv'],consumer)
    print(json.dumps({'ok':True,'artifactSha256':spec['sha256'],'externalInstall':True,'remoteApiCalls':0}))
if __name__=='__main__': main()
