.PHONY: restart logs

restart:
	@echo "🚀 Restarting Docker services..."
	@docker-compose --file docker-compose.dev.yml down -v
	@docker-compose --file docker-compose.dev.yml build --no-cache
	@docker-compose --file docker-compose.dev.yml up -d
	@echo "✅ Done! Check logs with: make logs"
