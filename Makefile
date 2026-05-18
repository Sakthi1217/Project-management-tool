.PHONY: help build up down restart logs seed reset ps shell-backend shell-db keycloak-up keycloak-setup

# ─── PP-AI — Comandos locales (Docker Desktop) ───────────────────────────────

help: ## Mostrar esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

build: ## Construir las imágenes desde el código fuente
	docker compose build

up: ## Levantar todos los servicios (build si no existen las imágenes)
	docker compose up -d --build
	@echo ""
	@echo "  ✅ App disponible en → http://localhost"
	@echo "  🔌 API directa       → http://localhost:3003/api/health"
	@echo "  🐘 Postgres          → localhost:5435 (user: ppai)"
	@echo ""

down: ## Detener y eliminar los contenedores (los volúmenes se conservan)
	docker compose down

restart: ## Reiniciar todos los servicios
	docker compose restart

logs: ## Ver logs de todos los servicios en tiempo real
	docker compose logs -f

logs-backend: ## Ver logs solo del backend
	docker compose logs -f backend

logs-db: ## Ver logs solo de la base de datos
	docker compose logs -f database

ps: ## Ver estado de los contenedores
	docker compose ps

seed: ## Cargar datos de ejemplo en la BD (usuarios de prueba)
	@echo "Cargando datos de ejemplo..."
	docker compose exec backend node dist/db/seed.js
	@echo ""
	@echo "  Cuentas creadas:"
	@echo "    admin@app.com  / admin123"
	@echo "    editor@app.com / editor123"
	@echo "    viewer@app.com / viewer123"
	@echo ""

shell-backend: ## Abrir terminal dentro del contenedor del backend
	docker compose exec backend sh

shell-db: ## Abrir psql dentro del contenedor de la BD
	docker compose exec database psql -U ppai -d ppai

reset: ## ⚠ Eliminar contenedores Y volúmenes (borra todos los datos)
	@echo "⚠  Esto eliminará TODOS los datos (BD y uploads)."
	@read -p "   Escribir 'si' para confirmar: " c; [ "$$c" = "si" ] || exit 1
	docker compose --profile keycloak down -v
	@echo "✅ Limpieza completa."

keycloak-up: ## Levantar todos los servicios incluyendo Keycloak SSO
	docker compose --profile keycloak up -d --build
	@echo ""
	@echo "  ✅ App disponible en       → http://localhost"
	@echo "  🔐 Keycloak Admin UI       → http://localhost:8180"
	@echo "  👤 Admin: $(shell grep KC_ADMIN_USER .env | cut -d= -f2) / $(shell grep KC_ADMIN_PASSWORD .env | cut -d= -f2)"
	@echo ""
	@echo "  Próximo paso: make keycloak-setup"
	@echo ""

keycloak-setup: ## Mostrar instrucciones para configurar el realm de Keycloak
	@echo ""
	@echo "  ╔══════════════════════════════════════════════════════════════════╗"
	@echo "  ║              Configuración de Keycloak SSO                      ║"
	@echo "  ╠══════════════════════════════════════════════════════════════════╣"
	@echo "  ║                                                                  ║"
	@echo "  ║  1. Abre Keycloak Admin:  http://localhost:8180                  ║"
	@echo "  ║     Login: KC_ADMIN_USER / KC_ADMIN_PASSWORD  (de tu .env)       ║"
	@echo "  ║                                                                  ║"
	@echo "  ║  2. Crear Realm                                                  ║"
	@echo "  ║     Realm name: ppai                                             ║"
	@echo "  ║                                                                  ║"
	@echo "  ║  3. Clients → Create client                                      ║"
	@echo "  ║     Client type:           OpenID Connect                        ║"
	@echo "  ║     Client ID:             ppai-app                              ║"
	@echo "  ║     Client authentication: ON  (confidential)                   ║"
	@echo "  ║     Valid redirect URIs:                                         ║"
	@echo "  ║       http://localhost/api/auth/keycloak/callback                ║"
	@echo "  ║     Web origins:  http://localhost                               ║"
	@echo "  ║                                                                  ║"
	@echo "  ║  4. Pestaña Credentials → copiar Client secret                   ║"
	@echo "  ║                                                                  ║"
	@echo "  ║  5. Editar .env                                                  ║"
	@echo "  ║     KEYCLOAK_CLIENT_SECRET=<el secret copiado>                   ║"
	@echo "  ║                                                                  ║"
	@echo "  ║  6. Reiniciar backend                                            ║"
	@echo "  ║     docker compose --profile keycloak up -d backend              ║"
	@echo "  ║                                                                  ║"
	@echo "  ║  7. Crear usuarios en Keycloak: Users → Add user                 ║"
	@echo "  ║     O federar con LDAP/AD en: User Federation                    ║"
	@echo "  ║                                                                  ║"
	@echo "  ╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
