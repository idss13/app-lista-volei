# Vôlei — Lista de Presença

Aplicação web para gerenciar inscrições em jogos de vôlei. Permite que jogadores entrem na lista, controla o limite de vagas por categoria, arquiva partidas encerradas e compartilha a lista pelo WhatsApp.

## Funcionalidades

- **Inscrição de jogadores** — nome e categoria (Homem, Mulher, Levantador)
- **Controle de vagas** — Homem: 12 vagas · Mulher: 3 · Levantador: 3
- **Fila de espera** — quando a categoria está cheia o jogador entra na fila; ao remover um oficial o primeiro da fila é promovido automaticamente
- **Encerramento automático** — inscrições fecham no horário limite configurado pelo organizador
- **Arquivamento automático** — após o dia do jogo, a lista é arquivada e a data avança para a próxima semana
- **Painel do organizador** — configura data, horário limite e chave PIX; acessa o histórico de partidas
- **PIX** — exibe e copia a chave de pagamento da quadra
- **Compartilhamento** — envia a lista formatada para o WhatsApp
- **Tema claro/escuro** — persiste no localStorage

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript 5 |
| Banco de dados | PostgreSQL via [Neon](https://neon.tech) |
| ORM | Prisma 5 |
| Animações | Framer Motion 12 |
| Notificações | Sonner 2 |

## Estrutura de arquivos

```
app/
  layout.tsx              # Layout raiz — tema, metadados, Toaster global
  page.tsx                # Página principal (Server Component)
  globals.css             # Design system — variáveis CSS, temas, componentes
  components/
    EnrollForm.tsx        # Formulário de inscrição
    PlayerSection.tsx     # Lista oficial e fila de espera
    PixSection.tsx        # Exibição da chave PIX
    WhatsAppShare.tsx     # Botão de compartilhamento
    AdminPanel.tsx        # FAB + modal de login e configurações
    ThemeToggle.tsx       # Alternância de tema
lib/
  prisma.ts               # Singleton do PrismaClient
  actions.ts              # Todas as Server Actions
prisma/
  schema.prisma           # Schema do banco de dados
```

## Schema do banco

```prisma
model Jogador {
  id        Int      @id @default(autoincrement())
  nome      String                               // máx. 100 caracteres
  categoria String                               // "Homem" | "Mulher" | "Levantador"
  status    String                               // "oficial" | "espera"
  criadoEm  DateTime @default(now())
}

model HistoricoJogador {
  id          Int      @id @default(autoincrement())
  nome        String
  categoria   String
  status      String
  dataJogo    DateTime @db.Date                  // data da partida arquivada
  arquivadoEm DateTime @default(now())
}

model Config {
  id            Int    @id                       // sempre 1 — registro único
  horarioLimite String                           // ex.: "20:00"
  chavePix      String
  dataJogo      String                           // formato YYYY-MM-DD
}
```

## Como rodar

### Pré-requisitos

- Node.js 18+
- Banco PostgreSQL (ex.: Neon — plano gratuito funciona)

### Configuração

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env.local` na raiz do projeto:

```env
DATABASE_URL="postgresql://usuario:senha@host/banco?sslmode=require"
ADMIN_PASSWORD="sua_senha_secreta"
```

3. Aplique o schema no banco:

```bash
npx prisma db push
```

4. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Build para produção

```bash
npm run build
npm start
```

O comando `build` executa `prisma generate` antes do Next.js para garantir que o cliente esteja atualizado.

## Deploy

A aplicação pode ser publicada no [Vercel](https://vercel.com) diretamente do repositório. Configure as variáveis de ambiente `DATABASE_URL` e `ADMIN_PASSWORD` no painel do projeto.

## Painel do organizador

O botão 🔒 no canto inferior direito abre o painel restrito. A senha padrão é `admin123` — troque pela variável `ADMIN_PASSWORD` em produção.

No painel é possível:
- Alterar a data do próximo jogo
- Alterar o horário limite de inscrições
- Atualizar a chave PIX
- Consultar o histórico de partidas anteriores
