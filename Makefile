.PHONY: restart logs

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

restart:
	@echo "🚀 Restarting Docker services..."
	@docker-compose --file docker-compose.yml down -v
	@docker-compose --file docker-compose.yml build --no-cache
	@docker-compose --file docker-compose.yml up -d
	@echo "✅ Done! Check logs with: make logs"

restart-dev:
	@echo "🚀 Restarting Docker services..."
	@docker-compose --file docker-compose.dev.yml down -v
	@docker-compose --file docker-compose.dev.yml build --no-cache
	@docker-compose --file docker-compose.dev.yml up -d
	@echo "✅ Done! Check logs with: make logs"

restart-lite:
	@echo "🚀 Restarting Dashboard..."
	@docker-compose --file docker-compose.dev.yml build --no-cache 
	@docker-compose --file docker-compose.dev.yml up -d
	@echo "✅ Done! Check logs with: make logs"
