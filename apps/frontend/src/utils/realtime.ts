/**
 * Intervalo de polling para dados que precisam parecer "ao vivo" (vagas
 * preenchendo, lista de espera mudando). Em polling puro (sem WebSocket),
 * na escala de 20-50 pessoas simultâneas isso custa poucas requisições por
 * segundo a uma query indexada por data — não justifica um servidor de
 * eventos dedicado.
 */
export const LIVE_REFRESH_INTERVAL_MS = 2000;
