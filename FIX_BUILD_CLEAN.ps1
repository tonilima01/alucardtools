# Execute dentro de C:\alucard-tools
Write-Host "Limpando build antigo..." -ForegroundColor Cyan

npm config set registry https://registry.npmjs.org/
npm config delete proxy 2>$null
npm config delete https-proxy 2>$null

Get-ChildItem -Path . -Recurse -File -Include "*three*shim*.d.ts","three.d.ts","three-shims.d.ts","three-jsm.d.ts" | ForEach-Object {
    Write-Host "Removendo shim antigo:" $_.FullName -ForegroundColor Yellow
    Remove-Item $_.FullName -Force
}

Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .vite -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.tmp -ErrorAction SilentlyContinue

npm cache clean --force
npm install --include=optional --registry=https://registry.npmjs.org/
npm run build
