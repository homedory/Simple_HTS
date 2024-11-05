const mysql = require("mysql2")
const db_info = {
    host: "localhost",
    port: "3306",
    user: "root",
    password: "mysql3658",
    database: "db_2020054757"
}

const sql_connection = mysql.createConnection(db_info);
sql_connection.connect();

module.exports = sql_connection;