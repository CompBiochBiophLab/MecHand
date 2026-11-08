# Build the MecHand manuscript (Journal of Cheminformatics, BMC / Springer Nature).
#
#   make            build main.pdf (downloads the journal template first if needed)
#   make view       build and open the PDF
#   make watch      rebuild automatically every time a source file is saved
#   make template   download the Springer Nature LaTeX template (sn-jnl.cls + .bst)
#   make clean      remove auxiliary files, keep main.pdf
#   make distclean  remove auxiliary files and main.pdf

MAIN          := main
LATEXMK       := latexmk
LATEXMK_FLAGS := -pdf -synctex=1 -interaction=nonstopmode -halt-on-error -file-line-error
OPEN          ?= open

# Springer Nature journal article template package (December 2024 version), linked from
# https://www.springernature.com/gp/authors/campaigns/latex-author-support
# BMC journals use this class too; BMC's old bmcart.cls is no longer distributed.
TEMPLATE_URL   := https://cms-resources.apps.public.k8s.springernature.io/springer-cms/rest/v1/content/18782940/data/v12
# Must match the reference-style option of \documentclass[...]{sn-jnl} in main.tex.
BST            := sn-vancouver-num
TEMPLATE_FILES := sn-jnl.cls $(BST).bst

.PHONY: all pdf view watch template clean distclean

all: pdf

pdf: template
	$(LATEXMK) $(LATEXMK_FLAGS) $(MAIN).tex

view: pdf
	$(OPEN) $(MAIN).pdf

watch: template
	$(LATEXMK) $(LATEXMK_FLAGS) -pvc -view=none $(MAIN).tex

# Downloads only if a template file is missing. kpsewhich looks in manuscript/
# first, then in the TeX installation.
template:
	@missing=; \
	for f in $(TEMPLATE_FILES); do \
	  kpsewhich "$$f" >/dev/null 2>&1 || missing="$$missing $$f"; \
	done; \
	if [ -z "$$missing" ]; then exit 0; fi; \
	echo "Missing:$$missing -> downloading the Springer Nature LaTeX template..."; \
	tmp=$$(mktemp -d); \
	if curl -fsSL -o "$$tmp/sn.zip" "$(TEMPLATE_URL)" && \
	   unzip -q -o -j "$$tmp/sn.zip" \
	     'sn-article-template/sn-jnl.cls' \
	     'sn-article-template/bst/$(BST).bst' -d . ; then \
	  rm -rf "$$tmp"; \
	  chmod 644 $(TEMPLATE_FILES); \
	  echo "Installed $(TEMPLATE_FILES) in manuscript/"; \
	else \
	  rm -rf "$$tmp"; \
	  echo "error: download failed. Get the 'journal article template package' from"; \
	  echo "  https://www.springernature.com/gp/authors/campaigns/latex-author-support"; \
	  echo "and copy sn-jnl.cls and bst/$(BST).bst into manuscript/."; \
	  exit 1; \
	fi

clean:
	$(LATEXMK) -c $(MAIN).tex
	rm -f $(MAIN).synctex.gz

distclean:
	$(LATEXMK) -C $(MAIN).tex
	rm -f $(MAIN).synctex.gz $(MAIN).bbl
