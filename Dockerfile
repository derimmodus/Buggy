FROM python:3.12-slim

WORKDIR /app

# Installiere nur notwendige Abhängigkeiten
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopiere App-Code
COPY app/ ./app/
COPY static/ ./static/
COPY data/ ./data/

EXPOSE 5411

# Verwende Python direkt statt Flask CLI
CMD ["python", "app/main.py"]