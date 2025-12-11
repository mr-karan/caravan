# syntax=docker/dockerfile:1
ARG IMAGE_BASE=alpine:3.22.2@sha256:4b7ce07002c69e8f3d704a9c5d6fd3053be500b7f1c69fc0d80990c2ad8dd412
FROM ${IMAGE_BASE} AS image-base

# Build backend
FROM --platform=${BUILDPLATFORM} golang:1.24.10@sha256:58364c0a7d53e26b6e5b83cf186b4e9d5fa078c4f5e728f9d9a7b972f689a84a AS backend-build

WORKDIR /caravan

ARG TARGETOS
ARG TARGETARCH
ENV GOPATH=/go \
    GOPROXY=https://proxy.golang.org \
    GO111MODULE=on \
    CGO_ENABLED=0 \
    GOOS=${TARGETOS} \
    GOARCH=${TARGETARCH}

# Download dependencies
COPY ./backend/go.* /caravan/backend/
RUN --mount=type=cache,target=/go/pkg/mod \
    cd ./backend && go mod download

# Build backend
COPY ./backend /caravan/backend
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    cd ./backend && go build -o ./caravan-server ./cmd/

# Build frontend
FROM --platform=${BUILDPLATFORM} oven/bun:1@sha256:bb8bd32956bb38e896c57a3c62a3e93f86f8e8a792e9aa05cc571fc2ad6e52fa AS frontend-build

WORKDIR /caravan

# Copy .git for version info and package.json for build
COPY .git/ ./caravan/.git/
COPY package.json /caravan/package.json

# Install dependencies
COPY frontend/package.json frontend/bun.lock /caravan/frontend/
RUN cd ./frontend && bun install --frozen-lockfile

# Build frontend
COPY ./frontend /caravan/frontend
RUN cd ./frontend && bun run build

# Create empty plugins directory
RUN mkdir -p /caravan/plugins

# Final image
FROM image-base AS final

RUN addgroup -S caravan && adduser -S caravan -G caravan

COPY --from=backend-build --link /caravan/backend/caravan-server /caravan/caravan-server
COPY --from=frontend-build --link /caravan/frontend/build /caravan/frontend
COPY --from=frontend-build --link /caravan/plugins /caravan/plugins

RUN chown -R caravan:caravan /caravan
USER caravan

EXPOSE 4466

ENTRYPOINT ["/caravan/caravan-server", "-html-static-dir", "/caravan/frontend", "-plugins-dir", "/caravan/plugins"]
