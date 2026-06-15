import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Badge,
  Chip,
} from "@mui/material";

import HomeIcon from "@mui/icons-material/Home";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import StoreIcon from "@mui/icons-material/Store";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import SettingsIcon from "@mui/icons-material/Settings";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import GroupIcon from "@mui/icons-material/Group";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import { usePedidos } from "../contexts/PedidosContext";

const DRAWER_WIDTH = 270;

const Sidebar = () => {
  const { pathname } = useLocation();
  const { pedidos } = usePedidos();

  const pedidosPendentes = pedidos.filter(
    (p) => p.status === "pago" || p.status === "em_producao"
  ).length;

  const menu = [
    { label: "Dashboard", icon: <HomeIcon />, path: "/dashboard", badge: pedidosPendentes },
    { label: "Pedidos", icon: <ShoppingCartIcon />, path: "/pedidos" },
    { label: "Produtos", icon: <StoreIcon />, path: "/produtos" },
    { label: "Estoque", icon: <Inventory2Icon />, path: "/estoque" },
    { label: "Caixa", icon: <PointOfSaleIcon />, path: "/caixa" },
    { label: "Mesas", icon: <TableRestaurantIcon />, path: "/mesas" },
    { label: "Garçons", icon: <GroupIcon />, path: "/garcons" },
    { label: "Motoristas", icon: <LocalShippingIcon />, path: "/motoristas" },
    { label: "Frete", icon: <MapRoundedIcon />, path: "/fretes" },
    { label: "Configurações", icon: <SettingsIcon />, path: "/configuracoes" },
    { label: "Diagnóstico", icon: <MonitorHeartIcon />, path: "/diagnostico" },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          borderRight: 0,
          color: "white",
          background:
            "radial-gradient(circle at 20% 0%, rgba(255,255,255,.28), transparent 18rem), linear-gradient(180deg, #ff3b8a 0%, #ff7a45 52%, #ff9b2d 100%)",
          display: "flex",
          flexDirection: "column",
          p: 2,
          overflow: "hidden",
          boxShadow: "20px 0 60px rgba(255,59,138,.18)",
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 12,
            borderRadius: 5,
            border: "1px solid rgba(255,255,255,.16)",
            pointerEvents: "none",
          },
        },
      }}
    >
      <Box sx={{ position: "relative", zIndex: 1, px: 1, pt: 1.5, pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.4 }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: 3,
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,.20)",
              border: "1px solid rgba(255,255,255,.28)",
              boxShadow: "0 14px 30px rgba(0,0,0,.12)",
              backdropFilter: "blur(12px)",
            }}
          >
            <RocketLaunchIcon />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 950,
                fontSize: 21,
                lineHeight: 1,
                letterSpacing: -0.5,
                textShadow: "0 3px 16px rgba(0,0,0,.16)",
              }}
            >
              Movyo Food
            </Typography>
            <Typography sx={{ fontSize: 12, opacity: 0.82, mt: 0.45, fontWeight: 700 }}>
              Painel do Restaurante
            </Typography>
          </Box>
        </Box>

        <Chip
          size="small"
          label="Operação em tempo real"
          sx={{
            mt: 2,
            color: "white",
            bgcolor: "rgba(255,255,255,.16)",
            border: "1px solid rgba(255,255,255,.20)",
            backdropFilter: "blur(10px)",
          }}
        />
      </Box>

      <List sx={{ position: "relative", zIndex: 1, flexGrow: 1, pt: 1 }}>
        {menu.map(({ label, icon, path, badge }) => {
          const active = pathname === path || (path === "/dashboard" && pathname === "/");

          return (
            <ListItem
              key={path}
              component={Link}
              to={path}
              sx={{
                position: "relative",
                mb: 0.9,
                borderRadius: 3.2,
                px: 1.45,
                py: 1.12,
                color: "white",
                transition: "transform .18s ease, background .18s ease, box-shadow .18s ease",
                background: active ? "rgba(255,255,255,.24)" : "rgba(255,255,255,.07)",
                border: active ? "1px solid rgba(255,255,255,.32)" : "1px solid rgba(255,255,255,.10)",
                backdropFilter: "blur(12px)",
                boxShadow: active ? "0 16px 34px rgba(0,0,0,.14)" : "none",
                overflow: "hidden",
                "&::before": active
                  ? {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 10,
                      bottom: 10,
                      width: 4,
                      borderRadius: 99,
                      bgcolor: "white",
                    }
                  : {},
                "&:hover": {
                  background: active ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.14)",
                  transform: "translateX(4px)",
                },
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: 42 }}>
                {badge > 0 ? (
                  <Badge
                    badgeContent={badge}
                    sx={{
                      "& .MuiBadge-badge": {
                        backgroundColor: "#fff",
                        color: "#ff3b8a",
                        fontWeight: 950,
                        boxShadow: "0 6px 14px rgba(0,0,0,.16)",
                      },
                    }}
                  >
                    {icon}
                  </Badge>
                ) : (
                  icon
                )}
              </ListItemIcon>

              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  fontWeight: active ? 950 : 750,
                  fontSize: 14.5,
                  letterSpacing: -0.1,
                }}
              />
            </ListItem>
          );
        })}
      </List>

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          p: 1.5,
          borderRadius: 3,
          background: "rgba(255,255,255,.13)",
          border: "1px solid rgba(255,255,255,.18)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Typography sx={{ fontSize: 12, opacity: 0.78, fontWeight: 700 }}>Movyo © {new Date().getFullYear()}</Typography>
        <Typography sx={{ fontSize: 11, opacity: 0.64, mt: 0.3 }}>Gestão inteligente para delivery</Typography>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
