-- Banco separado para os testes de integração.
--
-- Os testes truncam tabelas entre casos, então precisam de um banco próprio:
-- apontar DATABASE_URL_TEST para o banco de desenvolvimento apagaria o
-- catálogo importado a cada execução da suíte.
CREATE DATABASE zepneu_test;
