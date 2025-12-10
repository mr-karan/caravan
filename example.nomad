job "demo-app" {
  datacenters = ["dc1"]
  type        = "service"

  meta {
    version = "1.0"
    team    = "platform"
  }

  group "web" {
    count = 2

    update {
      max_parallel     = 1
      min_healthy_time = "10s"
      healthy_deadline = "3m"
      canary           = 1
      auto_revert      = true
    }

    restart {
      attempts = 3
      interval = "5m"
      delay    = "15s"
      mode     = "delay"
    }

    network {
      port "http" {
        to = 80
      }
    }

    service {
      name = "demo-web"
      port = "http"
      tags = ["urlprefix-/", "traefik.enable=true"]
      provider = "nomad"

      check {
        name     = "http-health"
        type     = "http"
        path     = "/"
        interval = "10s"
        timeout  = "3s"
      }
    }

    task "nginx" {
      driver = "docker"

      config {
        image = "nginxdemos/hello:latest"
        ports = ["http"]
      }

      resources {
        cpu    = 100
        memory = 64
      }

      env {
        NGINX_PORT = "80"
      }
    }
  }

  group "api" {
    count = 1

    network {
      port "api" {
        to = 8080
      }
    }

    service {
      name = "demo-api"
      port = "api"
      provider = "nomad"

      check {
        name     = "api-ready"
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "whoami" {
      driver = "docker"

      config {
        image = "traefik/whoami:latest"
        ports = ["api"]
        args  = ["--port", "8080"]
      }

      resources {
        cpu    = 50
        memory = 32
      }
    }
  }

  group "cache" {
    count = 1

    network {
      port "redis" {
        to = 6379
      }
    }

    service {
      name = "demo-cache"
      port = "redis"
      provider = "nomad"

      check {
        name     = "redis-alive"
        type     = "tcp"
        interval = "10s"
        timeout  = "2s"
      }
    }


    task "redis" {
      driver = "docker"

      config {
        image = "redis:7-alpine"
        ports = ["redis"]
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }
  }
}
