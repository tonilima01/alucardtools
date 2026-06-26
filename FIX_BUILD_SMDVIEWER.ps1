# Execute dentro de C:\alucard-tools
# Remove declarações antigas que quebram os tipos do Three.js
Get-ChildItem -Path . -Recurse -File -Include "*three*shim*.d.ts","three.d.ts","three-shims.d.ts","three-jsm.d.ts" | ForEach-Object {
    Write-Host "Removendo shim antigo:" $_.FullName
    Remove-Item $_.FullName -Force
}

npm config set registry https://registry.npmjs.org/
npm install --include=optional --registry=https://registry.npmjs.org/
npm run build
