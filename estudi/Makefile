# Study documents → PDF (pandoc + XeLaTeX).   make -C estudi   ·   make -C estudi clean
DOCS   := $(sort $(wildcard [0-9][0-9]-*.md))
PDFS   := $(patsubst %.md,pdf/%.pdf,$(DOCS)) pdf/estimuls-atribucions.pdf
PANDOC := pandoc --pdf-engine=xelatex -H pdf-header.tex --resource-path=.:estimuls \
          -V geometry:margin=2.2cm -V fontsize=10pt -V lang=ca -V colorlinks=true

.PHONY: all clean
all: $(PDFS)

pdf/%.pdf: %.md pdf-header.tex | pdf
	$(PANDOC) $< -o $@

pdf/estimuls-atribucions.pdf: estimuls/ATRIBUCIONS.md pdf-header.tex | pdf
	$(PANDOC) -M title="Estímuls: atribucions i referències" -V geometry:landscape $< -o $@

pdf:
	mkdir -p pdf

clean:
	rm -rf pdf
