FROM python:3.10-slim

WORKDIR /app

# Create system group and non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /bin/bash appuser

# Backend pins + frontend-only packages (see backend/requirements-dev.txt)
COPY --chown=appuser:appgroup backend/requirements.txt /app/backend/requirements.txt

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/backend/requirements.txt && \
    pip install --no-cache-dir requests==2.32.3 streamlit==1.39.0 plotly==5.24.1

# Copy configs (frontend app imports config_loader) and frontend source
COPY --chown=appuser:appgroup configs /app/configs
COPY --chown=appuser:appgroup frontend /app/frontend

WORKDIR /app/frontend

USER appuser

EXPOSE 8501

ENV STREAMLIT_SERVER_PORT=8501
ENV STREAMLIT_SERVER_ADDRESS=0.0.0.0
ENV PYTHONPATH=/app

CMD ["streamlit", "run", "app.py"]
