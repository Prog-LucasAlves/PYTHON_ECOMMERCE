# Roadmap 2026: Melhores Ofertas (Minimalist Edition)

Este roteiro detalha a visão estratégica para transformar o Melhores Ofertas no benchmark de conversão e UX para afiliados Shopee.

---

## 🏛️ Pilar 1: Core Performance & Core Web Vitals (200 Ajustes)
Foco em velocidade bruta e estabilidade visual (LCP, FID, CLS).

1.  **Imagens:**
    *   [ ] Implementar compressão automática AVIF para todas as thumbs.
    *   [ ] Configurar `loading="lazy"` em 100% das imagens fora da dobra.
    *   [ ] Gerar placeholders LQIP (Low-Quality Image Placeholders) para evitar CLS.
    *   [ ] Dimensionamento explícito (width/height) em todos os `<img>`.
    *   [ ] CDN global para assets estáticos.
    *   [ ] Cache-Control agressivo para imagens de produtos.
2.  **Scripts & CSS:**
    *   [ ] Minificação JIT (Just-In-Time) de `js/app.js`.
    *   [ ] Remoção de CSS não utilizado (Legacy Purge).
    *   [ ] Inline CSS crítico para o Hero Banner.
    *   [ ] Defer de scripts de terceiros (Analytics, GTM).
    *   [ ] Otimização do parsing do Firestore para evitar bloqueio da main thread.

---

## 🎨 Pilar 2: UX Minimalista & Design System (150 Ajustes)
Interface limpa, rápida e focada em "One Click to Shop".

1.  **Layout & Tipografia:**
    *   [ ] Padronizar tokens de espaçamento (8px grid).
    *   [ ] Otimização de fontes: usar fontes do sistema com fallback para Inter.
    *   [ ] Ajuste de contraste para acessibilidade (WCAG AA).
    *   [ ] Micro-animações de feedback ao clicar em "Ver na Shopee".
2.  **Mobile-First:**
    *   [ ] Otimização do Touch Target (mínimo 44px).
    *   [ ] Sticky Header ultra-fino para ganhar espaço vertical.
    *   [ ] Refinamento do Skeleton Loading para transição suave.

---

## 🔍 Pilar 3: SEO & GEO (Generative Engine Optimization) (150 Ajustes)
Dominar os resultados de busca e IAs generativas (Perplexity, ChatGPT, Gemini).

1.  **Conteúdo & Estrutura:**
    *   [ ] Schema.org Product markup dinâmico (validado 100%).
    *   [ ] BreadcrumbList para navegação estruturada.
    *   [ ] Geração de meta-tags contextuais por categoria.
    *   [ ] Criação de FAQ dinâmico baseado em buscas comuns.
2.  **Autoridade:**
    *   [ ] Sitemap.xml dinâmico atualizado a cada 30min.
    *   [ ] Robots.txt otimizado para crawlers de IA.
    *   [ ] Canonical tags fixas para evitar conteúdo duplicado na rotação.

---

## ⚙️ Pilar 4: Algoritmo de Rotação & Engajamento (100 Ajustes)
Garantir que a vitrine esteja sempre fresca e viciante.

1.  **Inteligência de Exibição:**
    *   [ ] Refinamento do Hash Bucket de 30min para evitar repetição excessiva.
    *   [ ] Implementar "Hot Score" baseado em cliques reais locais.
    *   [ ] Priorização de produtos com maiores descontos relativos.
    *   [ ] Rotação de banners do Hero baseada em popularidade.

---

## 🛍️ Pilar 5: Conversão & Afiliados (100 Ajustes)
Maximizar o CTR (Click-Through Rate) e evitar perda de comissões.

1.  **CTAs:**
    *   [ ] A/B Testing de cores do botão de compra (Shopee Orange vs Vibrant Coral).
    *   [ ] Implementar "Price Drop Alerts" via PWA.
    *   [ ] Link wrapping para tracking interno de performance.

---

## 🛠️ Pilar 6: Infraestrutura & PWA (100 Ajustes)
Robustez técnica e experiênca de app nativo.

1.  **PWA:**
    *   [ ] Offline mode para visualização de últimas ofertas cacheadas.
    *   [ ] Push Notifications para campanhas relâmpago.
    *   [ ] Splash screen personalizada.

---

## 📊 Pilar 7: Analytics & Data Intelligence (100 Ajustes)
Entender o comportamento do usuário para iterar rápido.

1.  **Eventos:**
    *   [ ] Funil de conversão: Home -> Modal -> Shopee.
    *   [ ] Heatmaps de cliques no Grid de produtos.
    *   [ ] Monitoramento de erros de carregamento de imagem.

---

## 👮 Pilar 8: LGPD & Segurança (50 Ajustes)
Conformidade e confiança do usuário.

1.  **Privacidade:**
    *   [ ] Consent Management formalizado.
    *   [ ] Anonimização total de logs locais.
    *   [ ] HTTPS Everywhere e Hardening de headers.

---

## 📱 Pilar 9: Integração Social & Telegram (50 Ajustes)
Alimentar a comunidade e reter usuários.

1.  **Social Loop:**
    *   [ ] One-tap copy de cupom (se disponível).
    *   [ ] Compartilhamento rápido com template otimizado para WhatsApp/Telegram.
    *   [ ] Link fixo para o canal `t.me/melhoresdashopeeday`.

---

## 🚀 Pilar 10: Expansão & Futuro (0 Ajustes)
Preparação para escala.

1.  **Escala:**
    *   [ ] Suporte a múltiplos mercados (Shopee Global).
    *   [ ] Dashboard administrativo para curadoria manual ultra-rápida.

---

> **Total Estimado: 1000 micro-ajustes planejados.**
