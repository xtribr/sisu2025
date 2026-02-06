#!/bin/bash
# Verificador de status da API MeuSISU
# Retorna 0 se API estiver online, 1 se offline

API_URL="https://d3hf41n0t98fq2.cloudfront.net/api/courseData?courseCode=37"
TIMEOUT=10

echo "🔍 Verificando status da API MeuSISU..."
echo "   URL: $API_URL"
echo "   Timeout: ${TIMEOUT}s"
echo ""

# Testar a API
RESPONSE=$(curl -s "$API_URL" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  -H "Referer: https://meusisu.com/" \
  -H "Accept: application/x-protobuf,*/*" \
  --max-time $TIMEOUT \
  -k \
  -w "\nHTTP_CODE:%{http_code}\nSIZE:%{size_download}\nTIME:%{time_total}" \
  2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
SIZE=$(echo "$RESPONSE" | grep "SIZE:" | cut -d: -f2)
TIME=$(echo "$RESPONSE" | grep "TIME:" | cut -d: -f2)

echo "   Status HTTP: $HTTP_CODE"
echo "   Tamanho: ${SIZE} bytes"
echo "   Tempo: ${TIME}s"
echo ""

# Verificar se está online
if [ "$HTTP_CODE" = "200" ] && [ "$SIZE" -gt 100 ]; then
    echo "✅ API ESTÁ ONLINE!"
    echo ""
    echo "🚀 Execute agora:"
    echo "   python3 mega_scraper.py --start 1 --end 100"
    exit 0
else
    echo "🔴 API AINDA BLOQUEADA"
    echo "   Aguarde mais um pouco..."
    exit 1
fi
