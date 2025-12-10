# FROM --platform=$BUILDPLATFORM python:3.12-slim
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Copy any custom certificates if they exist (requires them to be in a directory named 'custom_certs' in the context)
# We use a pattern that won't fail if empty, or just instruct user.
# For simplicity, we assume user might mount them or copy them.
# Let's check for a specific ca file at runtime or build time.

# Best practice for build:
# COPY custom_certs/* /usr/local/share/ca-certificates/
# RUN update-ca-certificates

# Environment variables
ENV FLASK_APP=wsgi.py
ENV PYTHONUNBUFFERED=1
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

EXPOSE 5000

# Run with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "--preload", "wsgi:app"]
