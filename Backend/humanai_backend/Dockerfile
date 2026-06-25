# Use the official Python 3.13 slim image
FROM python:3.13-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Set work directory
WORKDIR /app

# Install system dependencies required by WeasyPrint and PostgreSQL/cffi
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libjpeg-dev \
    libopenjp2-7-dev \
    libgirepository1.0-dev \
    shared-mime-info \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app /app/app

# Create non-root system user and group for security hardening
RUN groupadd -r humanai && useradd -r -g humanai -d /app -s /sbin/nologin humanai \
    && chown -R humanai:humanai /app

# Switch to non-root user
USER humanai

# Expose port
EXPOSE 8000

# Start FastAPI application with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

