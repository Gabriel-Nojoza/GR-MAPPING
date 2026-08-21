import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export function montarGradeMes(mesReferencia: Date): Date[][] {
  const inicio = startOfWeek(startOfMonth(mesReferencia));
  const fim = endOfWeek(endOfMonth(mesReferencia));

  const dias = eachDayOfInterval({ start: inicio, end: fim });

  const semanas: Date[][] = [];
  for (let i = 0; i < dias.length; i += 7) {
    semanas.push(dias.slice(i, i + 7));
  }

  return semanas;
}

export function proximoMes(data: Date): Date {
  return addDays(endOfMonth(data), 1);
}

export function mesAnterior(data: Date): Date {
  return addDays(startOfMonth(data), -1);
}
