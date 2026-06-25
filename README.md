# ALUCARD-TOOLS · Item Package Studio

Viewer profissional para arquivos SMD do PristonTale.

## Fluxo correto

1. Clique em **Abrir tmABCD / pasta do cliente**.
2. Selecione a pasta inteira `tmABCD` ou uma pasta menor com o item.
3. O sistema monta pacotes: `.smd + 1 a 4 texturas`.
4. Pesquise por código, exemplo `itws`, `itwd`, `da399`, `hair`, `shield`.
5. Clique no pacote e veja no painel direito quais arquivos formam o item.
6. Ajuste posição, rotação, escala e exporte PNG.

## Privacidade

Os arquivos são lidos localmente no navegador. Nada é enviado para servidor.

## Instalação

```bash
pnpm install
pnpm run build
```

ou

```bash
npm install
npm run build
```
