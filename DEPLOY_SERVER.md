# XTRI SISU 2026 - Deploy no Servidor

## 🚀 Instruções de Deploy no Hostinger

### 1. Acessar o Servidor

```bash
ssh root@SEU_IP_DO_HOSTINGER
```

### 2. Executar Instalação Automática

```bash
# Opção 1: Usar o script de instalação
curl -fsSL https://raw.githubusercontent.com/x-tri/sisu2025/main/deploy/scripts/install.sh | sudo bash

# Opção 2: Instalação manual passo a passo
mkdir -p /opt/x-sisu-2026
cd /opt/x-sisu-2026
git clone https://github.com/x-tri/sisu2025.git .
```

### 3. Configurar Variáveis de Ambiente

```bash
cd /opt/x-sisu-2026/deploy
cp .env.example .env
nano .env
```

**Conteúdo do .env:**
```env
# Supabase Configuration
SUPABASE_URL=https://rqzxcturezryjbwsptld.supabase.co
SUPABASE_SERVICE_KEY=sua_service_key_aqui
SUPABASE_ANON_KEY=sua_anon_key_aqui

# Frontend Public Variables
NEXT_PUBLIC_SUPABASE_URL=https://rqzxcturezryjbwsptld.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

### 4. Executar Deploy

```bash
cd /opt/x-sisu-2026/deploy

# Opção 1: Script automatizado
sudo ./scripts/deploy.sh

# Opção 2: Makefile
make deploy

# Opção 3: Docker Compose manual
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 5. Verificar Deploy

```bash
# Verificar containers
docker ps

# Testar health check
curl http://localhost:8082/health

# Testar API
curl "http://localhost:8082/api/courses?limit=2"

# Ver logs
make logs
# ou
docker compose logs -f
```

### 6. Configurar SSL (HTTPS)

```bash
cd /opt/x-sisu-2026/deploy
sudo ./scripts/setup-ssl.sh sisu2026.xtri.com.br
```

### 7. Configurar Domínio no Hostinger

No painel DNS do Hostinger:

```
Tipo: A
Nome: sisu2026
Valor: SEU_IP_DO_SERVIDOR
TTL: 3600
```

### 8. Comandos Úteis

```bash
cd /opt/x-sisu-2026/deploy

# Ver status
make help

# Logs
make logs
make logs-backend
make logs-frontend

# Restart
make restart

# Monitoramento
./scripts/monitor.sh

# Backup
./scripts/backup.sh /opt/backups

# Atualizar código
cd /opt/x-sisu-2026
git pull
cd deploy
make deploy
```

## 🔧 Troubleshooting

### Containers não iniciam

```bash
# Verificar logs
docker logs sisu-backend --tail 50
docker logs sisu-frontend --tail 50

# Verificar portas
netstat -tlnp | grep 8082
```

### Erro de conexão com Supabase

```bash
# Testar conexão
docker exec -it sisu-backend python -c "
from src.storage.supabase_client import SupabaseClient
client = SupabaseClient()
print('Connected:', client.test_connection())
"

# Verificar variáveis
docker exec sisu-backend env | grep SUPABASE
```

### Problemas de permissão

```bash
chown -R 1000:1000 /opt/x-sisu-2026/data
chmod -R 755 /opt/x-sisu-2026/data
```

## 📊 Monitoramento

Adicionar ao crontab para monitoramento automático:

```bash
# Editar crontab
crontab -e

# Adicionar linha para verificar a cada 5 minutos
*/5 * * * * /opt/x-sisu-2026/deploy/scripts/monitor.sh >> /var/log/sisu-monitor.log 2>&1

# Backup diário às 2h da manhã
0 2 * * * /opt/x-sisu-2026/deploy/scripts/backup.sh /opt/backups >> /var/log/sisu-backup.log 2>&1
```

## 🔄 Atualização Automática (Opcional)

Para atualizar automaticamente quando houver push no GitHub:

```bash
# Adicionar webhook no servidor
# Ou usar GitHub Actions com self-hosted runner
```

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs: `make logs`
2. Teste a API: `curl http://localhost:8082/health`
3. Execute o monitor: `./scripts/monitor.sh`
4. Verifique o README completo: `cat deploy/README.md`
