const { Pool } = require("pg");

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "Gamificacion123",
    database: "gamificacion_v2"
});

module.exports = pool;