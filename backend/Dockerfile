FROM alpine:3.20

ARG PB_VERSION=0.39.7
ARG PB_TARGET_ARCH=amd64

RUN apk add --no-cache ca-certificates unzip wget \
    && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_TARGET_ARCH}.zip" -O /tmp/pb.zip \
    && unzip -o /tmp/pb.zip -d /pb \
    && chmod +x /pb/pocketbase \
    && rm /tmp/pb.zip

COPY pb_migrations /pb_migrations
COPY pb_hooks /pb_hooks

WORKDIR /pb
EXPOSE 8080
VOLUME ["/pb_data"]

ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8080", "--dir=/pb_data", "--migrationsDir=/pb_migrations", "--hooksDir=/pb_hooks"]
