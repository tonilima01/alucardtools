# ALUCARD-TOOLS · SMD Studio

Ferramenta web para visualizar modelos `.smd` do PristonTale, carregar texturas BMP/TGA/DDS, diagnosticar arquivos e gerar previews para catálogo/loja.

## Recursos principais

- Biblioteca lateral com todos os `.smd` carregados.
- Busca rápida por nome/caminho do modelo.
- Carregamento manual por arquivos/pasta local.
- Carregamento Vercel por classe usando `public/characters/characters.json`.
- Lista de assets/texturas carregadas.
- Diagnóstico técnico do modelo: triângulos, vértices, tamanho, bounds, textura esperada e textura encontrada/faltando.
- Controles visuais: textura, wireframe, grid, eixos, auto giro, fundo, centralizar câmera e Eixo PT.
- Exportação de preview em PNG.
- Suporte ao BMP/TGA criptografado do PristonTale.
- Suporte a DDS via `DDSLoader`.

## Personagens Vercel

Esta versão já vem com pacote em:

```txt
public/characters/
```

Com as classes:

```txt
knight
fighter
mechanician
pikeman
archer
atalanta
magician
priestess
assassin
shaman
```

O arquivo principal é:

```txt
public/characters/characters.json
```

Ele informa a classe, o `.smd` base e a lista de arquivos que o site deve carregar da Vercel.

## Como usar na Vercel

1. Faça deploy do projeto na Vercel.
2. Abra o site.
3. No painel **Personagens Vercel**, escolha a classe.
4. Clique em **Carregar classe**.
5. O sistema carrega os `.smd` e texturas daquela classe direto de `public/characters/<classe>`.
6. Em **Personagem real**, confirme o personagem base, por exemplo `Kinght.smd`, `Archer.smd`, `Atalanta.smd` etc.
7. Na Biblioteca SMD, clique em outro `.smd` para testar armadura, visual, máscara, asa ou item em cima do personagem.

## Preview no personagem real

Quando o botão **Personagem** está ativo no viewer, o modelo escolhido em **Personagem real** substitui o manequim técnico.

Recursos do preview:

- Seleção de personagem real.
- Seleção de slot:
  - arma / mão direita;
  - escudo / mão esquerda;
  - elmo / cabeça;
  - armadura / corpo;
  - costas / visual;
  - modelo livre.
- Ajuste manual:
  - posição X/Y/Z;
  - rotação X/Y/Z;
  - escala;
  - auto ajuste de escala.
- Botão **Copiar preset**, gerando JSON com personagem real, offset, rotação, escala e slot.

Esse preset pode servir como referência para adaptar encaixe dentro de uma ferramenta C++/PT futuramente.

## Como rodar local

```bash
pnpm install
pnpm run dev
```

Build:

```bash
pnpm run build
```

## Observações

- O projeto usa Vite + React + TypeScript.
- O pacote de personagens é grande porque contém muitos modelos/texturas reais da pasta `tmABCD`.
- O botão **Abrir pasta** lê arquivos do computador do usuário, não da Vercel.
- O modo Vercel lê arquivos que estão dentro de `public/characters`.
- Para um preview 100% fiel ao jogo, o próximo passo seria mapear bones/âncoras reais da source do PristonTale. O sistema atual já usa `.smd` real, mas o encaixe ainda é por preset manual.
