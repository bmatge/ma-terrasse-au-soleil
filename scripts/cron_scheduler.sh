#!/bin/sh
# Lightweight cron scheduler — runs inside Docker without requiring cron daemon.
# Executes the update pipeline daily at CRON_HOUR (default: 3 = 3h du matin).

CRON_HOUR="${CRON_HOUR:-3}"

echo "[scheduler] Démarré — pipeline prévu chaque jour à ${CRON_HOUR}h00"

while true; do
    CURRENT_HOUR=$(date +%H)
    CURRENT_MIN=$(date +%M)

    if [ "$CURRENT_HOUR" -eq "$CRON_HOUR" ] && [ "$CURRENT_MIN" -eq "0" ]; then
        echo "[scheduler] $(date '+%Y-%m-%d %H:%M:%S') — Lancement du pipeline"
        cd /app && python -m data.update_pipeline 2>&1
        EXIT_CODE=$?

        if [ $EXIT_CODE -eq 0 ]; then
            echo "[scheduler] $(date '+%Y-%m-%d %H:%M:%S') — Pipeline terminé avec succès"
        else
            echo "[scheduler] $(date '+%Y-%m-%d %H:%M:%S') — Pipeline échoué (exit code: $EXIT_CODE)" >&2
        fi

        # Dormir 61 minutes pour ne pas relancer dans la même heure
        sleep 3660
    else
        # Vérifier toutes les 30 secondes
        sleep 30
    fi
done
