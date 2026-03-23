#!/usr/bin/env python3
"""Send pipeline execution report by email."""
import os
import smtplib
import sys
from datetime import datetime
from email.mime.text import MIMEText


def send_report(exit_code: int, log_file: str) -> None:
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", 25))
    smtp_from = os.environ.get("SMTP_FROM", "noreply@ausoleil.app")
    notify_email = os.environ.get("NOTIFY_EMAIL")

    if not smtp_host or not notify_email:
        return

    with open(log_file) as f:
        log_content = f.read()

    date_str = datetime.now().strftime("%d/%m/%Y")
    status = "OK" if exit_code == 0 else f"ERREUR (code {exit_code})"

    subject = f"[ausoleil.app] Pipeline du {date_str} — {status}"

    # Extract summary (last lines after "====")
    lines = log_content.strip().split("\n")
    summary_lines = []
    for i, line in enumerate(lines):
        if "UPDATE PIPELINE" in line:
            summary_lines = lines[i:]
            break

    body = f"""Rapport du pipeline de mise à jour des terrasses
Date : {date_str}
Statut : {status}

{'=' * 50}
RÉSUMÉ
{'=' * 50}
{chr(10).join(summary_lines) if summary_lines else '(pas de résumé disponible)'}
"""

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = notify_email

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.sendmail(smtp_from, [notify_email], msg.as_string())
        print(f"[scheduler] Email envoyé à {notify_email}")
    except Exception as e:
        print(f"[scheduler] Erreur envoi email: {e}", file=sys.stderr)


if __name__ == "__main__":
    exit_code = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    log_file = sys.argv[2] if len(sys.argv) > 2 else "/tmp/pipeline_output.log"
    send_report(exit_code, log_file)
