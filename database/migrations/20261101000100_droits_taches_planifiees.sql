-- Autorise la tâche planifiée (clé service_role) à calculer les instantanés de portefeuille
grant execute on function snapshot_portfolios(date) to service_role;
