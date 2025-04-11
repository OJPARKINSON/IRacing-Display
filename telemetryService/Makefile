.PHONY: restart logs

restart:
	@echo "🚀 Restarting Docker services..."
	@docker-compose down -v
	@docker-compose build --no-cache
	@docker-compose up -d
	@echo "✅ Done! Check logs with: make logs"

logs:
	@docker-compose logs -f go_app