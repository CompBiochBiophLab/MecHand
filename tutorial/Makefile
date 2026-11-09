# Build the MecHand tutorial (PDF).
#
#   make            build mechand-tutorial.pdf
#   make view       build and open the PDF
#   make publish    build and copy the PDF to the website (docs/public/tutorial.pdf)
#   make figures    regenerate figures/*.tex with MecHand's own TikZ/chemfig export (needs Node.js)
#   make clean      remove auxiliary files, keep the PDF
#   make distclean  remove auxiliary files and the PDF
#
# Screenshots come from ../docs/public/img (shared with the website).

MAIN          := mechand-tutorial
LATEXMK       := latexmk
LATEXMK_FLAGS := -pdf -interaction=nonstopmode -halt-on-error -file-line-error
OPEN          ?= open
FIGURES       := sn2,diels_alder,radical_homolysis,lewis_adduct

.PHONY: all pdf view publish figures clean distclean

all: pdf

pdf:
	$(LATEXMK) $(LATEXMK_FLAGS) $(MAIN).tex

view: pdf
	$(OPEN) $(MAIN).pdf

publish: pdf
	cp $(MAIN).pdf ../docs/public/tutorial.pdf

figures:
	cd ../ketcher-mechhand && MECHAND_FIGURES_OUT=../tutorial/figures MECHAND_FIGURES=$(FIGURES) npm run export:figures

clean:
	$(LATEXMK) -c $(MAIN).tex

distclean:
	$(LATEXMK) -C $(MAIN).tex
