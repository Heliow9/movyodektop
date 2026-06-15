import { useEffect, useState } from 'react';

export default function useHorarioFuncionamento(getHorarioHoje) {
  const [horarioFuncionamento, setHorarioFuncionamento] = useState('');
  const [tempoRestante, setTempoRestante] = useState(null);

  useEffect(() => {
    const run = async () => {
      const horarioHoje = await getHorarioHoje();
      if (!horarioHoje || horarioHoje.fechado) {
        setHorarioFuncionamento('Fechado');
        return;
      }

      const [abreHora, abreMin] = horarioHoje.abre.split(":").map(Number);
      const [fechaHora, fechaMin] = horarioHoje.fecha.split(":").map(Number);

      const agora = new Date();
      const horarioAbre = new Date(agora);
      horarioAbre.setHours(abreHora, abreMin, 0, 0);

      const horarioFecha = new Date(agora);
      horarioFecha.setHours(fechaHora, fechaMin, 0, 0);

      if (agora < horarioAbre) {
        setTempoRestante(horarioAbre);
      } else if (agora >= horarioAbre && agora < horarioFecha) {
        setHorarioFuncionamento(`Aberto – fecha às ${horarioHoje.fecha}`);
      } else {
        setHorarioFuncionamento('Fechado');
      }
    };
    run();
  }, [getHorarioHoje]);

  useEffect(() => {
    if (!tempoRestante) return;
    const interval = setInterval(() => {
      const agora = new Date();
      const diffMs = tempoRestante - agora;
      if (diffMs <= 0) {
        setHorarioFuncionamento('Aberto agora');
        clearInterval(interval);
        setTempoRestante(null);
        return;
      }
      const diffSec = Math.floor(diffMs / 1000);
      const horas = Math.floor(diffSec / 3600);
      const minutos = Math.floor((diffSec % 3600) / 60);
      const segundos = diffSec % 60;
      let texto = 'Fechado – abre em ';
      if (horas > 0) texto += `${horas}h `;
      if (minutos > 0) texto += `${minutos}min `;
      if (horas === 0 && minutos < 2) texto += `${segundos}s`;
      setHorarioFuncionamento(texto.trim());
    }, 1000);
    return () => clearInterval(interval);
  }, [tempoRestante]);

  return horarioFuncionamento;
}