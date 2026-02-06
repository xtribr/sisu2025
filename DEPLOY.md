# 🚀 Deploy XTRI SISU 2026 - Hostinger VPS

## 📋 Pré-requisitos

- Acesso SSH ao VPS Hostinger (212.85.19.50)
- Coolify instalado e configurado
- Docker e Docker Compose instalados
- Portas liberadas: 80, 443, 3000

## 🔧 Configuração do Coolify

### 1. Acessar painel Coolify
```
https://212.85.19.50:8000
```

### 2. Criar Novo Serviço
1. Clique em **"+ New"** → **"Service"**
2. Selecione **"Docker Compose"**
3. Preencha:
   - **Name:** xtrisisu-frontend
   - **Domain:** sisu2025.rankingenem.com
   - **Repository:** https://github.com/x-tri/sisu2025.git
   - **Branch:** main
   - **Base Directory:** web
   - **Docker Compose Path:** docker-compose.yml

### 3. Configurar Environment Variables
```
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### 4. Deploy
Clique em **"Deploy"** e aguarde o build.

---

## 🖥️ Deploy Manual via SSH (Alternativo)

### 1. Conectar ao VPS
```bash
ssh root@212.85.19.50
```

### 2. Navegar até diretório
```bash
cd /var/www
```

### 3. Clonar/Atualizar projeto
```bash
git clone https://github.com/x-tri/sisu2025.git xtrisisu
cd xtrisisu/web
```

### 4. Build e Run
```bash
docker build -t xtrisisu-frontend:latest .
docker stop xtrisisu-frontend 2>/dev/null
docker rm xtrisisu-frontend 2>/dev/null
docker run -d \
  --name xtrisisu-frontend \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  xtrisisu-frontend:latest
```

### 5. Configurar Traefik (se necessário)
Adicionar labels no docker-compose.yml:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.sisu2025.rule=Host(`sisu2025.rankingenem.com`)"
  - "traefik.http.routers.sisu2025.tls=true"
  - "traefik.http.routers.sisu2025.tls.certresolver=letsencrypt"
  - "traefik.http.services.sisu2025.loadbalancer.server.port=3000"
```

---

## 🔍 Verificar Deploy

### Health Check
```bash
curl http://localhost:3000
```

### Logs
```bash
docker logs -f xtrisisu-frontend
```

### Status
```bash
docker ps | grep xtrisisu
```

---

## 🔄 Atualização

```bash
cd /var/www/xtrisisu
git pull origin main
cd web
docker build -t xtrisisu-frontend:latest .
docker stop xtrisisu-frontend
docker rm xtrisisu-frontend
docker run -d \
  --name xtrisisu-frontend \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  xtrisisu-frontend:latest
```

---

## 🆘 Troubleshooting

### Container não inicia
```bash
docker logs xtrisisu-frontend
```

### Porta ocupada
```bash
lsof -i :3000
kill -9 $(lsof -t -i:3000)
```

### Limpar cache
```bash
docker system prune -a
docker build --no-cache -t xtrisisu-frontend:latest .
```
