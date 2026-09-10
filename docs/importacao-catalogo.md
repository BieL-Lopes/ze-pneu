# Importação de catálogo por CSV

Arquivo em UTF-8, separado por vírgula, com esta primeira linha exata:

```
marca,categoria,produto,descricao,sku,ean,preco,medida,tipo_veiculo,peso_gramas,imagem_url
```

| Coluna | Obrigatória | Formato | Exemplo |
|---|---|---|---|
| `marca` | sim | texto | Michelin |
| `categoria` | sim | texto | Pneus |
| `produto` | sim | modelo, sem a medida | Primacy 4 |
| `descricao` | não | texto livre | Pneu de passeio |
| `sku` | sim | único no arquivo e no sistema | MICH-PRIM4-2055516 |
| `ean` | não | código de barras | 3528707183903 |
| `preco` | sim | `650.00`, `650,00` ou `1.250,90` | 650,00 |
| `medida` | não (vazio para acessório) | largura/perfil R aro + índices | 205/55 R16 91V |
| `tipo_veiculo` | não | `passeio`, `suv`, `carga` ou `moto` | passeio |
| `peso_gramas` | **sim** | número em gramas | 9000 |
| `imagem_url` | não | URL pública da foto | https://.../a.jpg |

Campo que contenha vírgula deve vir entre aspas: `"1.250,90"`.

## Por que o peso é obrigatório

A cotação de frete depende de peso e dimensões. Um SKU sem peso não consegue
ser cotado, ou seja, não pode ser vendido — então a importação recusa a linha
em vez de criar um produto quebrado que só falha no carrinho do cliente.

## Rodando

```bash
npm run import:catalogo -- catalogo.csv
```

Linhas com erro são relatadas com o número da linha do arquivo (contando o
cabeçalho como linha 1) e o motivo. As demais são importadas normalmente —
uma célula ruim não derruba a planilha inteira.

Rodar de novo com o mesmo SKU **atualiza o preço**. É assim que se faz reajuste
de tabela: reexporta a planilha completa e roda o comando outra vez.

## Cadastro de produto novo

O produto é criado a partir de `marca` + `produto`, e o slug da URL sai daí.
Várias linhas com a mesma marca e o mesmo produto viram **um produto com
várias variantes de medida** — que é como a página de produto espera receber.
