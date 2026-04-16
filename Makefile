# ============================================================
# ShadowLink Monorepo — Unified Build Commands
# ============================================================

PYTHON   := D:/software/study/Ana/envs/shadowlink/python.exe
PIP      := $(PYTHON) -m pip
UVICORN  := $(PYTHON) -m uvicorn
MVNW     := cd shadowlink-server && mvnw.cmd
NPM_WEB  := cd shadowlink-web && npm

.PHONY: help dev dev-java dev-ai dev-web build build-java build-ai build-web test test-java test-ai lint docker-up docker-down clean

help: ## Show available targets
	@echo "ShadowLink Makefile targets:"
	@echo ""
	@echo "  dev          Start all services in development mode"
	@echo "  dev-java     Start Java backend (Spring Boot)"
	@echo "  dev-ai       Start Python AI service (FastAPI)"
	@echo "  dev-web      Start React frontend (Vite)"
	@echo ""
	@echo "  build        Build all projects"
	@echo "  build-java   Build Java backend"
	@echo "  build-ai     Install Python AI dependencies"
	@echo "  build-web    Build React frontend"
	@echo ""
	@echo "  test         Run all tests"
	@echo "  test-java    Run Java tests"
	@echo "  test-ai      Run Python tests"
	@echo "  lint         Lint Python code"
	@echo ""
	@echo "  docker-up    Start production stack (Docker Compose)"
	@echo "  docker-down  Stop production stack"
	@echo "  clean        Clean all build artifacts"

# ── Development ──

dev-java: ## Start Java backend
	$(MVNW) spring-boot:run

dev-ai: ## Start Python AI service
	$(UVICORN) app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir shadowlink-ai

dev-web: ## Start React frontend
	$(NPM_WEB) run dev

# ── Build ──

build: build-java build-ai build-web ## Build all

build-java: ## Build Java backend
	$(MVNW) clean package -DskipTests

build-ai: ## Install Python AI dependencies
	$(PIP) install -e "shadowlink-ai[dev]"

build-web: ## Build React frontend
	$(NPM_WEB) install
	$(NPM_WEB) run build

# ── Test ──

test: test-java test-ai ## Run all tests

test-java: ## Run Java tests
	$(MVNW) test

test-ai: ## Run Python tests
	$(PYTHON) -m pytest shadowlink-ai/tests -v

# ── Lint ──

lint: ## Lint Python code
	$(PYTHON) -m ruff check shadowlink-ai/

# ── Docker ──

docker-up: ## Start production stack
	cd deploy && docker compose up -d --build

docker-down: ## Stop production stack
	cd deploy && docker compose down

# ── Clean ──

clean: ## Clean all build artifacts
	cd shadowlink-server && mvnw.cmd clean 2>/dev/null || true
	rm -rf shadowlink-web/dist shadowlink-web/node_modules
	rm -rf shadowlink-electron/dist shadowlink-electron/node_modules
	rm -rf shadowlink-ai/*.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
