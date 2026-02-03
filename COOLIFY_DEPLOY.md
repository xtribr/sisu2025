# XTRI SISU 2026 - Deploy no Coolify

## 🚀 Passo a Passo para Deploy no Coolify

### 1. Acessar o Coolify

Acesse seu painel do Coolify (geralmente em `https://coolify.seudominio.com` ou IP:8000)

### 2. Criar Novo Projeto

1. Clique em **"New Project"**
2. Nome: `x-sisu-2026`
3. Clique em **"Create"**

### 3. Adicionar Recursos

#### Backend (Python/FastAPI)

1. Clique em **"+ New Resource"**
2. Selecione **"Docker Compose"** ou **"Dockerfile"**
3. Configure:
   - **Name**: `sisu-backend`
   - **Repository**: `https://github.com/x-tri/sisu2025`
   - **Branch**: `main`
   - **Base Directory**: `/`
   - **Dockerfile Path**: `deploy/backend/Dockerfile`
   
4. **Environment Variables** (copie de `deploy/.env.coolify`):
   ```
   SUPABASE_URL=https://sisymqzxvuktdcbsbpbp.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   PYTHONUNBUFFERED=1
   ```

5. **Port**: `8000`
6. **Health Check**: `http://localhost:8000/health`

#### Frontend (Next.js)

1. Clique em **"+ New Resource"**
2. Selecione **"Dockerfile"**
3. Configure:
   - **Name**: `sisu-frontend`
   - **Repository**: `https://github.com/x-tri/sisu2025`
   - **Branch**: `main`
   - **Base Directory**: `web`
   - **Dockerfile Path**: `../deploy/frontend/Dockerfile`
   
4. **Build Arguments**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://sisymqzxvuktdcbsbpbp.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. **Port**: `3000`

#### Nginx (Reverse Proxy)

1. Clique em **"+ New Resource"**
2. Selecione **"Docker Compose"**
3. Use o arquivo `deploy/docker-compose.yml`
4. Ou crie manualmente com imagem `nginx:alpine`
5. Mount o arquivo `deploy/nginx/nginx.conf`
6. **Port**: `80` (ou `8082` se preferir)

### 4. Configurar Domínio

1. No recurso do Nginx, vá em **"Settings"** > **"Domains"**
2. Adicione: `sisu2026.xtri.com.br`
3. Ative **"HTTPS"** (Let's Encrypt)

### 5. Deploy

1. Clique em **"Deploy"** em cada recurso
2. Aguarde o build (pode levar alguns minutos)
3. Verifique os logs em caso de erro

### 6. Verificar Deploy

```bash
# Testar health check
curl https://sisu2026.xtri.com.br/health

# Testar API
curl "https://sisu2026.xtri.com.br/api/courses?limit=2"
```

## 🔧 Configuração Alternativa: Docker Compose Único

No Coolify, você também pode usar apenas o Docker Compose:

1. Crie um novo recurso tipo **"Docker Compose"**
2. Cole o conteúdo de `deploy/docker-compose.yml`
3. Adicione as variáveis de ambiente
4. Deploy!

## 📋 Variáveis de Ambiente Completas

Copie e cole no Coolify:

```env
# Supabase
SUPABASE_URL=https://sisymqzxvuktdcbsbpbp.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpc3ltcXp4dnVrdGRjYnNicGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODYwNTk0MSwiZXhwIjoyMDg0MTgxOTQxfQ.yDWKET6qMOKukkFrRGL8UW4C4qK4BtcVmoJQpI2lG9o
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpc3ltcXp4dnVrdGRjYnNicGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MDU5NDEsImV4cCI6MjA4NDE4MTk0MX0.2K4q_hByFphlTu83IM-hvkyzNHL_k1SULSoITIdo5oE

# Frontend
NEXT_PUBLIC_SUPABASE_URL=https://sisymqzxvuktdcbsbpbp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpc3ltcXp4dnVrdGRjYnNicGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MDU5NDEsImV4cCI6MjA4NDE4MTk0MX0.2K4q_hByFphlTu83IM-hvkyzNHL_k1SULSoITIdo5oE

# Python
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
TZ=America/Sao_Paulo
```

## 🔄 Atualização Automática

No Coolify:
1. Vá em **Settings** > **Webhooks**
2. Ative **"Auto-deploy"**
3. O Coolify vai fazer pull e rebuild automaticamente quando houver push no GitHub

## 🐛 Troubleshooting

### Erro de build no frontend

Verifique se as variáveis `NEXT_PUBLIC_*` estão configuradas como **Build Arguments**, não apenas Environment Variables.

### Backend não conecta no Supabase

Verifique se a `SUPABASE_SERVICE_KEY` está correta e tem permissões de `service_role`.

### Nginx não encontra backend/frontend

No Coolify, os containers podem ter nomes diferentes. Verifique os logs do Nginx e ajuste o `nginx.conf` se necessário.

## 📞 Suporte Coolify

- Documentação: https://coolify.io/docs/
- Discord: https://discord.gg/coolify
