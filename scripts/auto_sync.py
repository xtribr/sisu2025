#!/usr/bin/env python3
"""
XTRI SISU 2026 - Auto Sync Scheduler
Executa sincronização automática a cada 60 minutos
"""

import subprocess
import sys
import time
from datetime import datetime
import os

# Configurações
SYNC_INTERVAL_MINUTES = 60
SCRIPT_PATH = os.path.join(os.path.dirname(__file__), 'full_data_sync.py')

def log(message):
    """Log com timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}")

def run_sync():
    """Executa o script de sincronização"""
    log("🔄 Iniciando sincronização...")
    
    try:
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(SCRIPT_PATH)
        )
        
        if result.returncode == 0:
            log("✅ Sincronização concluída com sucesso!")
            # Mostrar últimas linhas do output
            lines = result.stdout.strip().split('\n')
            for line in lines[-5:]:
                if line.strip():
                    log(f"   {line}")
        else:
            log(f"❌ Erro na sincronização (código {result.returncode})")
            if result.stderr:
                log(f"   Erro: {result.stderr[:200]}")
                
    except Exception as e:
        log(f"❌ Exceção ao executar sync: {e}")

def main():
    log("=" * 60)
    log("🚀 XTRI SISU 2026 - Auto Sync Scheduler")
    log(f"📅 Intervalo: {SYNC_INTERVAL_MINUTES} minutos")
    log("=" * 60)
    log("")
    log("Pressione Ctrl+C para parar")
    log("")
    
    # Primeira execução imediata
    run_sync()
    
    while True:
        # Calcular próxima execução
        next_run = datetime.now().timestamp() + (SYNC_INTERVAL_MINUTES * 60)
        next_run_time = datetime.fromtimestamp(next_run).strftime('%H:%M:%S')
        
        log(f"⏰ Próxima sincronização: {next_run_time}")
        log("")
        
        try:
            # Aguardar intervalo
            time.sleep(SYNC_INTERVAL_MINUTES * 60)
            
            # Executar sync
            run_sync()
            
        except KeyboardInterrupt:
            log("")
            log("🛑 Scheduler interrompido pelo usuário")
            break

if __name__ == "__main__":
    main()
