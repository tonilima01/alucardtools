# ALUCARD-TOOLS — Hair / Armor / Trajes Studio

Versão focada somente em Hair, Armor e Trajes/Costumes do PristonTale.

## O que faz

- Lê a pasta `tmABCD` localmente no navegador.
- Indexa `.smd` e texturas `.bmp`, `.tga`, `.dds`, `.png`, `.jpg`.
- Mostra somente pacotes de:
  - Hair / cabeça
  - Armor / corpo
  - Trajes / costumes
- Remove arma, escudo e asa do fluxo principal.
- Monta o pacote lógico do item:
  - SMD principal
  - até 4 texturas relacionadas
  - arquivos relacionados
  - classe provável
  - base de personagem encontrada
- Tenta carregar uma base de personagem da classe detectada quando ela existe na pasta carregada.
- Abre o modelo parado, sem auto giro.
- Possui ajuste manual de posição, rotação e escala.
- Exporta PNG.

## Importante

A montagem usa o parser SMD atual em Three.js e faz uma montagem visual por base + item. Para ficar 100% idêntico ao client PristonTale em todos os casos, ainda seria necessário portar a lógica completa de bones/physique/hierarquia do client original.

## Comandos

```powershell
npm install --include=optional
npm run build
```

## Deploy

```powershell
git add .
git commit -m "add hair armor costume mount studio"
git push origin main
```
