# DWV — Painel da Operadora

Dashboard unificado para operadoras de parcerias com dados em tempo real do Grafana.

## Blocos
1. **Saúde do Canal** — Acessos por construtora (ClickHouse)
2. **Stories** — Visualizações por incorporadora (ClickHouse + Postgres)
3. **Landing Pages** — LPs geradas vs acessadas, por empreendimento + gráfico mensal (Postgres)
4. **Imobiliárias Integradas** — Lista e totais de unidades integradas (Postgres)

## Deploy na Vercel

1. Push o projeto para um repo Git
2. Importe na Vercel
3. Configure as variáveis de ambiente:
   - `GRAFANA_URL` = `https://dwv.grafana.net`
   - `GRAFANA_TOKEN` = `glsa_XXXXXXXXX` (seu Service Account Token)
4. Deploy!

## Desenvolvimento local

```bash
npm install
GRAFANA_URL=https://dwv.grafana.net GRAFANA_TOKEN=seu_token npm run dev
```
