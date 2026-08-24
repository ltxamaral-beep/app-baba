/**
 * PONTO DE ACESSO CENTRAL DOS SERVIÇOS (BARREL EXPORT)
 * 
 * Todos os serviços foram modularizados e desacoplados em arquivos independentes:
 * - storage-helpers.ts: Utilitários base (UUID, timeout, LocalStorage seguro)
 * - user-service.ts: Perfil de usuário e atleta logado
 * - group-service.ts: Grupos, membros, cargos e convites
 * - match-service.ts: Partidas, presenças, lista de espera e estatísticas
 * - finance-service.ts: Lançamentos financeiros, mensalidades, despesas e quitações
 * - voting-service.ts: Avaliações e notas pós-pelada
 * - notification-service.ts: Central de notificações e alertas em tempo real
 */

export * from './storage-helpers';
export * from './user-service';
export * from './group-service';
export * from './match-service';
export * from './finance-service';
export * from './voting-service';
export * from './notification-service';
