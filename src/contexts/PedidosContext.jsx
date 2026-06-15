import React, { createContext, useContext, useState } from 'react';

const PedidosContext = createContext();

export const PedidosProvider = ({ children }) => {
  const [pedidos, setPedidos] = useState([]);

  return (
    <PedidosContext.Provider value={{ pedidos, setPedidos }}>
      {children}
    </PedidosContext.Provider>
  );
};

export const usePedidos = () => useContext(PedidosContext);
