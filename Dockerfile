FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libsqlite3-0 libdbus-1-3 libglib2.0-0 libssl3 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY streamforge-server /usr/local/bin/

EXPOSE 5004
VOLUME /data

ENTRYPOINT ["streamforge-server", "--data-dir", "/data", "--bind", "0.0.0.0"]
