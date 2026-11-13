# MecHand — common tasks. Needs Node.js (macOS: brew install node).
#
#   make install     install the dependencies of the app and of the website
#   make dev         MecHand with live reload at http://localhost:5173
#   make site        build app + website exactly as GitHub Pages does and serve them at
#                    http://localhost:8080/MecHand/  (app: http://localhost:8080/MecHand/app/)
#   make test        type check, unit tests, recognition benchmark, LaTeX export check
#   make e2e         browser tests in Chromium, Firefox and WebKit
#   make server      optional DECIMER recognition server at http://localhost:8000 (Python 3.10–3.13)
#   make tutorial    tutorial PDF

APP    := ketcher-mechhand
SITE   := .site
PORT   ?= 8080
PYTHON ?= python3.13

.PHONY: install dev site test e2e server tutorial

install:
	cd $(APP) && npm ci
	cd docs && npm ci

dev:
	cd $(APP) && npm run dev

site:
	rm -rf $(SITE)
	cd docs && npx vitepress build
	mkdir -p $(SITE) && cp -r docs/.vitepress/dist $(SITE)/MecHand
	cd $(APP) && MECHAND_BASE=/MecHand/app/ npx vite build --outDir ../$(SITE)/MecHand/app --emptyOutDir
	@echo "Website: http://localhost:$(PORT)/MecHand/   App: http://localhost:$(PORT)/MecHand/app/   (Ctrl+C to stop)"
	cd $(SITE) && python3 -m http.server $(PORT) --bind 127.0.0.1

test:
	cd $(APP) && npm run typecheck && npm test
	cd $(APP) && npm run test:latex

e2e:
	cd $(APP) && npx playwright install chromium firefox webkit && npm run e2e

server:
	test -d backend/.venv || $(PYTHON) -m venv backend/.venv
	backend/.venv/bin/pip install -q -r backend/requirements.txt
	cd backend && .venv/bin/uvicorn main:app --port 8000

tutorial:
	$(MAKE) -C tutorial
