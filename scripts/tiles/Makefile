# Keep intermediates/outputs; don't auto-delete on failure
.PRECIOUS: $(BUILD_ROOT)/%.fgb $(BUILD_ROOT)/%.mbtiles $(OUTPUT)
.SECONDARY: $(BUILD_ROOT)/%.fgb $(BUILD_ROOT)/%.mbtiles

# ---------- paths ----------
DATA_ROOT   = ../../data
INPUT_ROOT  = $(DATA_ROOT)

# Shapefiles live under DATA_ROOT by year
GPKG_HUC10  = $(DATA_ROOT)/HUC10_CO.gpkg
GPKG_OWNER  = $(DATA_ROOT)/CO_merged_owner.gpkg

# Final joined tileset
OUTPUT      = tmp.pmtiles

# ---------- tools ----------
TILEJOIN    = tile-join
TIPPECANOE  = tippecanoe
OGRINFO     = ogrinfo
OGR2OGR     = ogr2ogr

# ---------- tiling options (harmonized) ----------
MAX_Z = 14
MIN_Z = 4
TIPPECANOE_OPTS = --minimum-zoom=$(MIN_Z) --maximum-zoom=$(MAX_Z) \
                  --coalesce-densest-as-needed --simplify-only-low-zooms \
                  --no-simplification-of-shared-nodes --extend-zooms-if-still-dropping \
                  --visvalingam --hilbert

# ---------- build dir ----------
BUILD_ROOT = build

# ---------- single-layer GPKGs ----------
# Each GPKG has exactly one layer; we don't enumerate layers—ogr2ogr will copy the sole layer.
HUC10_FGB  = $(BUILD_ROOT)/huc10.fgb
HUC10_MBT  = $(BUILD_ROOT)/huc10.mbtiles
OWNER_FGB  = $(BUILD_ROOT)/owner.fgb
OWNER_MBT  = $(BUILD_ROOT)/owner.mbtiles

# ---------- collect inputs ----------
# 1) SHPs (recursive)
SHPS      := $(shell find $(INPUT_ROOT) -type f -name '*.shp')
FGBS_SHP  := $(patsubst $(INPUT_ROOT)/%.shp,$(BUILD_ROOT)/%.fgb,$(SHPS))
MBT_SHP   := $(FGBS_SHP:.fgb=.mbtiles)

# All mbtiles to join
MBTILES := $(MBT_SHP) $(HUC10_MBT) $(OWNER_MBT)

.DEFAULT_GOAL := $(OUTPUT)

# ---------- utilities ----------
define make-dir
	@mkdir -p $(dir $@)
endef

list:
	@echo "=== SHP files ==="; echo "$(SHPS)" | tr ' ' '\n' || true
	@echo "=== HUC10 GPKG === $(GPKG_HUC10)"
	@echo "=== OWNER GPKG === $(GPKG_OWNER)"

# ---------- final join ----------
$(OUTPUT): $(MBTILES)
	$(TILEJOIN) -pk -o $@ $^

# ---------- conversions ----------
# SHP → FGB
$(BUILD_ROOT)/%.fgb: $(INPUT_ROOT)/%.shp
	$(make-dir)
	$(OGR2OGR) -f FlatGeobuf -t_srs "EPSG:4326" "$@" "$<"

# HUC10 (single-layer GPKG) → FGB
$(HUC10_FGB): $(GPKG_HUC10)
	$(make-dir)
	$(OGR2OGR) -f FlatGeobuf -t_srs "EPSG:4326" "$@" "$<"

# OWNER (single-layer GPKG) → FGB
$(OWNER_FGB): $(GPKG_OWNER)
	$(make-dir)
	$(OGR2OGR) -f FlatGeobuf -t_srs "EPSG:4326" "$@" "$<"

# HUC10 FGB → MBTiles
$(HUC10_MBT): $(HUC10_FGB)
	$(make-dir)
	@echo "Tippecanoe (HUC10)"; \
	$(TIPPECANOE) -f -o "$@" $(TIPPECANOE_OPTS) -L "huc10:$<" || true

# OWNER FGB → MBTiles
$(OWNER_MBT): $(OWNER_FGB)
	$(make-dir)
	@echo "Tippecanoe (OWNER)"; \
	$(TIPPECANOE) -f -o "$@" $(TIPPECANOE_OPTS) -L "owner:$<" || true

# FGB → MBTiles (generic)
$(BUILD_ROOT)/%.mbtiles: $(BUILD_ROOT)/%.fgb
	$(make-dir)
	@layer_name="$(notdir $*)"; \
	echo "Tippecanoe: $$layer_name"; \
	$(TIPPECANOE) -f -o "$@" $(TIPPECANOE_OPTS) -L "$$layer_name:$<" || true

clean:
	@echo "Cleaning intermediates (FGB only)…"
	@find $(BUILD_ROOT) -type f -name '*.fgb' -delete || true

purge:
	@echo "PURGE: removing build/ and $(OUTPUT)…"
	rm -rf $(BUILD_ROOT) $(OUTPUT)

.PHONY: clean purge list