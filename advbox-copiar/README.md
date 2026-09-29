# Copiar dados do ADVBOX

Extensão interna para Chrome que adiciona cópia individual e em bloco aos dados de clientes exibidos no painel de tarefas do ADVBOX. Não é produto oficial da ADVBOX.

## Arquivos principais

- `manifest.json`: configuração Manifest V3 e limite de acesso ao ADVBOX.
- `src/content.js`: encontra o painel, extrai dados e cria os controles.
- `src/styles.css`: acabamento visual, foco, seleção de texto e feedback.
- `assets/`: ícones próprios da extensão.

## Instalação no Chrome

1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `advbox-copiar`.

## Atualizar após alterações

Em `chrome://extensions`, localize a extensão e clique no botão de recarregar. Depois, atualize a aba do ADVBOX.

## Como testar

Abra uma tarefa no ADVBOX e confirme a cópia de nome, telefone, e-mail e processo. Teste também **Copiar dados**, a seleção manual dentro do painel, a troca entre tarefas e os links originais de cliente e WhatsApp.

## Remoção

Em `chrome://extensions`, clique em **Remover** no cartão da extensão.

## Observação

Uso exclusivamente interno. A extensão não possui suporte oficial da ADVBOX e não substitui as políticas ou controles da plataforma.
