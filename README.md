# Sales Elevator — Dashboard de Performance Comercial

Dashboard automatizado com análise de IA, identidade visual Sales Elevator.

## Como rodar

**Opção 1 — Sem instalação (recomendado)**
```bash
npx serve .
```

**Opção 2 — Python**
```bash
python -m http.server 3000
```

**Opção 3 — Node**
```bash
npm install && npm start
```

Acesse: http://localhost:3000

## Funcionalidades

- **Calculadora de funil** com fórmulas automáticas e visualização em barras animadas
- **Projeção 6/12/24 meses** com gráfico interativo Chart.js
- **Análise de IA** com score (0–100) e recomendações contextuais
- **Modo avançado** — Churn, LTV, MRR, ARR, LTV:CAC
- **Simulador de cenários** — pessimista / realista / otimista
- **Tabela de metas por vendedor** com status de atingimento
- **Referência completa de fórmulas** comerciais e SaaS
- **Exportar** via impressão/PDF (Ctrl+P)
- **100% responsivo** — desktop, tablet e mobile
- **Zero dependências externas** (exceto Chart.js via CDN)
- **Ícones minimalistas SVG inline** — sem bibliotecas de ícones

## Tecnologias

- HTML5 semântico
- CSS3 puro com design system completo (variáveis CSS, dark mode)
- JavaScript vanilla ES6+
- Chart.js 4 via CDN
- Font: Manrope (Google Fonts)

## Estrutura

```
sales-elevator-dashboard/
├── index.html      # Estrutura e marcação completa
├── styles.css      # Design system Sales Elevator
├── app.js          # Lógica, cálculos e interatividade
├── README.md
└── package.json
```
