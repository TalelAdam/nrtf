-- Enable TimescaleDB extension on the default database
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Optional: pg_stat_statements for query profiling
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
