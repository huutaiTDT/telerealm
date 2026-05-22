ARG BUILDPLATFORM=linux/amd64
FROM --platform=$BUILDPLATFORM golang:1.23-alpine3.22 AS builder

ARG TARGETOS
ARG TARGETARCH

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} \
	go build -trimpath -ldflags="-s -w" -o /app/server ./main.go

RUN mkdir -p /app/storage/multipart/sessions /app/storage/multipart/files /app/data

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /app/server ./server
COPY --from=builder --chown=nonroot:nonroot /app/ui ./ui
COPY --from=builder --chown=nonroot:nonroot /app/storage ./storage
COPY --from=builder --chown=nonroot:nonroot /app/data ./data
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV TELEGRAM_MAX_UPLOAD_MB=2048
EXPOSE 7777

CMD ["./server"]