// components/FretePorArea.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Chip,
  Stack,
} from "@mui/material";
import { Save, Edit, Delete, Replay } from "@mui/icons-material";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

const FretePorArea = ({
  mockAreas,
  setMockAreas,
  restauranteId,
  API_URL,
  setSnackbar,
}) => {
  const [valorArea, setValorArea] = useState(0);
  const [multiplasAreas, setMultiplasAreas] = useState(false);
  const [valoresAreas, setValoresAreas] = useState({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editValor, setEditValor] = useState("");
  const [deleteIndex, setDeleteIndex] = useState(null);

  const [modoDesenhoAtivo, setModoDesenhoAtivo] = useState(false);
  const [areaSelecionadaIndex, setAreaSelecionadaIndex] = useState(null);

  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const draw = useRef(null);
  const popupRefs = useRef({});
  const valoresAreasRef = useRef(valoresAreas);

  useEffect(() => {
    valoresAreasRef.current = valoresAreas;
  }, [valoresAreas]);

  // Atualiza nomes das áreas (editáveis nos popups)
  const updateAreaNames = () => {
    const areas = draw.current?.getAll();
    if (!areas || areas.features.length === 0) return;

    setValoresAreas((prev) => {
      const updated = { ...prev };

      areas.features.forEach((feature) => {
        const el = document.getElementById(`label-${feature.id}`);
        const prevData = prev[feature.id] || {};
        updated[feature.id] = {
          nome: el?.innerText || prevData.nome || "Área",
          valor:
            typeof prevData.valor === "number"
              ? prevData.valor
              : parseFloat(prevData.valor) || 0,
        };
      });

      return updated;
    });
  };

  // Inicializa mapa + draw (somente uma vez)
  useEffect(() => {
    if (mapContainer.current && !mapRef.current) {
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-34.877, -8.063],
        zoom: 12,
      });

      const drawControl = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });

      map.addControl(drawControl, "top-right");

      map.on("load", () => {
        drawControl.changeMode("draw_polygon");
        setModoDesenhoAtivo(true);
      });

      // Quando cria uma nova área
      map.on("draw.create", (e) => {
        setModoDesenhoAtivo(false);

        e.features.forEach((feature) => {
          const featureId = feature.id;
          const coords = feature.geometry.coordinates[0];

          const center = coords
            .reduce(
              (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
              [0, 0]
            )
            .map((c) => c / coords.length);

          const currentValues = valoresAreasRef.current;
          const nomePadrao = `Área ${
            Object.keys(currentValues || {}).length + 1
          }`;

          const popup = new mapboxgl.Popup({ closeOnClick: false })
            .setLngLat(center)
            .setHTML(
              `<strong contenteditable='true' id='label-${featureId}' onblur='window.dispatchEvent(new CustomEvent("nomeAreaEditado"))'>${nomePadrao}</strong><br/><small>Defina o valor abaixo e clique em Salvar</small>`
            )
            .addTo(map);

          popupRefs.current[featureId] = popup;

          setValoresAreas((prev) => ({
            ...prev,
            [featureId]: {
              nome: nomePadrao,
              valor: prev[featureId]?.valor || 0,
            },
          }));
        });
      });

      map.on("draw.modechange", (e) => {
        setModoDesenhoAtivo(e.mode === "draw_polygon");
      });

      mapRef.current = map;
      draw.current = drawControl;

      window.addEventListener("nomeAreaEditado", updateAreaNames);

      return () => {
        window.removeEventListener("nomeAreaEditado", updateAreaNames);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    }
  }, []);

  // Renderiza / atualiza as áreas salvas no mapa sempre que mockAreas muda
  useEffect(() => {
    if (!mapRef.current || !draw.current) return;

    // Limpa desenhos atuais e popups
    draw.current.deleteAll();
    Object.values(popupRefs.current).forEach((popup) => popup.remove());
    popupRefs.current = {};
    setValoresAreas({});
    valoresAreasRef.current = {};

    if (!mockAreas || mockAreas.length === 0) return;

    const features = mockAreas
      .filter((area) => Array.isArray(area.coordenadas))
      .map((area, i) => ({
        id: `area-salva-${i}`,
        type: "Feature",
        properties: {
          nome: area.nome,
          valor: area.valor,
        },
        geometry: {
          type: "Polygon",
          coordinates: area.coordenadas,
        },
      }));

    if (features.length === 0) return;

    const map = mapRef.current;

    features.forEach((feat) => {
      draw.current.add(feat);

      const coords = feat.geometry.coordinates[0];
      const center = coords
        .reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0])
        .map((n) => n / coords.length);

      const valorNum = Number(feat.properties.valor || 0);

      const popup = new mapboxgl.Popup({ closeOnClick: false })
        .setLngLat(center)
        .setHTML(
          `<strong>${feat.properties.nome || "Área"}</strong><br/><small>R$ ${valorNum.toFixed(
            2
          )}</small>`
        )
        .addTo(map);

      popupRefs.current[feat.id] = popup;
    });

    // Autozoom para mostrar todas as áreas
    const featureCollection = {
      type: "FeatureCollection",
      features,
    };

    try {
      const [minX, minY, maxX, maxY] = turf.bbox(featureCollection);
      map.fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        { padding: 40 }
      );
    } catch (err) {
      console.warn("Erro ao calcular bbox das áreas:", err);
    }
  }, [mockAreas]);

  // Highlight de uma área específica no mapa
  const focarAreaNoMapa = (index) => {
    if (!mapRef.current || !mockAreas[index]?.coordenadas) return;

    const coords = mockAreas[index].coordenadas[0];
    const feature = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [coords],
      },
    };

    const map = mapRef.current;

    // Fonte / layer para highlight
    const highlightId = "area-highlight";

    if (map.getSource(highlightId)) {
      map.getSource(highlightId).setData(feature);
    } else {
      map.addSource(highlightId, {
        type: "geojson",
        data: feature,
      });

      map.addLayer({
        id: `${highlightId}-fill`,
        type: "fill",
        source: highlightId,
        paint: {
          "fill-color": "#ff7a3d",
          "fill-opacity": 0.12,
        },
      });

      map.addLayer({
        id: `${highlightId}-outline`,
        type: "line",
        source: highlightId,
        paint: {
          "line-color": "#ff7a3d",
          "line-width": 3,
        },
      });
    }

    // Zoom naquela área
    try {
      const [minX, minY, maxX, maxY] = turf.bbox(feature);
      map.fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        { padding: 40 }
      );
    } catch (err) {
      console.warn("Erro ao focar área:", err);
    }

    setAreaSelecionadaIndex(index);
  };

  const verTodasAreas = () => {
    if (!mockAreas || mockAreas.length === 0 || !mapRef.current) return;

    const features = mockAreas
      .filter((area) => Array.isArray(area.coordenadas))
      .map((area) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: area.coordenadas,
        },
      }));

    if (features.length === 0) return;

    const featureCollection = {
      type: "FeatureCollection",
      features,
    };

    try {
      const [minX, minY, maxX, maxY] = turf.bbox(featureCollection);
      mapRef.current.fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        { padding: 40 }
      );
    } catch (err) {
      console.warn("Erro ao ver todas as áreas:", err);
    }

    setAreaSelecionadaIndex(null);
  };

  // Salvar áreas desenhadas no mapa
  const salvarMock = async () => {
    updateAreaNames();

    const areas = draw.current?.getAll();
    const novas =
      areas?.features.map((f) => ({
        tipo: multiplasAreas ? "multipla" : "individual",
        nome:
          document.getElementById(`label-${f.id}`)?.innerText || "Área",
        valor:
          parseFloat(
            multiplasAreas
              ? valoresAreasRef.current[f.id]?.valor
              : valorArea
          ) || 0,
        coordenadas: f.geometry.coordinates,
      })) || [];

    const areasFinal = [...mockAreas, ...novas];

    try {
      await fetch(`${API_URL}/api/frete/area/${restauranteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areas: areasFinal,
          tipo: "area",
        }),
      });

      setMockAreas(areasFinal);
      setValoresAreas({});
      valoresAreasRef.current = {};
      setValorArea(0);
      setModoDesenhoAtivo(false);

      setSnackbar({
        open: true,
        message: "Áreas salvas com sucesso!",
        severity: "success",
      });

      // zera desenhos temporários (o efeito de mockAreas redesenha tudo bonitinho)
      draw.current?.deleteAll();
    } catch (err) {
      console.error("Erro ao salvar dados de frete", err);
      setSnackbar({
        open: true,
        message: "Erro ao salvar áreas",
        severity: "error",
      });
    }
  };

  const redesenharArea = () => {
    if (!draw.current) return;
    draw.current.changeMode("draw_polygon");
    setModoDesenhoAtivo(true);

    // não mexe nas áreas já salvas (mockAreas), apenas entra em modo desenho
  };

  const editarArea = (index) => {
    setEditIndex(index);
    setEditNome(mockAreas[index].nome);
    setEditValor(mockAreas[index].valor);
    setEditDialogOpen(true);
  };

  const confirmarEdicao = async () => {
    const atualizadas = [...mockAreas];
    atualizadas[editIndex] = {
      ...atualizadas[editIndex],
      nome: editNome,
      valor: parseFloat(editValor),
    };
    setMockAreas(atualizadas);
    setEditDialogOpen(false);

    try {
      await fetch(`${API_URL}/api/frete/area/${restauranteId}/${editIndex}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: editNome,
          valor: parseFloat(editValor),
        }),
      });
      setSnackbar({
        open: true,
        message: "Área atualizada com sucesso!",
        severity: "success",
      });
    } catch (err) {
      console.error("Erro ao atualizar área", err);
      setSnackbar({
        open: true,
        message: "Erro ao atualizar área",
        severity: "error",
      });
    }
  };

  const deletarArea = (index) => {
    setDeleteIndex(index);
  };

  const confirmarDeleteArea = async () => {
    const index = deleteIndex;
    if (index === null) return;

    const atualizadas = mockAreas.filter((_, i) => i !== index);
    setMockAreas(atualizadas);
    setDeleteIndex(null);

    try {
      await fetch(`${API_URL}/api/frete/area/${restauranteId}/${index}`, {
        method: "DELETE",
      });
      setSnackbar({
        open: true,
        message: "Área deletada.",
        severity: "info",
      });
    } catch (err) {
      console.error("Erro ao deletar área", err);
      setSnackbar({
        open: true,
        message: "Erro ao deletar área",
        severity: "error",
      });
    }
  };

  const cancelarDeleteArea = () => setDeleteIndex(null);

  return (
    <Paper sx={{ p: 2 }} elevation={3}>
      {/* Header + ações rápidas */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
      >
        <Typography variant="subtitle1" fontWeight="medium">
          Frete por Área no Mapa
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            label={
              modoDesenhoAtivo ? "Modo desenho ativo" : "Visualizando áreas"
            }
            color={modoDesenhoAtivo ? "primary" : "default"}
            variant={modoDesenhoAtivo ? "filled" : "outlined"}
          />

          <Button
            variant="outlined"
            color="primary"
            startIcon={<Replay />}
            size="small"
            onClick={redesenharArea}
          >
            Redesenhar área
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<Save />}
            onClick={salvarMock}
            size="small"
          >
            Salvar
          </Button>
        </Stack>
      </Box>

      {/* Ajuda rápida */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Clique no mapa para desenhar o polígono da área de entrega.
        Depois defina o valor do frete e clique em <strong>Salvar</strong>.
      </Typography>

      <FormControlLabel
        control={
          <Checkbox
            checked={multiplasAreas}
            onChange={(e) => setMultiplasAreas(e.target.checked)}
          />
        }
        label="Permitir múltiplas áreas com valores diferentes"
      />

      {multiplasAreas ? (
        Object.entries(valoresAreas).map(([featureId, data]) => (
          <TextField
            key={featureId}
            label={`Valor da ${data.nome}`}
            type="number"
            value={data.valor}
            onChange={(e) =>
              setValoresAreas((prev) => ({
                ...prev,
                [featureId]: {
                  ...prev[featureId],
                  valor: e.target.value,
                },
              }))
            }
            sx={{ my: 1, maxWidth: 220, display: "block" }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">R$</InputAdornment>
              ),
            }}
          />
        ))
      ) : (
        <TextField
          label="Valor do frete para área desenhada"
          type="number"
          value={valorArea}
          onChange={(e) => setValorArea(e.target.value)}
          sx={{ my: 2, maxWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">R$</InputAdornment>
            ),
          }}
        />
      )}

      <Box
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          border: "2px solid #ccc",
          boxShadow: 1,
          height: 400,
          my: 2,
        }}
      >
        <div ref={mapContainer} style={{ height: "100%", width: "100%" }} />
      </Box>

      {mockAreas.length > 0 && (
        <Box mt={3}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            mb={1}
          >
            <Typography variant="h6">Áreas Salvas</Typography>

            <Button size="small" onClick={verTodasAreas}>
              Ver todas as áreas
            </Button>
          </Stack>

          <List>
            {mockAreas.map((area, index) => (
              <ListItem
                key={index}
                divider
                button
                onClick={() => focarAreaNoMapa(index)}
                selected={areaSelecionadaIndex === index}
              >
                <ListItemText
                  primary={area.nome}
                  secondary={`Valor: R$ ${parseFloat(
                    area.valor
                  ).toFixed(2)} • Tipo: ${area.tipo}`}
                />
                <IconButton onClick={(e) => { e.stopPropagation(); editarArea(index); }}>
                  <Edit />
                </IconButton>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    deletarArea(index);
                  }}
                >
                  <Delete />
                </IconButton>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Dialog de edição */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
      >
        <DialogTitle>Editar Área</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome da área"
            value={editNome}
            onChange={(e) => setEditNome(e.target.value)}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Valor do frete"
            type="number"
            value={editValor}
            onChange={(e) => setEditValor(e.target.value)}
            fullWidth
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">R$</InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={confirmarEdicao}
            variant="contained"
            color="primary"
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmação de delete */}
      <Dialog open={deleteIndex !== null} onClose={cancelarDeleteArea}>
        <DialogTitle>Remover área</DialogTitle>
        <DialogContent>
          Tem certeza que deseja excluir esta área? Essa ação não pode ser
          desfeita.
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelarDeleteArea}>Cancelar</Button>
          <Button
            onClick={confirmarDeleteArea}
            color="error"
            variant="contained"
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default FretePorArea;
