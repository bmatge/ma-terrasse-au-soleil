FROM python:3.12-slim AS base
WORKDIR /app
RUN pip install --no-cache-dir uv

FROM base AS dev
COPY pyproject.toml .
RUN uv pip install --system -e ".[dev,data]"
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS production
COPY pyproject.toml .
RUN uv pip install --system ".[data]"
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
